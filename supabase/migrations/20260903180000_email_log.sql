-- What the company has actually emailed out.
--
-- The sent folder was localStorage, so it recorded only what *your* browser had
-- sent. Nobody could see that a colleague had already chased a customer, and
-- clearing site data erased the evidence that an invoice was ever sent.
--
-- Worse, two callers treated the local write as the send itself. The recurring
-- invoice sweep generated an invoice, called EmailStore.send() — which wrote to
-- localStorage and returned — and then advanced the schedule, so the period was
-- marked billed and the customer was never emailed. Nothing reported a failure
-- because nothing had failed; nothing had been attempted.

do $$ begin
  create type public.email_status as enum ('sent', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),

  -- Who pressed send. Null for the ones the recurring sweep raises on a timer
  -- while nobody is looking at the screen.
  sent_by uuid references public.profiles(id) on delete set null,
  sent_by_name text,

  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text not null default '',
  body text not null default '',

  -- Names and sizes, not content. The attachment itself is regenerable from
  -- the invoice or quotation it was made from, and keeping a second copy of
  -- every PDF ever emailed is a great deal of storage for no new information.
  attachment_names text[] not null default '{}',

  -- Which module authorised it, so an accounting send is distinguishable from
  -- a message somebody typed by hand.
  module text,

  status public.email_status not null default 'sent',
  -- The mail server's refusal, kept verbatim. "Could not send" is not enough to
  -- act on; "550 relay denied" is.
  error text,

  created_at timestamptz not null default now()
);

create index if not exists email_messages_created_idx
  on public.email_messages (created_at desc);
create index if not exists email_messages_status_idx
  on public.email_messages (status) where status = 'failed';

-- ---------------------------------------------------------------------------
-- Written by the send function, not by the browser
--
-- The client cannot know whether the mail server accepted the message; only
-- the function that talked to it can. Letting the client write this row would
-- make the log a record of what the browser believed rather than what
-- happened — which is exactly the defect being fixed.
-- ---------------------------------------------------------------------------

create or replace function public.stamp_email_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  new.sent_by := auth.uid();
  new.created_at := now();
  select name, email into p from public.profiles where id = auth.uid();
  if found then
    new.sent_by_name := coalesce(nullif(p.name, ''), p.email);
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_email_sender on public.email_messages;
create trigger stamp_email_sender
  before insert on public.email_messages
  for each row execute function public.stamp_email_sender();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.email_messages enable row level security;

drop policy if exists email_messages_read on public.email_messages;
drop policy if exists email_messages_insert on public.email_messages;

-- Anyone who can use the email module can see what has gone out. This is
-- business correspondence with customers, not private mail: the point of a
-- shared sent folder is that a colleague can tell whether the invoice was
-- already sent before sending it again.
create policy email_messages_read on public.email_messages
  for select to authenticated
  using (public.has_access('email', 'view') or public.has_access('accounting', 'view'));

create policy email_messages_insert on public.email_messages
  for insert to authenticated
  with check (auth.uid() is not null);

-- No update and no delete. A sent-mail log that can be tidied afterwards
-- cannot answer "did we send it", which is the only question it exists for.

grant select, insert on public.email_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Company Admin can send from the module they can already see
--
-- The same thing the messenger migration turned up: enforcing a module for the
-- first time exposes who was never granted it. Company Admin had `email` view,
-- so they could open Compose and were refused on send; only Super Admin could
-- send at all. It went unnoticed because the old send never contacted a mail
-- server, so no permission was ever checked.
--
-- This grants `edit` to Company Admin and nobody else. It is the smallest
-- change that makes the screen work for the people who can already reach it:
-- everyone else has no `email` row, cannot see the module, and giving them one
-- would newly expose it rather than fix anything.
--
-- Emailing invoices and quotations is unaffected either way — those are checked
-- against `accounting`, which Company Admin and Finance Manager already hold in
-- full.
-- ---------------------------------------------------------------------------

insert into public.role_access (role_id, module, level)
values ('role_company_admin', 'email', 'edit')
on conflict (role_id, module) do update set level = 'edit'
  where public.role_access.level = 'view';
