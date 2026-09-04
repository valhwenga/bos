-- Business schema: accounting, CRM, HRM, projects and support.
--
-- Derived from the TypeScript types in src/lib/*Store.ts, which were the most
-- carefully modelled part of the old code. Three things change in the move:
--
--  * Line items become rows in their own table rather than a JSON blob, so
--    totals can be computed in SQL instead of only in the browser.
--  * Money is numeric(14,2), not float. Invoice totals must not drift.
--  * Every table carries RLS keyed to the same has_access() used by the app,
--    so a permission check cannot be bypassed by calling the API directly.
--
-- Legacy text ids (inv_..., q_..., D001) are preserved in a `legacy_id` column
-- so an import from localStorage can rebuild relationships, and so a record can
-- be traced back to what it was before the migration.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ---------------------------------------------------------------------------
-- Company settings (single row for a single-company deployment)
-- ---------------------------------------------------------------------------

create table public.company_settings (
  id boolean primary key default true check (id),  -- enforces exactly one row
  name text not null default 'Your Company',
  address text,
  email text,
  phone text,
  tax_id text,
  tax_rate_pct numeric(5,2) not null default 0,
  currency_code text not null default 'USD',
  currency_symbol text not null default '$',
  primary_color text default '#128768',
  secondary_color text default '#1BA37E',
  bank_name text,
  bank_account text,
  branch_code text,
  branch_name text,
  bank_swift text,
  bank_iban text,
  customer_notes_default text,
  footer_note text,
  logo_data_url text,
  signature_data_url text,
  updated_at timestamptz not null default now()
);

comment on column public.company_settings.id is
  'Always true. The check constraint makes a second row impossible, which is
   the single-company decision expressed in the schema.';

insert into public.company_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Accounting
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  email text,
  phone text,
  company_name text,
  tax_number text,
  billing_address jsonb,
  shipping_address jsonb,
  shipping_same_as_billing boolean not null default false,
  responsible jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  price numeric(14,2) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.quotation_status as enum ('draft','sent','accepted','declined','converted');
create type public.invoice_status  as enum ('draft','sent','paid','overdue');

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  number text not null,
  customer_id uuid references public.customers (id) on delete restrict,
  -- Snapshot of the customer as billed, so editing a customer later does not
  -- silently rewrite the history of an issued document.
  customer_snapshot jsonb,
  status public.quotation_status not null default 'draft',
  issue_date date not null default current_date,
  expiry_date date,
  reference text,
  subject text,
  salesperson text,
  project_name text,
  notes text,
  discount_pct numeric(5,2) not null default 0,
  shipping numeric(14,2) not null default 0,
  use_shipping_address boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  number text not null,
  customer_id uuid references public.customers (id) on delete restrict,
  customer_snapshot jsonb,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  source_quotation_id uuid references public.quotations (id) on delete set null,
  reference text,
  notes text,
  discount_pct numeric(5,2) not null default 0,
  shipping numeric(14,2) not null default 0,
  use_shipping_address boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Line items for both document types. Kept in one table with a check so a row
-- always belongs to exactly one parent.
create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  invoice_id uuid references public.invoices (id) on delete cascade,
  quotation_id uuid references public.quotations (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  description text,
  qty numeric(14,3) not null default 1,
  price numeric(14,2) not null default 0,
  constraint line_item_has_one_parent check (
    (invoice_id is not null)::int + (quotation_id is not null)::int = 1
  )
);

create index line_items_invoice_idx on public.line_items (invoice_id);
create index line_items_quotation_idx on public.line_items (quotation_id);

create type public.payment_method as enum ('Cash','EFT/Bank Transfer','Card','Other');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  customer_id uuid references public.customers (id) on delete restrict,
  invoice_id uuid references public.invoices (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  amount numeric(14,2) not null,
  currency_code text not null default 'USD',
  paid_on date not null default current_date,
  method public.payment_method not null default 'EFT/Bank Transfer',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index payments_invoice_idx on public.payments (invoice_id);
create index payments_customer_idx on public.payments (customer_id);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  number text not null,
  customer_id uuid references public.customers (id) on delete restrict,
  customer_name text,
  issue_date date not null default current_date,
  amount numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.credit_note_applications (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.credit_notes (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  amount numeric(14,2) not null
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  vendor text not null,
  category text,
  amount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  currency_code text not null default 'USD',
  spent_on date not null default current_date,
  notes text,
  receipt_data_url text,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  number text not null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  sold_on date not null default current_date,
  method text,
  reference text,
  notes text,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create type public.recurring_cadence as enum ('weekly','monthly','quarterly','yearly','customDays');

create table public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  customer_id uuid references public.customers (id) on delete restrict,
  customer_snapshot jsonb,
  items jsonb not null default '[]',
  cadence public.recurring_cadence not null default 'monthly',
  interval_days integer,
  start_date date not null default current_date,
  end_date date,
  time_of_day text not null default '09:00',
  next_run_at timestamptz,
  last_run_at timestamptz,
  active boolean not null default true,
  auto_send boolean not null default false,
  seq_prefix text default 'INV-',
  next_number integer default 1,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- HRM
-- ---------------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  head text,
  description text,
  color text,
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  -- Links an employee record to a login when one exists; many employees will
  -- not have an account.
  profile_id uuid references public.profiles (id) on delete set null,
  employee_no text,
  name text not null,
  email text,
  phone text,
  department_id uuid references public.departments (id) on delete set null,
  designation text,
  joining_date date,
  salary numeric(14,2),
  status text not null default 'Active',
  date_of_birth date,
  address text,
  marital_status text,
  emergency_contact_name text,
  emergency_contact_phone text,
  national_id text,
  documents jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employees_department_idx on public.employees (department_id);

create type public.leave_status as enum ('Pending','Approved','Rejected');

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  employee_id uuid references public.employees (id) on delete cascade,
  employee_name text,
  department_id uuid references public.departments (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days numeric(5,1) not null default 0,
  reason text,
  status public.leave_status not null default 'Pending',
  manager_note text,
  applied_on timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type text not null,
  balance_days numeric(6,1) not null default 0,
  unique (employee_id, leave_type)
);

create type public.payroll_status as enum ('draft','pending','approved','paid');

create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  employee_id uuid references public.employees (id) on delete cascade,
  employee_name text,
  department text,
  period date,
  basic_salary numeric(14,2) not null default 0,
  -- Itemised, matching PayrollEntry. Totals are derived rather than stored, so
  -- the parts and the total cannot disagree.
  allowances jsonb not null default '{}',
  deductions jsonb not null default '{}',
  overtime jsonb not null default '{}',
  net_salary numeric(14,2) not null default 0,
  payment_date date,
  status public.payroll_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now()
);

create type public.performance_status as enum ('Excellent','Good','Average','Needs Improvement');

create table public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  employee_id uuid references public.employees (id) on delete cascade,
  employee_name text,
  department text,
  rating numeric(3,2) not null default 0,
  goals_completed integer not null default 0,
  total_goals integer not null default 0,
  attendance_pct numeric(5,2) not null default 0,
  productivity_pct numeric(5,2) not null default 0,
  status public.performance_status not null default 'Good',
  review_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  unique (profile_id, work_date)
);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create type public.project_status as enum ('open','in_progress','pending_approval','rejected','closed');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  email text,
  company text,
  phone text,
  status text not null default 'active',
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  description text,
  client_id uuid references public.clients (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  type_key text,
  assigned_to uuid references public.profiles (id) on delete set null,
  status public.project_status not null default 'open',
  start_date date,
  end_date date,
  due_at timestamptz,
  milestones jsonb not null default '[]',
  files jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.task_status as enum ('todo','inprogress','done');

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  assigned_to uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_tasks_project_idx on public.project_tasks (project_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.project_tasks (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  work_date date not null default current_date,
  hours numeric(6,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------

create type public.lead_stage  as enum ('new','contacted','qualified','proposal_sent','won','lost');
create type public.deal_stage  as enum ('negotiation','proposal','review','closed_won','closed_lost');
create type public.task_priority as enum ('low','medium','high');

create table public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  address text,
  contacts jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  stage public.lead_stage not null default 'new',
  source text,
  owner_id uuid references public.profiles (id) on delete set null,
  activities jsonb not null default '[]',
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null,
  crm_customer_id uuid references public.crm_customers (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  value numeric(14,2) not null default 0,
  probability integer not null default 0 check (probability between 0 and 100),
  expected_close date,
  stage public.deal_stage not null default 'negotiation',
  owner_id uuid references public.profiles (id) on delete set null,
  comments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null,
  description text,
  entity_type text,
  entity_legacy_id text,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  priority public.task_priority not null default 'medium',
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------

create type public.ticket_status as enum
  ('open','in_progress','waiting','resolved','pending_approval','closed','rejected');
create type public.ticket_priority as enum ('low','medium','high','urgent');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null,
  description text,
  client_id uuid references public.clients (id) on delete set null,
  requester text,
  department_id uuid references public.departments (id) on delete set null,
  assignee_id uuid references public.profiles (id) on delete set null,
  category text,
  priority public.ticket_priority not null default 'medium',
  status public.ticket_status not null default 'open',
  first_response_at timestamptz,
  resolved_at timestamptz,
  due_at timestamptz,
  comments jsonb not null default '[]',
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tickets_status_idx on public.tickets (status);
create index tickets_assignee_idx on public.tickets (assignee_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'company_settings','customers','products','quotations','invoices',
    'employees','projects','project_tasks','leads','deals','tickets'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Reads require `view` on the owning module; writes require `edit`. Deletes on
-- financial records require `full`, since an invoice is not something an
-- ordinary user should be able to erase.
-- ---------------------------------------------------------------------------

do $$
declare
  spec record;
begin
  for spec in
    select t.tbl::text as tbl, t.module::public.app_module as module from (values
      ('company_settings',      'settings'),
      ('customers',             'accounting'),
      ('products',              'accounting'),
      ('quotations',            'accounting'),
      ('invoices',              'accounting'),
      ('line_items',            'accounting'),
      ('payments',              'accounting'),
      ('credit_notes',          'accounting'),
      ('credit_note_applications','accounting'),
      ('expenses',              'accounting'),
      ('sales',                 'accounting'),
      ('recurring_templates',   'accounting'),
      ('departments',           'hrm.departments'),
      ('employees',             'hrm.employees'),
      ('leave_requests',        'hrm.leave'),
      ('leave_balances',        'hrm.leave'),
      ('payroll_entries',       'hrm.payroll'),
      ('performance_reviews',   'hrm.performance'),
      ('attendance_entries',    'hrm.attendance'),
      ('clients',               'settings'),
      ('projects',              'projects'),
      ('project_tasks',         'projects'),
      ('time_entries',          'projects'),
      ('crm_customers',         'crm'),
      ('leads',                 'crm'),
      ('deals',                 'crm'),
      ('crm_tasks',             'crm'),
      ('tickets',               'support')
    ) as t(tbl, module)
  loop
    execute format('alter table public.%I enable row level security', spec.tbl);

    execute format(
      'create policy %I_read on public.%I for select to authenticated
       using (public.has_access(%L, ''view''))',
      spec.tbl, spec.tbl, spec.module);

    execute format(
      'create policy %I_insert on public.%I for insert to authenticated
       with check (public.has_access(%L, ''edit''))',
      spec.tbl, spec.tbl, spec.module);

    execute format(
      'create policy %I_update on public.%I for update to authenticated
       using (public.has_access(%L, ''edit''))
       with check (public.has_access(%L, ''edit''))',
      spec.tbl, spec.tbl, spec.module, spec.module);

    execute format(
      'create policy %I_delete on public.%I for delete to authenticated
       using (public.has_access(%L, ''full''))',
      spec.tbl, spec.tbl, spec.module);
  end loop;
end $$;
