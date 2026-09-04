-- Company settings, which every printed and emailed document draws on.
--
-- These were held in localStorage, so the company logo, banking details and
-- currency were set per machine. An invoice sent from a second computer went
-- out with no banking block and the default name, and nobody would notice until
-- a customer asked where to pay.
--
-- Two smaller problems fixed at the same time.

-- ---------------------------------------------------------------------------
-- 1. The currency defaulted to US dollars
--
-- Left over from before the system was reduced to South Africa only. A fresh
-- install printed "$" on every document until somebody changed it.
-- ---------------------------------------------------------------------------

alter table public.company_settings
  alter column currency_code set default 'ZAR',
  alter column currency_symbol set default 'R';

update public.company_settings
set currency_code = 'ZAR', currency_symbol = 'R'
where currency_code = 'USD' and currency_symbol = '$';

-- ---------------------------------------------------------------------------
-- 2. A second settings store
--
-- A separate module kept `name`, `country`, `currencySymbol` and
-- `fiscalYearStart` under a different localStorage key, so payroll and leave
-- read a different company name and currency from the one on the invoices.
-- Folding its one unique field in here lets that store be deleted.
-- ---------------------------------------------------------------------------

alter table public.company_settings
  add column if not exists fiscal_year_start text not null default '03-01';

comment on column public.company_settings.fiscal_year_start is
  'MM-DD. Defaults to 1 March, the start of the South African tax year.';

-- ---------------------------------------------------------------------------
-- Access
--
-- Everyone signed in reads these: the name, logo and banking details appear on
-- documents that ordinary staff produce. Only settings administrators write.
-- ---------------------------------------------------------------------------

drop policy if exists company_settings_read on public.company_settings;
drop policy if exists company_settings_write on public.company_settings;
drop policy if exists company_settings_update on public.company_settings;

create policy company_settings_read on public.company_settings
  for select to authenticated
  using (true);

create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.has_access('settings', 'edit'))
  with check (public.has_access('settings', 'edit'));

-- No insert or delete policy: the check constraint on `id` already allows
-- exactly one row, and it is created with the schema. There is no legitimate
-- reason for the application to add or remove one.

grant select, update on public.company_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The logo has to be readable before sign-in
--
-- It appears on the login page, so it cannot live in a private bucket — there
-- is no session yet to authorise a signed link. company-assets is therefore
-- public to read.
--
-- This is a deliberate trade, not an oversight. The bucket holds the company
-- logo and the signature image that is already printed on every invoice sent to
-- a customer; neither is a secret. Writing is still restricted to settings
-- administrators by the existing policies, so nobody can replace the logo.
-- Nothing else may be put in this bucket.
-- ---------------------------------------------------------------------------

update storage.buckets set public = true where id = 'company-assets';
