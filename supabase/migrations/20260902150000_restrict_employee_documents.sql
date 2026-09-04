-- Employee documents were readable by every member of staff.
--
-- The storage policies granted a bucket to anyone with `view` on the module
-- that owns it, and employee-documents is owned by hrm.employees — which every
-- employee has, because they need the staff directory. So any employee could
-- list the attachments table, mint a signed link, and download a colleague's ID
-- copy, contract or tax certificate.
--
-- That is a different question from "may you see the staff list". Reading
-- somebody's identity document is an HR action, so it now needs `full` on
-- hrm.employees, which the HR Manager, Company Admin and Super Admin roles have
-- and ordinary employees do not.

create or replace function public.bucket_read_level(p_bucket text)
returns public.access_level
language sql
immutable
as $$
  select case p_bucket
    -- Identity documents, contracts and tax certificates: HR only.
    when 'employee-documents' then 'full'
    else 'view'
  end::public.access_level
$$;

comment on function public.bucket_read_level is
  'The access level required to read a bucket. Most need only view; buckets
   holding personal documents require full, so that module access alone does
   not expose them.';

grant execute on function public.bucket_read_level(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage objects
-- ---------------------------------------------------------------------------

drop policy if exists "read files by module access" on storage.objects;

create policy "read files by module access"
  on storage.objects for select to authenticated
  using (
    public.bucket_module(bucket_id) is not null
    and public.has_access(
      public.bucket_module(bucket_id),
      public.bucket_read_level(bucket_id)
    )
  );

-- ---------------------------------------------------------------------------
-- The attachments index
--
-- Restricting the objects alone is not enough: the index reveals that an
-- employee has a document called "<name> ID copy", and is what a caller reads
-- to find a path to sign in the first place.
-- ---------------------------------------------------------------------------

drop policy if exists attachments_read on public.attachments;

create policy attachments_read on public.attachments
  for select to authenticated
  using (
    public.has_access(
      public.bucket_module(bucket_id),
      public.bucket_read_level(bucket_id)
    )
  );
