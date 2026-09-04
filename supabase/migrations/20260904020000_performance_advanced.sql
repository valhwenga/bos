-- Goals, 360° reviews and calibration.
--
-- The last store still writing to localStorage. Three substantial screens sat
-- on top of it, and none of them worked as intended: a 360° review whose whole
-- purpose is that several people review one person, held in whichever browser
-- each of them happened to use, so the manager reading them together saw only
-- their own.
--
-- Who may read what matters more here than in most tables, so it is set out
-- explicitly rather than defaulting to "anyone with the module".

-- ---------------------------------------------------------------------------
-- Goals
--
-- Between an employee and whoever reviews them. The employee sees their own and
-- may move the progress figure; the wording of the goal and the reviewer's
-- notes are not theirs to edit.
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.goal_category as enum ('objective', 'key_result', 'smart');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.goal_status as enum ('not_started', 'in_progress', 'completed', 'blocked');
exception when duplicate_object then null;
end $$;

create table if not exists public.performance_goals (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  description text not null default '',
  category public.goal_category not null default 'smart',
  due_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  status public.goal_status not null default 'not_started',
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists performance_goals_employee_idx
  on public.performance_goals (employee_id);

-- ---------------------------------------------------------------------------
-- 360° reviews
--
-- The sensitive one. A peer's candid assessment reaches the manager, not the
-- person being assessed — that is what makes it candid, and a system that
-- quietly showed it to the subject would be worse than having no 360 at all,
-- because people would write as though it were private and find out otherwise.
--
-- So: a reviewer sees what they wrote, HR sees everything, and the subject sees
-- none of it here. What the subject is told is the manager's job.
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.review_relationship as enum ('manager', 'peer', 'self', 'direct_report');
exception when duplicate_object then null;
end $$;

create table if not exists public.reviews_360 (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  employee_id uuid not null references public.employees(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  relationship public.review_relationship not null default 'peer',
  -- Category to a 1-5 score. Free-form because the categories are a business
  -- decision that will change, and a column per category would need a migration
  -- every time somebody rewords one.
  ratings jsonb not null default '{}'::jsonb,
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  submitted_at timestamptz not null default now()
);

create index if not exists reviews_360_employee_idx on public.reviews_360 (employee_id);
create index if not exists reviews_360_reviewer_idx on public.reviews_360 (reviewer_id);

-- ---------------------------------------------------------------------------
-- Calibration
--
-- A management exercise in comparing people against each other before ratings
-- are final. Nobody outside HR has any business reading it.
-- ---------------------------------------------------------------------------

create table if not exists public.calibration_sessions (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  department_id uuid references public.departments(id) on delete set null,
  start_date date,
  end_date date,
  participants uuid[] not null default '{}',
  final_ratings jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- The reviewer is stamped, not supplied
--
-- Same reasoning as the audit log: a review attributed to whoever the client
-- named is not evidence of anything.
-- ---------------------------------------------------------------------------

create or replace function public.stamp_review_reviewer()
returns trigger
language plpgsql
as $$
begin
  new.reviewer_id := auth.uid();
  new.submitted_at := now();
  return new;
end;
$$;

drop trigger if exists stamp_review_reviewer on public.reviews_360;
create trigger stamp_review_reviewer
  before insert on public.reviews_360
  for each row execute function public.stamp_review_reviewer();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.performance_goals enable row level security;
alter table public.reviews_360 enable row level security;
alter table public.calibration_sessions enable row level security;

drop policy if exists performance_goals_read on public.performance_goals;
drop policy if exists performance_goals_write on public.performance_goals;
drop policy if exists performance_goals_own_progress on public.performance_goals;
drop policy if exists reviews_360_read on public.reviews_360;
drop policy if exists reviews_360_insert on public.reviews_360;
drop policy if exists calibration_read on public.calibration_sessions;
drop policy if exists calibration_write on public.calibration_sessions;

-- Your own goals, or all of them with the module.
create policy performance_goals_read on public.performance_goals
  for select to authenticated
  using (
    public.has_access('hrm.performance', 'view')
    or employee_id = public.current_employee_id()
  );

create policy performance_goals_write on public.performance_goals
  for all to authenticated
  using (public.has_access('hrm.performance', 'edit'))
  with check (public.has_access('hrm.performance', 'edit'));

-- An employee moving their own progress along. The trigger below keeps them to
-- that one column: the goal's wording and the reviewer's notes are not theirs.
create policy performance_goals_own_progress on public.performance_goals
  for update to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

create or replace function public.goals_employee_edits_progress_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- HR may change anything; this only constrains the employee editing their own.
  if public.has_access('hrm.performance', 'edit') then
    return new;
  end if;
  if new.employee_id is distinct from old.employee_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.category is distinct from old.category
     or new.due_date is distinct from old.due_date
     or new.reviewer_id is distinct from old.reviewer_id
     or new.reviewer_notes is distinct from old.reviewer_notes then
    raise exception 'You may update the progress and status of your own goal, nothing else'
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists goals_employee_edits_progress_only on public.performance_goals;
create trigger goals_employee_edits_progress_only
  before update on public.performance_goals
  for each row execute function public.goals_employee_edits_progress_only();

-- What you wrote, or everything if you run performance management.
--
-- `edit` rather than `full`: in the shipped roles only HR Manager holds edit
-- and only Company Admin holds full, so gating on full would lock the HR
-- manager out of the very feedback they exist to collate. Deliberately not
-- "the employee sees reviews about them" — see the note on the table.
create policy reviews_360_read on public.reviews_360
  for select to authenticated
  using (
    public.has_access('hrm.performance', 'edit')
    or reviewer_id = auth.uid()
  );

-- Anyone with the module may contribute one; the trigger records who.
create policy reviews_360_insert on public.reviews_360
  for insert to authenticated
  with check (public.has_access('hrm.performance', 'view'));

-- No update and no delete. A review edited after it was read is not the review
-- that was read.

-- Same reasoning: the people who run performance management, which is HR.
create policy calibration_read on public.calibration_sessions
  for select to authenticated
  using (public.has_access('hrm.performance', 'edit'));

create policy calibration_write on public.calibration_sessions
  for all to authenticated
  using (public.has_access('hrm.performance', 'edit'))
  with check (public.has_access('hrm.performance', 'edit'));

grant select, insert, update, delete on public.performance_goals to authenticated;
grant select, insert on public.reviews_360 to authenticated;
grant select, insert, update, delete on public.calibration_sessions to authenticated;
