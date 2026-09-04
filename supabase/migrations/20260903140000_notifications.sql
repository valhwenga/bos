-- Notifications went to the sender's own browser.
--
-- `notify(userId, ...)` wrote to localStorage — the localStorage of whoever
-- triggered it. So assigning a CRM task to a colleague filed the notification
-- under your own browser and never reached them; approving a project notified
-- the approver; a ticket assigned to an agent notified whoever changed the
-- status. The bell in the header read `forUser(me)` against that same local
-- store, so it only ever showed notifications you had somehow sent yourself.
--
-- Every recipient's notifications also sat in every sender's browser, which the
-- backup export then serialised: a copy of other people's notifications, on
-- your machine, in a file you could open.

do $$ begin
  create type public.notification_type as enum ('message', 'email', 'ticket');
exception when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  -- Cascade: a notification addressed to a deleted account is not evidence of
  -- anything, unlike an audit entry. Nothing else references it.
  recipient_id uuid not null references public.profiles(id) on delete cascade,

  -- Who caused it. Stamped from the session rather than taken from the request,
  -- so "New message from …" cannot be attributed to somebody who did not send
  -- it. Null for the ones the app raises on a timer.
  actor_id uuid references public.profiles(id) on delete set null,

  type public.notification_type not null default 'message',
  title text not null,
  description text,
  -- An in-app route. Deliberately not a URL: this is rendered as a link the
  -- recipient clicks, and an arbitrary destination arriving from another user
  -- is an open redirect.
  link text,

  -- A timestamp rather than a boolean, because "when did they see it" is worth
  -- more than "have they", and it cannot drift out of sync with itself.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- The sender is stamped, and the link is checked
-- ---------------------------------------------------------------------------

create or replace function public.stamp_notification_actor()
returns trigger
language plpgsql
as $$
begin
  new.actor_id := auth.uid();
  new.created_at := now();
  new.read_at := null;

  -- Only in-app routes. A notification is a link another user gets you to
  -- click, so "https://…" or "javascript:…" arriving here would make the bell
  -- a delivery mechanism for anything.
  --
  -- The second character must not be a slash: "//evil.example/x" is a
  -- protocol-relative URL, and it starts with "/" like a real route does.
  if new.link is not null and new.link !~ '^/([A-Za-z0-9_:.~-][A-Za-z0-9/_:.~?&=%-]*)?$' then
    raise exception 'Notification link must be an in-app path, got %', new.link
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_notification_actor on public.notifications;
create trigger stamp_notification_actor
  before insert on public.notifications
  for each row execute function public.stamp_notification_actor();

-- ---------------------------------------------------------------------------
-- A recipient may mark it read. That is all they may change.
--
-- Without this, "update your own row" lets someone rewrite the title and body
-- of a notification another person sent them, which makes the whole record
-- worthless as a reason for anything that followed.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_only_read_at()
returns trigger
language plpgsql
as $$
begin
  if new.recipient_id is distinct from old.recipient_id
     or new.actor_id is distinct from old.actor_id
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.link is distinct from old.link
     or new.created_at is distinct from old.created_at then
    raise exception 'Only read_at may be changed on a notification'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_only_read_at on public.notifications;
create trigger notifications_only_read_at
  before update on public.notifications
  for each row execute function public.notifications_only_read_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

drop policy if exists notifications_read on public.notifications;
drop policy if exists notifications_insert on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;

-- Yours and nobody else's. Not even an administrator: a notification is
-- correspondence, and the underlying facts are all readable through the ticket
-- or project it points at.
create policy notifications_read on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

-- Anyone signed in may notify anyone. That is what the feature is — assigning
-- work to a colleague has to reach them. It does mean any account can put an
-- entry in any other account's bell; the actor is recorded, so it is
-- attributable rather than anonymous, but it is not rate limited.
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (auth.uid() is not null);

create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Clearing your own bell. The row is gone for good; nothing else reads it.
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (recipient_id = auth.uid());

grant select, insert, update, delete on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Live delivery
--
-- A notification that only appears on the next page load is a to-do list. This
-- publishes the table so a client can subscribe to its own rows and have one
-- arrive while it is sitting on another screen.
-- ---------------------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
