-- Link an employee record to the login that belongs to them, and use it to
-- stop leave being readable company-wide.
--
-- Row level security here grants the *module*, not the row: anyone with
-- hrm.leave view could read every leave request and balance through the API,
-- even though the page only ever showed them their own. Leave reasons routinely
-- say why someone is off — a medical appointment, a family bereavement — so
-- this was a real exposure, not a theoretical one.
--
-- The reason it could not simply be tightened before is that "your own rows"
-- had no meaning: `employees.profile_id` existed but nothing populated it, so a
-- stricter policy would have shown every employee nothing at all.

-- ---------------------------------------------------------------------------
-- One login, one employee
-- ---------------------------------------------------------------------------

create unique index if not exists employees_profile_id_key
  on public.employees (profile_id)
  where profile_id is not null;

comment on column public.employees.profile_id is
  'The login that belongs to this employee. Null until an administrator links
   them. Unique: two employee records must not point at the same person, or
   each would show the other their leave.';

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id from public.employees e where e.profile_id = auth.uid()
$$;

comment on function public.current_employee_id is
  'The employee record belonging to the signed-in user, or null when their
   login has not been linked to one. SECURITY DEFINER because it is called from
   policies on tables that reference employees.';

grant execute on function public.current_employee_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Leave requests
--
-- Three ways to see a row, in order of how they are meant to be used:
--
--  1. hrm.leave `full` — HR and managers, who must see everyone's to approve.
--  2. It is your own, via the employee link.
--  3. You submitted it. This covers a person whose login is not linked yet,
--     so rolling this out does not hide people's own requests from them while
--     the linking is still being done.
-- ---------------------------------------------------------------------------

drop policy if exists leave_requests_read on public.leave_requests;

create policy leave_requests_read on public.leave_requests
  for select to authenticated
  using (
    public.has_access('hrm.leave', 'full')
    or (
      public.has_access('hrm.leave', 'view')
      and (
        employee_id = public.current_employee_id()
        or requested_by = auth.uid()
      )
    )
  );

-- Editing a request — approving, rejecting, adding a manager's note — is a
-- decision about somebody's leave and stays with hrm.leave full. An employee
-- with `edit` can still create a request; that is governed by the insert
-- policy, not this one.
drop policy if exists leave_requests_update on public.leave_requests;

create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (
    public.has_access('hrm.leave', 'full')
    or (
      public.has_access('hrm.leave', 'edit')
      and (employee_id = public.current_employee_id() or requested_by = auth.uid())
      -- Only while it is still pending: a request must not be edited after it
      -- has been decided.
      and status = 'Pending'
    )
  )
  with check (
    public.has_access('hrm.leave', 'full')
    or (
      public.has_access('hrm.leave', 'edit')
      and (employee_id = public.current_employee_id() or requested_by = auth.uid())
      and status = 'Pending'
    )
  );

-- ---------------------------------------------------------------------------
-- Leave balances
--
-- No "you submitted it" fallback exists here, so an unlinked employee sees no
-- balance rather than everyone's. That is the safe direction, and the
-- unlinked-employee warning in the app is what prompts someone to fix it.
-- ---------------------------------------------------------------------------

drop policy if exists leave_balances_read on public.leave_balances;

create policy leave_balances_read on public.leave_balances
  for select to authenticated
  using (
    public.has_access('hrm.leave', 'full')
    or (
      public.has_access('hrm.leave', 'view')
      and employee_id = public.current_employee_id()
    )
  );

-- Changing a balance is an HR action. An employee must never be able to credit
-- themselves days, which the old `edit` rule allowed.
drop policy if exists leave_balances_update on public.leave_balances;

create policy leave_balances_update on public.leave_balances
  for update to authenticated
  using (public.has_access('hrm.leave', 'full'))
  with check (public.has_access('hrm.leave', 'full'));

drop policy if exists leave_balances_insert on public.leave_balances;

create policy leave_balances_insert on public.leave_balances
  for insert to authenticated
  with check (public.has_access('hrm.leave', 'full'));
