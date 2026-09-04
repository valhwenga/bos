-- Expenses defaulted to USD.
--
-- Left over from before the system was reduced to South Africa only. An expense
-- saved without an explicit currency was recorded as dollars and then totalled
-- alongside rands, which quietly overstates or understates every expense report
-- it appears in.

alter table public.expenses
  alter column currency_code set default 'ZAR';

-- Existing rows that took the old default. There is no way to tell a row that
-- was genuinely in dollars from one that merely took the default, so this is
-- only safe because the system has never supported entering a currency per
-- expense — the field has always come from company settings.
update public.expenses
set currency_code = 'ZAR'
where currency_code = 'USD';
