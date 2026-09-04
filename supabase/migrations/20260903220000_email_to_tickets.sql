-- Mail to support@ becomes a ticket, and a reply to it becomes a comment.
--
-- The inbox files everything a provider delivers. That is right for info@ and
-- accounts@, where somebody reads and answers. It is wrong for support@, where
-- the point is that the request enters the queue with an SLA attached rather
-- than sitting in a shared mailbox waiting to be noticed.
--
-- Which addresses do what is a routing table rather than a hardcoded name,
-- because the answer to "how many addresses can we have" should be a row count
-- and not a code change.

-- ---------------------------------------------------------------------------
-- A stable, short reference on every ticket
--
-- Needed to recognise a reply. Threading headers are unreliable — plenty of
-- clients drop In-Reply-To, and some rewrite it — so the reference goes in the
-- subject of what we send and is read back out of what returns.
--
-- A sequence rather than a random string: no collisions to handle, and a
-- customer quoting "T-00042" over the phone can be found.
-- ---------------------------------------------------------------------------

create sequence if not exists public.ticket_reference_seq start 1;

alter table public.tickets
  add column if not exists reference text,
  -- The email that opened it, so the original is one click away.
  add column if not exists source_email_id uuid references public.inbound_emails(id) on delete set null;

create or replace function public.assign_ticket_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'T-' || lpad(nextval('public.ticket_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists assign_ticket_reference on public.tickets;
create trigger assign_ticket_reference
  before insert on public.tickets
  for each row execute function public.assign_ticket_reference();

-- Existing tickets get one too, or a reply to an older thread would not match.
update public.tickets
  set reference = 'T-' || lpad(nextval('public.ticket_reference_seq')::text, 5, '0')
  where reference is null;

create unique index if not exists tickets_reference_key on public.tickets (reference);

-- ---------------------------------------------------------------------------
-- Routing
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.inbound_route_action as enum ('inbox', 'ticket');
exception when duplicate_object then null;
end $$;

create table if not exists public.inbound_routes (
  id uuid primary key default gen_random_uuid(),
  -- Stored lowercase; matching is exact. Wildcards were considered and left
  -- out: "*@company.co.za" reads as a convenience and behaves as a rule that
  -- silently swallows every address somebody adds later.
  address text not null unique,
  action public.inbound_route_action not null default 'ticket',
  -- Applied to tickets this route opens.
  category text,
  priority public.ticket_priority not null default 'medium',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.inbound_routes is
  'What happens to mail arriving at each address. An address with no route
   lands in the shared inbox, which is the safe default: mail is never dropped
   for want of configuration.';

alter table public.inbound_routes enable row level security;

drop policy if exists inbound_routes_read on public.inbound_routes;
drop policy if exists inbound_routes_write on public.inbound_routes;

create policy inbound_routes_read on public.inbound_routes
  for select to authenticated
  using (public.has_access('support', 'view') or public.has_access('email', 'view'));

create policy inbound_routes_write on public.inbound_routes
  for all to authenticated
  using (public.has_access('support', 'full'))
  with check (public.has_access('support', 'full'));

grant select, insert, update, delete on public.inbound_routes to authenticated;

-- ---------------------------------------------------------------------------
-- Tickets opened by email need a requester who is not a user
--
-- `requester` already holds "a user id or email", so a customer's address goes
-- in it unchanged. What it cannot do is tell the support screens that this
-- person is reachable by email — which matters, because replying to a ticket
-- raised by a colleague and one raised by a stranger are different acts.
-- ---------------------------------------------------------------------------

alter table public.tickets
  add column if not exists requester_email text;

-- ---------------------------------------------------------------------------
-- The inbound function writes tickets with the service key
--
-- It has no session, so row level security does not apply to it. This exists to
-- record why there is no ticket insert policy covering that path: there is
-- deliberately no way for an unauthenticated caller to create a ticket through
-- the API, only through a mail provider proving itself with the shared secret.
-- ---------------------------------------------------------------------------
