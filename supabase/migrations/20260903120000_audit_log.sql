-- The audit trail: append-only, and honest about who did what.
--
-- Two stores wrote the same localStorage key with incompatible shapes. One
-- recorded `{ts, actor}`, the other `{timestamp, userName}`, and the compliance
-- report read the second — so as soon as a ticket was raised, searching that
-- report threw on `log.userName.toLowerCase()` of a row that had no userName.
-- Both truncated, at different lengths, and neither screen was routed, so
-- nobody could read the trail even when it happened to be coherent.
--
-- The deeper problem was that `actor` was a string the browser chose. Every
-- entry said "admin" or "user" because that is what the call site typed. An
-- audit trail whose actor field is client-supplied records what the client
-- claims, which is worth nothing in the moment it matters.

do $$ begin
  create type public.audit_action as enum (
    'create', 'update', 'delete', 'approve', 'reject', 'login', 'logout', 'export'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),

  -- The server's clock. The client's was trusted before, and a wrong or
  -- deliberately-set device clock put entries anywhere in the timeline.
  at timestamptz not null default now(),

  -- Set from the JWT, never from the request body. On delete set null so
  -- removing a profile cannot erase the record of what they did.
  actor_id uuid references public.profiles(id) on delete set null,

  -- Kept alongside the id because a name read at display time is the name
  -- today, not the name of the person who acted. Renames and departures must
  -- not rewrite history.
  actor_name text not null default 'Unknown',
  actor_email text,

  action public.audit_action not null,
  -- Free text rather than an enum: entities come and go with features, and a
  -- migration to record a new kind of object is friction that leads to the
  -- object simply not being recorded.
  entity text not null,
  entity_id text,
  details text
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);

-- ---------------------------------------------------------------------------
-- The actor is stamped by the database
--
-- The client sends the action and the subject. It does not get a say in who it
-- was, or when.
-- ---------------------------------------------------------------------------

create or replace function public.stamp_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  new.actor_id := auth.uid();
  new.at := now();

  select name, email into p from public.profiles where id = auth.uid();
  if found then
    new.actor_name := coalesce(nullif(p.name, ''), p.email, 'Unknown');
    new.actor_email := p.email;
  else
    new.actor_name := 'Unknown';
    new.actor_email := null;
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_audit_actor on public.audit_log;
create trigger stamp_audit_actor
  before insert on public.audit_log
  for each row execute function public.stamp_audit_actor();

-- ---------------------------------------------------------------------------
-- Append-only
--
-- There is deliberately no update policy and no delete policy, and no grant for
-- either. A trail an administrator can quietly edit is not evidence of
-- anything; the people most worth auditing are the ones with settings access.
-- Correcting a mistaken entry means writing another entry.
-- ---------------------------------------------------------------------------

alter table public.audit_log enable row level security;

drop policy if exists audit_log_insert on public.audit_log;
drop policy if exists audit_log_read on public.audit_log;

-- Anyone signed in can record what they did — they have to, since an employee
-- raising a ticket is an audited action.
--
-- The check is that there IS an actor, not that the row names the right one:
-- the trigger above overwrites actor_id from the session before this runs, so
-- a client that names somebody else simply has its claim replaced. What this
-- refuses is the entry nobody can be held to — a session with no subject would
-- otherwise land as an anonymous 'Unknown', which is not a trail.
create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (auth.uid() is not null);

-- Reading the trail is a settings concern, the same question the rest of the
-- app asks before showing administrative screens.
create policy audit_log_read on public.audit_log
  for select to authenticated
  using (public.has_access('settings', 'full'));

grant select, insert on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- No retention limit
--
-- The old stores kept the last 1000 and 2000 entries because localStorage is a
-- few megabytes. That is a storage constraint masquerading as a policy: the
-- entry you want is usually the old one. Rows are cheap here; if this ever
-- needs trimming it should be a deliberate, dated decision rather than a
-- silent `splice`.
-- ---------------------------------------------------------------------------
