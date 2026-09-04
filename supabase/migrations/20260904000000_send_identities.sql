-- Sending as more than one address.
--
-- Everything went out from SMTP_FROM, so a customer who wrote to support@ got
-- a reply from billing@ or whatever the single configured address happened to
-- be. That is confusing at best; at worst their reply goes somewhere nobody
-- reads, because they answer the address that wrote to them.
--
-- The addresses are a fixed list an administrator maintains, not something a
-- caller supplies. A client that could name its own From header could send as
-- the managing director, or as a customer, from inside the company's own mail
-- relay — which is a more convincing forgery than anything an outsider can
-- manage.

create table if not exists public.send_identities (
  id uuid primary key default gen_random_uuid(),
  -- Stored lowercase. Matching is exact, and the send function checks the
  -- requested address against this table before it will use it.
  address text not null unique,
  display_name text,

  -- Optional narrowing. An identity tied to a module may only be used by
  -- somebody who can edit that module, so a support agent cannot send as
  -- accounts@ and ask a customer to change bank details.
  module public.app_module,

  -- Used when nothing else is chosen. Exactly one, enforced below.
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Partial unique index: any number of non-default rows, at most one default.
create unique index if not exists send_identities_one_default
  on public.send_identities ((is_default)) where is_default;

comment on table public.send_identities is
  'Addresses the system may send as. Empty is fine: with no rows everything
   goes out from SMTP_FROM, which is what happened before this existed.';

alter table public.send_identities enable row level security;

drop policy if exists send_identities_read on public.send_identities;
drop policy if exists send_identities_write on public.send_identities;

-- Readable by anyone who can send anything, since the compose screen and the
-- ticket reply both need to know what they may send as.
create policy send_identities_read on public.send_identities
  for select to authenticated
  using (
    public.has_access('email', 'view')
    or public.has_access('support', 'view')
    or public.has_access('accounting', 'view')
  );

-- Adding an address the company sends as is a settings decision. Somebody who
-- could add one could send as anybody.
create policy send_identities_write on public.send_identities
  for all to authenticated
  using (public.has_access('settings', 'full'))
  with check (public.has_access('settings', 'full'));

grant select, insert, update, delete on public.send_identities to authenticated;

-- ---------------------------------------------------------------------------
-- Which of our addresses a ticket arrived at
--
-- So the reply goes back out from the same one. Without it a customer who
-- wrote to support@ is answered by whatever the default is, and their next
-- message goes to that address instead of into the support queue.
-- ---------------------------------------------------------------------------

alter table public.tickets
  add column if not exists inbox_address text;

-- ---------------------------------------------------------------------------
-- The sent log records which identity was used
--
-- "Who sent it" and "what address it came from" are different questions, and
-- the second is the one a customer asking "who is this from?" is really about.
-- ---------------------------------------------------------------------------

alter table public.email_messages
  add column if not exists from_address text;
