-- The parts of Projects that had no table.
--
-- projects, project_tasks and time_entries already existed. Project types, bugs
-- and calendar events did not, so those stayed in localStorage — which meant a
-- bug raised on one machine, or a deadline in the calendar, existed only there.

-- ---------------------------------------------------------------------------
-- Project types
--
-- These carry the access lists that decide who a project can be assigned to,
-- so they are configuration rather than user data.
-- ---------------------------------------------------------------------------

create table public.project_types (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  key text not null unique,
  label text not null,
  -- Who a project of this type may be assigned to. Empty means anyone.
  allowed_role_ids text[] not null default '{}',
  allowed_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.project_types enable row level security;

create policy project_types_read on public.project_types
  for select to authenticated using (public.has_access('projects', 'view'));
create policy project_types_write on public.project_types
  for all to authenticated
  using (public.has_access('projects', 'full'))
  with check (public.has_access('projects', 'full'));

grant select, insert, update, delete on public.project_types to authenticated;

-- ---------------------------------------------------------------------------
-- Bugs
-- ---------------------------------------------------------------------------

create table public.project_bugs (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null,
  severity text not null default 'low',
  open boolean not null default true,
  created_at timestamptz not null default now()
);

create index project_bugs_project_idx on public.project_bugs (project_id);

alter table public.project_bugs enable row level security;

create policy project_bugs_read on public.project_bugs
  for select to authenticated using (public.has_access('projects', 'view'));
create policy project_bugs_write on public.project_bugs
  for insert to authenticated with check (public.has_access('projects', 'edit'));
create policy project_bugs_update on public.project_bugs
  for update to authenticated
  using (public.has_access('projects', 'edit'))
  with check (public.has_access('projects', 'edit'));
create policy project_bugs_delete on public.project_bugs
  for delete to authenticated using (public.has_access('projects', 'full'));

grant select, insert, update, delete on public.project_bugs to authenticated;

-- ---------------------------------------------------------------------------
-- Calendar events
--
-- Deadlines and reminders. `reminder_key` is what stops the same reminder being
-- raised twice; it was a separate list of "already sent" ids in localStorage,
-- which meant reopening the app on another machine re-sent everything.
-- ---------------------------------------------------------------------------

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null,
  description text,
  event_type text not null default 'other',
  -- The day it belongs to, which is what the calendar highlights, kept
  -- alongside the exact time because an all-day event has no time.
  event_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  remind_week boolean not null default false,
  remind_day boolean not null default false,
  remind_hour boolean not null default false,
  project_id uuid references public.projects (id) on delete cascade,
  task_legacy_id text,
  -- Unique so a reminder cannot be recorded as sent twice, whichever machine
  -- gets there first.
  reminder_key text unique,
  reminder_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index calendar_events_date_idx on public.calendar_events (event_date);
create index calendar_events_project_idx on public.calendar_events (project_id);

alter table public.calendar_events enable row level security;

create policy calendar_events_read on public.calendar_events
  for select to authenticated using (public.has_access('projects', 'view'));
create policy calendar_events_write on public.calendar_events
  for insert to authenticated with check (public.has_access('projects', 'edit'));
create policy calendar_events_update on public.calendar_events
  for update to authenticated
  using (public.has_access('projects', 'edit'))
  with check (public.has_access('projects', 'edit'));
create policy calendar_events_delete on public.calendar_events
  for delete to authenticated using (public.has_access('projects', 'full'));

grant select, insert, update, delete on public.calendar_events to authenticated;

-- ---------------------------------------------------------------------------
-- Fields the app keeps on a project that the table did not have
-- ---------------------------------------------------------------------------

-- The approval workflow: a project is assigned, submitted, then approved or
-- rejected. These timestamps are what the performance figures are derived from,
-- so losing them would leave the reporting with nothing to measure.
alter table public.projects
  add column if not exists comments jsonb not null default '[]',
  add column if not exists priority text,
  add column if not exists progress_pct numeric(5,2),
  add column if not exists supervisor_role text,
  add column if not exists assigned_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists approved_by uuid references public.profiles (id) on delete set null,
  add column if not exists approval_note text,
  add column if not exists rejection_reason text;

alter table public.project_tasks
  add column if not exists updates jsonb not null default '[]',
  add column if not exists priority text;

-- Seed the default types, matching DEFAULT_TYPES in projectStore.
-- Matches DEFAULT_TYPES in projectStore, including the role lists that decide
-- who a project of each type may be assigned to.
insert into public.project_types (key, label, allowed_role_ids) values
  ('implementation', 'Implementation', array['role_project_manager','role_employee']),
  ('support',        'Support',        array['role_support_agent','role_employee']),
  ('maintenance',    'Maintenance',    array['role_project_manager','role_employee'])
on conflict (key) do nothing;
