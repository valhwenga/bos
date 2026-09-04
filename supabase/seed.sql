-- Local development seed. Runs on `supabase db reset`.
--
-- These credentials are for the local Docker database only. They are not used
-- by, and must never be created on, a hosted project — real accounts are
-- created through sign-up and approved by an administrator.

-- The token columns are set to '' rather than left NULL: GoTrue scans them
-- into Go strings, and a NULL fails with "converting NULL to string is
-- unsupported", which surfaces as a 500 on every sign-in attempt.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token
)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@local.test',
   crypt('password123', gen_salt('bf')), now(), '{"name":"Local Admin"}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),

  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'manager@local.test',
   crypt('password123', gen_salt('bf')), now(), '{"name":"Office Manager"}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),

  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'employee@local.test',
   crypt('password123', gen_salt('bf')), now(), '{"name":"Sales Employee"}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),

  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'viewer@local.test',
   crypt('password123', gen_salt('bf')), now(), '{"name":"Report Viewer"}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),

  -- Left unapproved on purpose, so the pending-approval flow has something to
  -- act on and so "role assigned but not approved" stays covered.
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pending@local.test',
   crypt('password123', gen_salt('bf')), now(), '{"name":"Awaiting Approval"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- The on_auth_user_created trigger has already made a pending profile for each
-- of the above; assign roles and approve all but the pending one.
update public.profiles set role_id = 'role_super_admin',   status = 'active'  where email = 'admin@local.test';
update public.profiles set role_id = 'role_company_admin', status = 'active'  where email = 'manager@local.test';
update public.profiles set role_id = 'role_employee',      status = 'active'  where email = 'employee@local.test';
update public.profiles set role_id = 'role_viewer',        status = 'active'  where email = 'viewer@local.test';
update public.profiles set                                 status = 'pending' where email = 'pending@local.test';

-- Password sign-in also needs an identity row per user. Without one GoTrue
-- rejects the credentials as invalid even though the hash matches, which looks
-- exactly like a wrong password.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@local.test'
on conflict (provider, provider_id) do nothing;
