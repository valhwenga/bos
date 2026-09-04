-- Server-side generation of recurring invoices.
--
-- This previously ran as a setInterval in the React app, matching templates
-- whose nextRunAt fell within a +/- 60 second window of the tick. That has two
-- failure modes, both of which lose revenue silently:
--
--   1. Nothing runs unless somebody has the app open. Invoices due overnight,
--      at a weekend, or over a holiday are simply not raised.
--   2. Because the match is a 60 second window rather than "is it due yet",
--      a missed window is missed permanently — the template's nextRunAt still
--      advances on the next successful tick, so the skipped period is never
--      billed.
--
-- Moving this into the database fixes both: the job runs whether or not anyone
-- is signed in, and it generates every occurrence that is due rather than only
-- one that happens to land on the current minute.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Run log, so a failed or skipped generation is visible rather than silent
-- ---------------------------------------------------------------------------

create table public.recurring_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.recurring_templates (id) on delete cascade,
  ran_at timestamptz not null default now(),
  due_at timestamptz,
  invoice_id uuid references public.invoices (id) on delete set null,
  status text not null check (status in ('generated','skipped','failed')),
  detail text
);

create index recurring_runs_template_idx on public.recurring_runs (template_id, ran_at desc);

comment on table public.recurring_runs is
  'One row per generation attempt. The browser-based scheduler kept no record,
   so a template that stopped producing invoices did so invisibly.';

-- ---------------------------------------------------------------------------
-- Advance a schedule
-- ---------------------------------------------------------------------------

create or replace function public.recurring_next_run(
  p_from timestamptz,
  p_cadence public.recurring_cadence,
  p_interval_days integer
)
returns timestamptz
language sql
immutable
as $$
  select case p_cadence
    when 'weekly'     then p_from + interval '1 week'
    when 'monthly'    then p_from + interval '1 month'
    when 'quarterly'  then p_from + interval '3 months'
    when 'yearly'     then p_from + interval '1 year'
    when 'customDays' then p_from + make_interval(days => greatest(coalesce(p_interval_days, 1), 1))
  end
$$;

-- ---------------------------------------------------------------------------
-- Generate everything that is due
-- ---------------------------------------------------------------------------

create or replace function public.generate_due_recurring_invoices(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tpl public.recurring_templates%rowtype;
  new_invoice_id uuid;
  new_number text;
  item jsonb;
  guard integer;
  created integer := 0;
begin
  for tpl in
    select * from public.recurring_templates
    where active
      and next_run_at is not null
      and next_run_at <= p_now
      and (end_date is null or next_run_at::date <= end_date)
    -- Locked so a manual call and the cron job cannot bill the same template
    -- twice at the same moment.
    for update skip locked
  loop
    -- A template dormant for months should catch up, but a misconfigured one
    -- (say customDays = 1 left unrun for a year) must not emit hundreds of
    -- invoices unattended. Cap each pass and let the next run continue.
    guard := 0;

    while tpl.next_run_at is not null
      and tpl.next_run_at <= p_now
      and (tpl.end_date is null or tpl.next_run_at::date <= tpl.end_date)
      and guard < 12
    loop
      guard := guard + 1;

      begin
        new_number := public.allocate_number_unchecked('invoice');

        insert into public.invoices (
          number, customer_id, customer_snapshot, status,
          issue_date, due_date, notes
        )
        values (
          new_number, tpl.customer_id, tpl.customer_snapshot, 'sent',
          tpl.next_run_at::date, (tpl.next_run_at + interval '30 days')::date,
          tpl.notes
        )
        returning id into new_invoice_id;

        -- Line items are stored on the template as JSON; expand them into rows
        -- so the generated invoice matches a hand-created one.
        for item in select * from jsonb_array_elements(coalesce(tpl.items, '[]'::jsonb))
        loop
          insert into public.line_items (invoice_id, name, description, qty, price)
          values (
            new_invoice_id,
            coalesce(item ->> 'name', 'Item'),
            item ->> 'description',
            coalesce((item ->> 'qty')::numeric, 1),
            coalesce((item ->> 'price')::numeric, 0)
          );
        end loop;

        insert into public.recurring_runs (template_id, due_at, invoice_id, status, detail)
        values (tpl.id, tpl.next_run_at, new_invoice_id, 'generated', new_number);

        created := created + 1;

      exception when others then
        -- One broken template must not stop the rest from billing.
        insert into public.recurring_runs (template_id, due_at, status, detail)
        values (tpl.id, tpl.next_run_at, 'failed', sqlerrm);
      end;

      tpl.next_run_at := public.recurring_next_run(
        tpl.next_run_at, tpl.cadence, tpl.interval_days
      );
    end loop;

    update public.recurring_templates
       set next_run_at = tpl.next_run_at,
           last_run_at = p_now
     where id = tpl.id;
  end loop;

  return created;
end;
$$;

comment on function public.generate_due_recurring_invoices is
  'Generates every occurrence a template owes, not just one landing on the
   current minute. Safe to run repeatedly; catches up after downtime.';

-- The generator runs as the cron job with no JWT, so it cannot use
-- next_document_number(), which requires accounting:edit. This variant does the
-- same allocation without the permission check and is not granted to clients.
create or replace function public.allocate_number_unchecked(p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq public.document_sequences%rowtype;
  this_year integer := extract(year from current_date)::integer;
  allocated integer;
begin
  select * into seq from public.document_sequences where doc_type = p_doc_type for update;
  if not found then
    raise exception 'unknown document type: %', p_doc_type;
  end if;

  if seq.include_year and seq.current_year is distinct from this_year then
    allocated := 1;
  else
    allocated := seq.next_number;
  end if;

  update public.document_sequences
     set next_number  = allocated + 1,
         current_year = case when include_year then this_year else current_year end,
         updated_at   = now()
   where doc_type = p_doc_type;

  return seq.prefix
      || case when seq.include_year then this_year::text || '-' else '' end
      || lpad(allocated::text, seq.padding, '0');
end;
$$;

revoke all on function public.allocate_number_unchecked(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------

-- Hourly rather than every minute: templates are billed daily at the earliest,
-- and the function generates whatever is due rather than needing to catch an
-- exact moment.
select cron.schedule(
  'generate-recurring-invoices',
  '5 * * * *',
  $$select public.generate_due_recurring_invoices();$$
);

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------

alter table public.recurring_runs enable row level security;

create policy recurring_runs_read on public.recurring_runs
  for select to authenticated
  using (public.has_access('accounting', 'view'));

grant select on public.recurring_runs to authenticated;
