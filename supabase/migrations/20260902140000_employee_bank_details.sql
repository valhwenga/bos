-- Employee bank details.
--
-- Payroll could compute a net salary but had nowhere to record where to send
-- it, so the bank export filled every field with zeros. That was caught and the
-- export now refuses to build a file, but refusing is not working — nobody can
-- be paid from this system until these exist.
--
-- South African layout: a six-digit branch code and an account number. Sort
-- codes and routing numbers belong to other countries and are not collected.

-- ---------------------------------------------------------------------------
-- A separate table, not columns on `employees`
--
-- Row level security in Postgres is per row, not per column. Anyone with
-- hrm.employees can read the staff directory, and bank details must not come
-- with it — knowing where a colleague's salary is paid is payroll business.
--
-- Putting them in their own table is what makes that expressible: the directory
-- keeps its existing policy, and this table is restricted to payroll. The
-- alternative — restricting `employees` itself and exposing a view — would have
-- broken every other read of that table, including an employee resolving their
-- own record to book leave.
-- ---------------------------------------------------------------------------

create table public.employee_bank_details (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  bank_name text,
  branch_code text,
  -- Text, not numeric: account numbers have leading zeros that a numeric type
  -- would silently drop, which sends the payment to a different account.
  account_number text,
  account_type text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.employee_bank_details is
  'Where each employee is paid. Separate from employees so that the staff
   directory can be readable without exposing banking information.';

comment on column public.employee_bank_details.branch_code is
  'Six-digit South African branch code. Universal branch codes are common, so
   this is often identical across employees at the same bank.';

alter table public.employee_bank_details enable row level security;

-- Reading requires payroll access, not merely employee access.
create policy employee_bank_read on public.employee_bank_details
  for select to authenticated
  using (public.has_access('hrm.payroll', 'view'));

create policy employee_bank_write on public.employee_bank_details
  for insert to authenticated
  with check (public.has_access('hrm.payroll', 'edit'));

create policy employee_bank_update on public.employee_bank_details
  for update to authenticated
  using (public.has_access('hrm.payroll', 'edit'))
  with check (public.has_access('hrm.payroll', 'edit'));

-- Deleting banking details is how a payment gets misdirected or an audit trail
-- disappears, so it needs full payroll rights.
create policy employee_bank_delete on public.employee_bank_details
  for delete to authenticated
  using (public.has_access('hrm.payroll', 'full'));

grant select, insert, update, delete on public.employee_bank_details to authenticated;

create trigger employee_bank_details_touch_updated_at
  before update on public.employee_bank_details
  for each row execute function public.touch_updated_at();
