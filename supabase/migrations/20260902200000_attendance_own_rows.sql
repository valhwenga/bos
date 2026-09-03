-- Attendance was visible to everyone with the module.
--
-- Row level security granted the module rather than the row, and ordinary
-- employees have hrm.attendance edit because they need to clock themselves in
-- and out. So anyone could read every colleague's arrival and departure times
-- through the API. Knowing when a colleague arrives is a supervision
-- capability, not a peer one.
--
-- This restricts cleanly without needing the employee-to-login link, because
-- attendance is keyed on the profile that clocked in.

drop policy if exists attendance_entries_read on public.attendance_entries;

create policy attendance_entries_read on public.attendance_entries
  for select to authenticated
  using (
    -- HR and managers, who need the whole picture to run attendance.
    public.has_access('hrm.attendance', 'full')
    or profile_id = auth.uid()
  );

-- Clocking in is writing your own row. Recording somebody else's attendance —
-- correcting a missed clock-out, say — is an HR action.
drop policy if exists attendance_entries_insert on public.attendance_entries;

create policy attendance_entries_insert on public.attendance_entries
  for insert to authenticated
  with check (
    public.has_access('hrm.attendance', 'full')
    or (public.has_access('hrm.attendance', 'edit') and profile_id = auth.uid())
  );

drop policy if exists attendance_entries_update on public.attendance_entries;

create policy attendance_entries_update on public.attendance_entries
  for update to authenticated
  using (
    public.has_access('hrm.attendance', 'full')
    or (public.has_access('hrm.attendance', 'edit') and profile_id = auth.uid())
  )
  with check (
    public.has_access('hrm.attendance', 'full')
    or (public.has_access('hrm.attendance', 'edit') and profile_id = auth.uid())
  );

-- One row per person per day, so clocking in twice cannot open a second day and
-- a race between two tabs resolves rather than duplicating.
create unique index if not exists attendance_entries_profile_date_key
  on public.attendance_entries (profile_id, work_date)
  where profile_id is not null;
