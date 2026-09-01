-- Sequential document numbering.
--
-- Invoice, quotation, credit note and sale numbers were generated as
--   `INV-${year}-${Math.floor(Math.random()*9000+1000)}`
-- in seven places. That is neither unique (two documents can draw the same
-- number) nor sequential, and most tax authorities require issued invoices to
-- be numbered sequentially without gaps.
--
-- A Postgres SEQUENCE is deliberately NOT used here: sequences do not roll back,
-- so an aborted transaction would leave a permanent gap. A counter row locked
-- with FOR UPDATE gives true gapless allocation — if the transaction that took
-- a number rolls back, the counter rolls back with it. The cost is that
-- concurrent inserts of the same document type serialise briefly, which is
-- irrelevant at this scale and is the correct trade for a legal requirement.

create table public.document_sequences (
  doc_type text primary key,
  prefix text not null,
  -- When true the number embeds the year and restarts at 1 each January.
  include_year boolean not null default true,
  current_year integer,
  next_number integer not null default 1 check (next_number > 0),
  padding integer not null default 4 check (padding between 1 and 10),
  updated_at timestamptz not null default now()
);

comment on table public.document_sequences is
  'One counter per document type. Allocate through next_document_number();
   never read next_number and write it back from application code.';

insert into public.document_sequences (doc_type, prefix, include_year, padding) values
  ('invoice',     'INV-', true, 4),
  ('quotation',   'Q-',   true, 4),
  ('credit_note', 'CN-',  true, 4),
  ('sale',        'S-',   true, 4);

-- ---------------------------------------------------------------------------
-- Allocation
-- ---------------------------------------------------------------------------

create or replace function public.next_document_number(p_doc_type text)
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
  -- Callers must be able to create the document they are numbering.
  if not public.has_access('accounting', 'edit') then
    raise exception 'insufficient permission to allocate a % number', p_doc_type
      using errcode = '42501';
  end if;

  -- FOR UPDATE serialises concurrent allocation and makes the counter roll
  -- back with the transaction, which is what keeps the series gapless.
  select * into seq
  from public.document_sequences
  where doc_type = p_doc_type
  for update;

  if not found then
    raise exception 'unknown document type: %', p_doc_type using errcode = '22023';
  end if;

  if seq.include_year and seq.current_year is distinct from this_year then
    allocated := 1;                       -- new year, restart the series
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

comment on function public.next_document_number is
  'Allocates the next number for a document type. Call inside the same
   transaction that inserts the document, so an aborted insert returns the
   number rather than burning it.';

-- Lets an import advance a counter past numbers that already exist, so
-- migrated documents cannot be followed by a duplicate.
create or replace function public.reserve_document_number(p_doc_type text, p_used integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.document_sequences
     set next_number = greatest(next_number, p_used + 1),
         updated_at  = now()
   where doc_type = p_doc_type;
$$;

-- ---------------------------------------------------------------------------
-- The database refuses duplicates regardless of how a number was produced
-- ---------------------------------------------------------------------------

create unique index invoices_number_key     on public.invoices     (number);
create unique index quotations_number_key   on public.quotations   (number);
create unique index credit_notes_number_key on public.credit_notes (number);
create unique index sales_number_key        on public.sales        (number);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.document_sequences enable row level security;

create policy document_sequences_read on public.document_sequences
  for select to authenticated
  using (public.has_access('accounting', 'view'));

-- Prefix, padding and year behaviour are configuration; changing the counter
-- itself must go through the allocation functions.
create policy document_sequences_configure on public.document_sequences
  for update to authenticated
  using (public.has_access('settings', 'full'))
  with check (public.has_access('settings', 'full'));

grant select, update on public.document_sequences to authenticated;
grant execute on function public.next_document_number(text) to authenticated;
grant execute on function public.reserve_document_number(text, integer) to authenticated;
