-- Client portal accounts, and a directory the app can actually read.
--
-- Two gaps showed up when the browser was wired to this schema in place of the
-- localStorage auth store.

-- ---------------------------------------------------------------------------
-- 1. Client portal accounts
--
-- A client signs in to see only their own projects and tickets, so their
-- profile has to say which client they are. The old Account type carried a
-- clientId; nothing in the schema did.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists client_id text;

comment on column public.profiles.client_id is
  'For client portal accounts: the customer record this login represents.
   Null for staff.';

create index if not exists profiles_client_id_idx on public.profiles (client_id);

-- A client must not be able to point their own profile at a different client,
-- which would hand them somebody else''s projects. profiles_update_self already
-- pins role_id and status; extend it to client_id.
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role_id is not distinct from (select p.role_id from public.profiles p where p.id = auth.uid())
    and status is not distinct from (select p.status from public.profiles p where p.id = auth.uid())
    and client_id is not distinct from (select p.client_id from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Let staff read the people directory
--
-- profiles_read_all required settings:view, which only administrators have. But
-- ordinary screens name people — a task assignee, a ticket's agent, who applied
-- for leave — so with that policy alone every such name rendered blank for
-- normal users.
--
-- This exposes name, email and role to any signed-in staff member. That is the
-- same directory the old app kept in localStorage, where it was readable by
-- everyone anyway, and it is not sensitive within one company.
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER, like current_role_id(). Reading profiles directly inside a
-- policy *on* profiles recurses: evaluating the policy runs the subquery, which
-- evaluates the policy again. Postgres catches it as "infinite recursion
-- detected in policy for relation profiles".
create or replace function public.current_client_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.client_id from public.profiles p where p.id = auth.uid()
$$;

comment on function public.current_client_id is
  'The customer a client portal login represents, or null for staff.';

grant execute on function public.current_client_id() to authenticated;

create policy profiles_read_directory on public.profiles
  for select to authenticated
  using (
    -- Approved staff only. current_role_id() is null unless the profile is
    -- active with a role, which keeps an account that has merely signed up —
    -- and is still waiting for approval — from reading the staff directory.
    public.current_role_id() is not null
    -- And not a client portal login, which sees only itself via
    -- profiles_read_self.
    and public.current_client_id() is null
  );
