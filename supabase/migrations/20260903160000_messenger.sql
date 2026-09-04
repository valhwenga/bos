-- Messenger: conversations both people can see.
--
-- Messages were localStorage, which for a chat is close to a contradiction.
-- Sending one wrote it to your own browser and nowhere else, so the person you
-- were talking to never received it and you were the only participant in every
-- conversation you had. Starting a group added members who were never told.
--
-- Attachments were base64 data URLs on the message row, inside the same 5MB
-- origin quota as everything else.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  -- Only meaningful for groups. A direct conversation is named by whoever the
  -- other person is, which depends on who is looking.
  name text,
  is_group boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Denormalised so the conversation list can order by recency without
  -- reading every message in every thread.
  last_message_at timestamptz
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- Unread was a per-user counter on the conversation row, which drifts: it
  -- was incremented on send and zeroed on open, so any missed increment was
  -- wrong for good. A high-water mark cannot drift — unread is whatever came
  -- after it.
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);

create index if not exists conversation_members_profile_idx
  on public.conversation_members (profile_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  -- Kept when the account goes, so a thread does not lose half its turns.
  author_id uuid references public.profiles(id) on delete set null,
  body text not null default '',
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Membership, without recursion
--
-- The obvious policy — "you may read a message if you are a member of its
-- conversation" — reads conversation_members, whose own policy reads
-- conversation_members, and Postgres raises 42P17. Security definer runs the
-- lookup with the policy suspended, which is the same shape as
-- current_role_id() in the auth migration.
-- ---------------------------------------------------------------------------

create or replace function public.is_conversation_member(p_conversation uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation
      and profile_id = auth.uid()
  );
$$;

comment on function public.is_conversation_member is
  'Whether the caller is in a conversation. Security definer to keep the
   membership policies from recursing into themselves.';

create or replace function public.is_conversation_creator(p_conversation uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversations
    where id = p_conversation and created_by = auth.uid()
  );
$$;

comment on function public.is_conversation_creator is
  'Whether the caller created a conversation. Security definer for the same
   reason: read access to `conversations` is itself membership-gated, so an
   inline EXISTS against it inside a policy sees nothing.';

-- ---------------------------------------------------------------------------
-- A message stamps its author and bumps the conversation
-- ---------------------------------------------------------------------------

create or replace function public.stamp_message_author()
returns trigger
language plpgsql
as $$
begin
  new.author_id := auth.uid();
  new.created_at := now();

  -- A reply has to belong to the same conversation. Otherwise a message could
  -- quote one from a thread the reader is not in, and the quoted text would be
  -- rendered to them.
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages
    where id = new.reply_to_id and conversation_id = new.conversation_id
  ) then
    raise exception 'A reply must be to a message in the same conversation'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_message_author on public.messages;
create trigger stamp_message_author
  before insert on public.messages
  for each row execute function public.stamp_message_author();

create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists bump_conversation on public.messages;
create trigger bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists conversations_read on public.conversations;
drop policy if exists conversations_insert on public.conversations;
drop policy if exists conversations_update on public.conversations;
drop policy if exists conversation_members_read on public.conversation_members;
drop policy if exists conversation_members_insert on public.conversation_members;
drop policy if exists conversation_members_update on public.conversation_members;
drop policy if exists conversation_members_delete on public.conversation_members;
drop policy if exists messages_read on public.messages;
drop policy if exists messages_insert on public.messages;

-- Conversations you are in. Module access is not enough: `messenger` view is
-- granted broadly, and it would let anyone read every private thread in the
-- company.
create policy conversations_read on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id));

create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (public.has_access('messenger', 'edit') and created_by = auth.uid());

-- Renaming a group. last_message_at is maintained by a security definer
-- trigger, so it does not depend on this.
create policy conversations_update on public.conversations
  for update to authenticated
  using (public.is_conversation_member(id))
  with check (public.is_conversation_member(id));

create policy conversation_members_read on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- Adding people.
--
-- Three ways in, and all three are needed. Adding yourself covers the creator's
-- own first row. Already being a member covers adding somebody later. And
-- having created the conversation covers the initial list: the members are
-- inserted in one statement, every row is checked against the snapshot taken
-- before it ran, and in that snapshot the creator is not yet a member — so
-- without this clause a new conversation could never be given anyone to talk
-- to.
create policy conversation_members_insert on public.conversation_members
  for insert to authenticated
  with check (
    public.has_access('messenger', 'edit')
    and (
      profile_id = auth.uid()
      or public.is_conversation_member(conversation_id)
      or public.is_conversation_creator(conversation_id)
    )
  );

-- Marking your own place in the thread.
create policy conversation_members_update on public.conversation_members
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Leaving. You may remove yourself, not other people.
create policy conversation_members_delete on public.conversation_members
  for delete to authenticated
  using (profile_id = auth.uid());

create policy messages_read on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy messages_insert on public.messages
  for insert to authenticated
  with check (public.is_conversation_member(conversation_id));

-- No update and no delete policy. Editing what you said after somebody has
-- replied to it rewrites their reply's meaning, and this is the record people
-- point at when they disagree about what was agreed.

grant select, insert, update on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Attachments are readable by the conversation, not by the module
--
-- The file_storage migration gates every bucket on module access, so
-- `messenger` view let anyone read every chat attachment in the company —
-- including files sent privately between two other people. Same shape as the
-- leave reasons and employee ID documents narrowed earlier.
--
-- Message attachments are stored under `<conversation_id>/<file>`, so the
-- first path segment is the conversation to check.
-- ---------------------------------------------------------------------------

create or replace function public.storage_conversation_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  head text := split_part(p_name, '/', 1);
begin
  return head::uuid;
exception when others then
  -- Not a conversation-prefixed path. Callers treat null as "no access".
  return null;
end;
$$;

drop policy if exists "read files by module access" on storage.objects;

create policy "read files by module access"
  on storage.objects for select to authenticated
  using (
    public.bucket_module(bucket_id) is not null
    and public.has_access(public.bucket_module(bucket_id), 'view')
    and (
      bucket_id <> 'message-attachments'
      or public.is_conversation_member(public.storage_conversation_id(name))
    )
  );

drop policy if exists "upload files by module access" on storage.objects;

create policy "upload files by module access"
  on storage.objects for insert to authenticated
  with check (
    public.bucket_module(bucket_id) is not null
    and public.has_access(public.bucket_module(bucket_id), 'edit')
    and (
      bucket_id <> 'message-attachments'
      or public.is_conversation_member(public.storage_conversation_id(name))
    )
  );

-- ---------------------------------------------------------------------------
-- Live, or it is email with worse formatting
-- ---------------------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Internal staff can actually message each other
--
-- Enforcing this module for the first time exposed that almost nobody was
-- granted it. Company Admin had `view` — read the messenger, send nothing —
-- and Employee, HR, Finance, Project, Inventory and Support had no row at all.
-- Only Super Admin could send a message. That went unnoticed because
-- localStorage has no permissions: the module gate decided whether the nav
-- item appeared and nothing else, so everyone could use a messenger their role
-- did not grant them.
--
-- Messaging a colleague is a baseline staff capability, and the nav already
-- offers it to anyone with `view`. Granting `edit` to the internal roles makes
-- the two agree. Deliberately not granted: Client, who is external, and Report
-- Viewer, whose whole definition is that they change nothing.
--
-- This is a defaults decision rather than a technical one. The roles editor
-- can change it, and now the change will take effect.
-- ---------------------------------------------------------------------------

insert into public.role_access (role_id, module, level)
select id, 'messenger', 'edit'
from public.roles
where id in (
  'role_company_admin',
  'role_employee',
  'role_hr_manager',
  'role_finance_manager',
  'role_project_manager',
  'role_inventory_manager',
  'role_support_agent'
)
on conflict (role_id, module) do update set level = 'edit'
  where public.role_access.level in ('none', 'view');
