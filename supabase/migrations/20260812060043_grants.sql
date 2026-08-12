-- Table privileges.
--
-- RLS decides *which rows* a caller may touch, but Postgres still needs a base
-- GRANT before the policies are even consulted. Without these, every query
-- fails with "permission denied for table", which looks like a policy problem
-- but is not one.
--
-- Granting DML broadly to `authenticated` is the intended Supabase pattern:
-- the policies in the previous migration are the actual gate, and they are
-- written to fail closed.

grant usage on schema public to anon, authenticated, service_role;

-- The role catalogue is readable by any signed-in user (the UI shows role
-- names); writes are gated to settings:full by policy.
grant select, insert, update, delete on public.roles to authenticated;
grant select, insert, update, delete on public.role_access to authenticated;

-- Profiles: a user may read and update their own row, and administrators may
-- manage all of them. The update policy prevents self-promotion.
grant select, insert, update, delete on public.profiles to authenticated;

-- Permission helpers are called from policies and from the client.
grant execute on function public.current_role_id() to anon, authenticated;
grant execute on function public.has_access(public.app_module, public.access_level) to anon, authenticated;

-- Anything added by later migrations should default to the same shape.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
