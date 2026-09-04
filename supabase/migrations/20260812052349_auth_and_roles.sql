-- Authentication, roles and permissions.
--
-- Replaces four parallel client-side auth systems (authStore, securityStore,
-- rolesStore/accessControl and the legacy permissions.ts) with one model where
-- credentials live in auth.users — hashed, server-side — and access is decided
-- by RLS rather than by the browser.
--
-- The role x module x access-level shape is carried over deliberately: it was
-- the strongest part of the old code. What changes is where it is enforced.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.access_level as enum ('none', 'view', 'edit', 'full');

create type public.role_level as enum ('Global', 'Company', 'Department', 'Team', 'External');

-- Mirrors ModuleKey in src/lib/rolesStore.ts.
create type public.app_module as enum (
  'dashboard',
  'hrm.employees',
  'hrm.departments',
  'hrm.attendance',
  'hrm.leave',
  'hrm.payroll',
  'hrm.performance',
  'accounting',
  'projects',
  'inventory',
  'support',
  'settings',
  'crm',
  'email',
  'messenger',
  'whatsapp'
);

-- Signups are approved by an administrator before they can use the system,
-- which the old app modelled as a separate "pending" list.
create type public.profile_status as enum ('pending', 'active', 'inactive');

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create table public.roles (
  id text primary key,
  name text not null,
  level public.role_level not null,
  description text,
  require_2fa boolean not null default false,
  session_timeout_minutes integer,
  -- Protects the seeded roles from deletion; custom roles may be removed.
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.roles is 'Named roles. Access is defined per module in role_access.';

create table public.role_access (
  role_id text not null references public.roles (id) on delete cascade,
  module public.app_module not null,
  level public.access_level not null default 'none',
  primary key (role_id, module)
);

comment on table public.role_access is
  'One row per role/module. A missing row is treated as "none".';

-- ---------------------------------------------------------------------------
-- Profiles: application data for an authenticated user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  role_id text references public.roles (id) on delete set null,
  status public.profile_status not null default 'pending',
  two_factor_enabled boolean not null default false,
  job_title text,
  department_id uuid,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.role_id is
  'Null means no access. Never default this to an administrative role — the
   previous implementation fell back to Super Admin when a role could not be
   resolved, which silently made every unresolvable session an administrator.';

create index profiles_role_id_idx on public.profiles (role_id);
create index profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- Permission helpers
--
-- SECURITY DEFINER so policies can read roles/profiles without those reads
-- being subject to the very policies being evaluated (which would recurse).
-- ---------------------------------------------------------------------------

create or replace function public.current_role_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role_id
  from public.profiles p
  where p.id = auth.uid()
    and p.status = 'active'
$$;

comment on function public.current_role_id is
  'Role of the signed-in user, or null when unauthenticated, pending or
   inactive. Callers must treat null as "no access".';

create or replace function public.has_access(
  target_module public.app_module,
  required public.access_level default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        case ra.level
          when 'full' then 4
          when 'edit' then 3
          when 'view' then 2
          else 1
        end
        >=
        case required
          when 'full' then 4
          when 'edit' then 3
          when 'view' then 2
          else 1
        end
      from public.role_access ra
      where ra.role_id = public.current_role_id()
        and ra.module = target_module
    ),
    false  -- no role, or no row for this module: deny.
  )
$$;

comment on function public.has_access is
  'Server-side equivalent of canAccess(). Fails closed.';

-- ---------------------------------------------------------------------------
-- Keep profiles in step with auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    -- New signups wait for approval; an administrator assigns the role.
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.role_access enable row level security;
alter table public.profiles enable row level security;

-- Everyone signed in may read the role catalogue; the UI needs role names.
create policy roles_read on public.roles
  for select to authenticated
  using (true);

create policy roles_write on public.roles
  for all to authenticated
  using (public.has_access('settings', 'full'))
  with check (public.has_access('settings', 'full'));

create policy role_access_read on public.role_access
  for select to authenticated
  using (true);

create policy role_access_write on public.role_access
  for all to authenticated
  using (public.has_access('settings', 'full'))
  with check (public.has_access('settings', 'full'));

-- You can always read yourself, so the app can show who is signed in even
-- before a role has been assigned.
create policy profiles_read_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_read_all on public.profiles
  for select to authenticated
  using (public.has_access('settings', 'view'));

-- Editing your own profile must not let you change your own role or status.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role_id is not distinct from (select p.role_id from public.profiles p where p.id = auth.uid())
    and status is not distinct from (select p.status from public.profiles p where p.id = auth.uid())
  );

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.has_access('settings', 'full'))
  with check (public.has_access('settings', 'full'));

-- ---------------------------------------------------------------------------
-- Seed roles (mirrors the SEED array in src/lib/rolesStore.ts)
-- ---------------------------------------------------------------------------

insert into public.roles (id, name, level, description, require_2fa, session_timeout_minutes, is_system) values
  ('role_super_admin',      'Super Admin',       'Global',     'Owner of the platform',                                  true,  60,   true),
  ('role_company_admin',    'Company Admin',     'Company',    'Manages the company instance',                           true,  60,   true),
  ('role_hr_manager',       'HR Manager',        'Department', 'Handles staff, payroll and attendance',                  false, null, true),
  ('role_finance_manager',  'Finance Manager',   'Department', 'Handles all financial records',                          true,  45,   true),
  ('role_project_manager',  'Project Manager',   'Department', 'Oversees projects, tasks and deadlines',                 false, null, true),
  ('role_inventory_manager','Inventory Manager', 'Department', 'Manages stock and company assets',                       false, null, true),
  ('role_support_agent',    'Support Agent',     'Department', 'Handles client support tickets',                         false, null, true),
  ('role_employee',         'Employee',          'Team',       'Executes assigned work',                                 false, null, true),
  ('role_viewer',           'Report Viewer',     'Team',       'Read-only access to operational data',                   false, null, true),
  ('role_client',           'Client',            'External',   'Limited client portal access',                           false, null, true);

-- Super Admin: full access to every module, including any added later.
insert into public.role_access (role_id, module, level)
select 'role_super_admin', m, 'full'
from unnest(enum_range(null::public.app_module)) as m;

insert into public.role_access (role_id, module, level) values
  -- Company Admin
  ('role_company_admin', 'dashboard', 'full'),
  ('role_company_admin', 'settings', 'full'),
  ('role_company_admin', 'accounting', 'full'),
  ('role_company_admin', 'projects', 'full'),
  ('role_company_admin', 'inventory', 'full'),
  ('role_company_admin', 'support', 'full'),
  ('role_company_admin', 'crm', 'edit'),
  ('role_company_admin', 'hrm.employees', 'full'),
  ('role_company_admin', 'hrm.departments', 'full'),
  ('role_company_admin', 'hrm.attendance', 'full'),
  ('role_company_admin', 'hrm.leave', 'full'),
  ('role_company_admin', 'hrm.payroll', 'full'),
  ('role_company_admin', 'hrm.performance', 'full'),
  ('role_company_admin', 'email', 'view'),
  ('role_company_admin', 'messenger', 'view'),
  ('role_company_admin', 'whatsapp', 'view'),

  -- HR Manager
  ('role_hr_manager', 'dashboard', 'view'),
  ('role_hr_manager', 'hrm.employees', 'full'),
  ('role_hr_manager', 'hrm.departments', 'edit'),
  ('role_hr_manager', 'hrm.attendance', 'full'),
  ('role_hr_manager', 'hrm.leave', 'full'),
  ('role_hr_manager', 'hrm.payroll', 'full'),
  ('role_hr_manager', 'hrm.performance', 'edit'),

  -- Finance Manager
  ('role_finance_manager', 'dashboard', 'view'),
  ('role_finance_manager', 'accounting', 'full'),
  ('role_finance_manager', 'hrm.payroll', 'edit'),
  ('role_finance_manager', 'projects', 'view'),

  -- Project Manager
  ('role_project_manager', 'dashboard', 'view'),
  ('role_project_manager', 'projects', 'full'),
  ('role_project_manager', 'support', 'view'),

  -- Inventory Manager
  ('role_inventory_manager', 'dashboard', 'view'),
  ('role_inventory_manager', 'inventory', 'full'),

  -- Support Agent
  ('role_support_agent', 'support', 'full'),
  ('role_support_agent', 'projects', 'view'),

  -- Employee
  ('role_employee', 'dashboard', 'view'),
  ('role_employee', 'projects', 'edit'),
  ('role_employee', 'hrm.attendance', 'edit'),
  ('role_employee', 'hrm.leave', 'edit'),
  ('role_employee', 'hrm.employees', 'view'),

  -- Report Viewer
  ('role_viewer', 'dashboard', 'view'),
  ('role_viewer', 'accounting', 'view'),
  ('role_viewer', 'projects', 'view'),
  ('role_viewer', 'crm', 'view'),
  ('role_viewer', 'support', 'view'),
  ('role_viewer', 'hrm.employees', 'view'),
  ('role_viewer', 'hrm.departments', 'view'),

  -- Client
  ('role_client', 'projects', 'view'),
  ('role_client', 'support', 'view');
