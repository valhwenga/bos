-- Receiving mail.
--
-- The app could send but not receive. The inbox screen read a folder nothing
-- ever wrote to, so it was empty by construction and was removed.
--
-- Receiving needs something outside the browser to accept the mail. A provider
-- (SendGrid Inbound Parse, Mailgun Routes, Postmark inbound) takes delivery for
-- the domain and POSTs each message to the receive-email function, which writes
-- the rows below. See DEPLOYMENT.md for pointing a domain at one.
--
-- Everything in this table came from outside. The sender chose the from
-- address, the subject and the body, and none of it is trustworthy: `from` in
-- particular is as forgeable as the return address on an envelope, which is why
-- the authentication results the provider reports are stored beside it rather
-- than discarded.

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),

  -- The provider's own id for the message, so a retried delivery — which
  -- providers do, on any non-2xx — updates rather than duplicating.
  provider_message_id text unique,

  from_address text not null default '',
  from_name text,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text not null default '',
  -- Plain text only. The HTML part is deliberately not stored: it would have to
  -- be sanitised before display, and there is no safe way to render attacker-
  -- authored markup that is worth the risk here.
  body text not null default '',

  -- What the provider made of the sender's claim to be who they say. Kept
  -- verbatim rather than reduced to a boolean, because "none" and "fail" mean
  -- different things and the distinction matters when deciding whether to act
  -- on an email.
  spf text,
  dkim text,
  spam_score numeric,

  -- Threading, for grouping a reply with what it answered.
  message_id text,
  in_reply_to text,

  received_at timestamptz not null default now(),
  read_at timestamptz,
  -- Filed away without being deleted. The mail still happened.
  archived_at timestamptz
);

create index if not exists inbound_emails_received_idx
  on public.inbound_emails (received_at desc);
create index if not exists inbound_emails_unread_idx
  on public.inbound_emails (received_at desc) where read_at is null and archived_at is null;
create index if not exists inbound_emails_thread_idx
  on public.inbound_emails (in_reply_to);

create table if not exists public.inbound_email_attachments (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.inbound_emails(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists inbound_email_attachments_email_idx
  on public.inbound_email_attachments (email_id);

-- ---------------------------------------------------------------------------
-- A private bucket for what arrives attached
--
-- Files from strangers. Private, size-capped, and never served from a public
-- URL: the app hands out short-lived signed links to people who may read the
-- mailbox.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inbound-email-attachments', 'inbound-email-attachments', false, 26214400, null)
on conflict (id) do nothing;

-- bucket_module() maps buckets to the module that governs them; this one
-- belongs to email like the sent log does.
create or replace function public.bucket_module(p_bucket text)
returns public.app_module
language sql
immutable
as $$
  select case p_bucket
    when 'employee-documents'         then 'hrm.employees'
    when 'expense-receipts'           then 'accounting'
    when 'project-files'              then 'projects'
    when 'ticket-attachments'         then 'support'
    when 'lead-attachments'           then 'crm'
    when 'message-attachments'        then 'messenger'
    when 'inbound-email-attachments'  then 'email'
    when 'company-assets'             then 'settings'
  end::public.app_module
$$;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- A shared company mailbox: info@, accounts@, support@. Anyone who may use the
-- email module may read it, which is the same rule the sent log uses.
--
-- Nothing here is writable from the browser at all. The rows are created by the
-- receive-email function using the service key, because a mail provider has no
-- session and the alternative — an endpoint the browser could write to — would
-- let any signed-in user forge an email from anyone.
-- ---------------------------------------------------------------------------

alter table public.inbound_emails enable row level security;
alter table public.inbound_email_attachments enable row level security;

drop policy if exists inbound_emails_read on public.inbound_emails;
drop policy if exists inbound_emails_update on public.inbound_emails;
drop policy if exists inbound_email_attachments_read on public.inbound_email_attachments;

create policy inbound_emails_read on public.inbound_emails
  for select to authenticated
  using (public.has_access('email', 'view'));

-- Marking read and archiving. A trigger below keeps it to those two columns:
-- the contents of a received email are evidence of what somebody sent, and
-- editing them would make the mailbox worthless as a record.
create policy inbound_emails_update on public.inbound_emails
  for update to authenticated
  using (public.has_access('email', 'view'))
  with check (public.has_access('email', 'view'));

create policy inbound_email_attachments_read on public.inbound_email_attachments
  for select to authenticated
  using (public.has_access('email', 'view'));

create or replace function public.inbound_emails_read_state_only()
returns trigger
language plpgsql
as $$
begin
  if new.provider_message_id is distinct from old.provider_message_id
     or new.from_address is distinct from old.from_address
     or new.from_name is distinct from old.from_name
     or new.to_addresses is distinct from old.to_addresses
     or new.cc_addresses is distinct from old.cc_addresses
     or new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.spf is distinct from old.spf
     or new.dkim is distinct from old.dkim
     or new.spam_score is distinct from old.spam_score
     or new.message_id is distinct from old.message_id
     or new.in_reply_to is distinct from old.in_reply_to
     or new.received_at is distinct from old.received_at then
    raise exception 'A received email cannot be edited; only read and archived state may change'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists inbound_emails_read_state_only on public.inbound_emails;
create trigger inbound_emails_read_state_only
  before update on public.inbound_emails
  for each row execute function public.inbound_emails_read_state_only();

-- No insert and no delete policy, and no grant for either. The function writes;
-- nobody deletes.
grant select, update on public.inbound_emails to authenticated;
grant select on public.inbound_email_attachments to authenticated;

-- ---------------------------------------------------------------------------
-- Live, so mail arrives rather than being found
-- ---------------------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.inbound_emails;
exception when duplicate_object then null;
end $$;
