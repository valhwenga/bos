-- Support: the parts of a ticket the table did not carry, and the settings.

-- ---------------------------------------------------------------------------
-- Ticket closure and approval
--
-- An agent asks for a ticket to be closed and a manager approves or rejects it.
-- The record of who asked, who decided and why is the audit trail for that, so
-- it belongs on the row rather than in a browser.
-- ---------------------------------------------------------------------------

alter table public.tickets
  add column if not exists closure_request jsonb,
  add column if not exists approval jsonb;

-- ---------------------------------------------------------------------------
-- Support settings and canned responses
--
-- Configuration, so a single row like company_settings rather than a table with
-- one entry per user. SLA targets in particular decide when a ticket is
-- overdue: per-machine settings meant two people could disagree about whether
-- the same ticket had breached.
-- ---------------------------------------------------------------------------

create table public.support_settings (
  id boolean primary key default true check (id),
  categories text[] not null default array['General','Technical','Billing','Feature request'],
  -- Hours to first response, by priority.
  sla_low integer not null default 72,
  sla_medium integer not null default 48,
  sla_high integer not null default 24,
  sla_urgent integer not null default 4,
  updated_at timestamptz not null default now()
);

insert into public.support_settings (id) values (true);

alter table public.support_settings enable row level security;

create policy support_settings_read on public.support_settings
  for select to authenticated using (public.has_access('support', 'view'));
create policy support_settings_update on public.support_settings
  for update to authenticated
  using (public.has_access('support', 'full'))
  with check (public.has_access('support', 'full'));

grant select, update on public.support_settings to authenticated;

create table public.canned_responses (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.canned_responses enable row level security;

create policy canned_responses_read on public.canned_responses
  for select to authenticated using (public.has_access('support', 'view'));
create policy canned_responses_write on public.canned_responses
  for all to authenticated
  using (public.has_access('support', 'full'))
  with check (public.has_access('support', 'full'));

grant select, insert, update, delete on public.canned_responses to authenticated;

-- ---------------------------------------------------------------------------
-- Performance reviews: the app keeps a couple of fields the table did not
-- ---------------------------------------------------------------------------

alter table public.performance_reviews
  add column if not exists productivity_pct numeric(5,2);
