-- The roles editor edited a copy nobody enforced.
--
-- `roles` and `role_access` have driven `has_access()`, and therefore every row
-- level security policy in this database, since the auth migration. The screen
-- at /users/role wrote to a localStorage key instead, so an administrator could
-- spend an afternoon adjusting permissions and change nothing at all — and the
-- matrix they were reading was the seed data, not what the server was actually
-- enforcing.
--
-- Pointing the editor at these tables is a client change. What it needs from
-- the database is protection against the three ways a permissions editor can
-- lock everyone out of the building.

-- ---------------------------------------------------------------------------
-- 1. The built-in roles cannot be deleted
--
-- The screen offered a delete button on every row, Super Admin included.
-- `profiles.role_id` is ON DELETE SET NULL, so deleting a role in use would
-- quietly strip the role from everyone who held it — they would still be able
-- to sign in, and would then find every module empty with nothing to explain
-- why.
-- ---------------------------------------------------------------------------

drop policy if exists roles_write on public.roles;
drop policy if exists roles_insert on public.roles;
drop policy if exists roles_update on public.roles;
drop policy if exists roles_delete on public.roles;

-- Split the old blanket policy: insert and update stay open to settings:full,
-- delete additionally refuses the roles the system ships with.
create policy roles_insert on public.roles
  for insert to authenticated
  with check (public.has_access('settings', 'full'));

create policy roles_update on public.roles
  for update to authenticated
  using (public.has_access('settings', 'full'))
  with check (public.has_access('settings', 'full'));

create policy roles_delete on public.roles
  for delete to authenticated
  using (public.has_access('settings', 'full') and not is_system);

-- ---------------------------------------------------------------------------
-- 2. A role still assigned to somebody cannot be deleted
--
-- Row level security can only filter rows, so a delete that policy refuses
-- reports success having done nothing. This raises instead, which the client
-- can show to the person who asked for it.
-- ---------------------------------------------------------------------------

create or replace function public.refuse_delete_role_in_use()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  holders integer;
begin
  select count(*) into holders from public.profiles where role_id = old.id;
  if holders > 0 then
    raise exception
      'Role % is still assigned to % %', old.name, holders,
      case when holders = 1 then 'person' else 'people' end
      using errcode = 'restrict_violation',
            hint = 'Move them to another role first.';
  end if;
  return old;
end;
$$;

drop trigger if exists refuse_delete_role_in_use on public.roles;
create trigger refuse_delete_role_in_use
  before delete on public.roles
  for each row execute function public.refuse_delete_role_in_use();

-- ---------------------------------------------------------------------------
-- WhatsApp is gone from the application
--
-- The module rows are orphans now. The value stays in the app_module enum:
-- removing it means recreating the type, which means dropping has_access() and
-- with it every policy in this database that calls it. That is a great deal of
-- risk to retire one unused label.
-- ---------------------------------------------------------------------------

-- Dropped first so this stays safe to re-run after a partial apply: the guard
-- installed below would otherwise refuse the Super Admin's own whatsapp row.
drop trigger if exists refuse_delete_super_admin_access on public.role_access;

delete from public.role_access where module = 'whatsapp';

-- ---------------------------------------------------------------------------
-- 3. Super Admin keeps full access to everything
--
-- This is the break-glass role. Saving the access matrix with a mistake in it
-- would otherwise be unrecoverable from inside the app: nobody could reach
-- settings to put it back. The client used to force this on read, which meant
-- the screen showed full access while the database was enforcing whatever had
-- been saved. Enforcing it here makes the two agree.
-- ---------------------------------------------------------------------------

create or replace function public.super_admin_keeps_full_access()
returns trigger
language plpgsql
as $$
begin
  if new.role_id = 'role_super_admin' then
    new.level := 'full';
  end if;
  return new;
end;
$$;

drop trigger if exists super_admin_keeps_full_access on public.role_access;
create trigger super_admin_keeps_full_access
  before insert or update on public.role_access
  for each row execute function public.super_admin_keeps_full_access();

-- Deleting the row is the other way to take the access away.
create or replace function public.refuse_delete_super_admin_access()
returns trigger
language plpgsql
as $$
begin
  if old.role_id = 'role_super_admin' then
    raise exception 'Super Admin keeps full access to every module'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists refuse_delete_super_admin_access on public.role_access;
create trigger refuse_delete_super_admin_access
  before delete on public.role_access
  for each row execute function public.refuse_delete_super_admin_access();

-- Bring the existing rows in line with the rule now enforced above.
update public.role_access set level = 'full' where role_id = 'role_super_admin';

insert into public.role_access (role_id, module, level)
select 'role_super_admin', m, 'full'
from unnest(enum_range(null::app_module)) as m
where m <> 'whatsapp'
on conflict (role_id, module) do update set level = 'full';
