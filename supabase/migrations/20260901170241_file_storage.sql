-- Object storage for uploaded files.
--
-- Attachments were held as base64 data URLs inside localStorage: employee CVs
-- and ID copies, expense receipts, project files, ticket and lead attachments,
-- chat and email attachments, plus the company logo and signature.
--
-- Two problems with that. Base64 inflates a file by about a third, and the
-- whole store is capped near 5MB — a handful of scanned IDs exhausts it. When
-- it fills, some stores throw QuotaExceededError and lose the save outright
-- while others swallow the error, so the upload silently disappears.
--
-- Files now live in storage buckets and the database keeps a path. Buckets are
-- private; access is decided by the same has_access() the rest of the schema
-- uses, so a file is readable exactly when its module is.

-- ---------------------------------------------------------------------------
-- Buckets, one per module so access maps cleanly onto permissions
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('employee-documents', 'employee-documents', false, 10485760,
     array['application/pdf','image/png','image/jpeg','image/webp',
           'application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('expense-receipts',   'expense-receipts',   false,  5242880,
     array['application/pdf','image/png','image/jpeg','image/webp']),
  ('project-files',      'project-files',      false, 26214400, null),
  ('ticket-attachments', 'ticket-attachments', false, 10485760, null),
  ('lead-attachments',   'lead-attachments',   false, 10485760, null),
  ('message-attachments','message-attachments',false, 10485760, null),
  ('company-assets',     'company-assets',     false,  2097152,
     array['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do nothing;

-- Note: file_size_limit is enforced by storage itself. localStorage could not
-- do that — an oversized upload was only discovered when the whole store blew
-- its quota, taking unrelated data with it.

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

create or replace function public.bucket_module(p_bucket text)
returns public.app_module
language sql
immutable
as $$
  select case p_bucket
    when 'employee-documents'  then 'hrm.employees'
    when 'expense-receipts'    then 'accounting'
    when 'project-files'       then 'projects'
    when 'ticket-attachments'  then 'support'
    when 'lead-attachments'    then 'crm'
    when 'message-attachments' then 'messenger'
    when 'company-assets'      then 'settings'
  end::public.app_module
$$;

comment on function public.bucket_module is
  'Maps a bucket to the module that governs it, so storage access and table
   access cannot drift apart.';

-- Reading a file needs `view` on the owning module.
create policy "read files by module access"
  on storage.objects for select to authenticated
  using (
    public.bucket_module(bucket_id) is not null
    and public.has_access(public.bucket_module(bucket_id), 'view')
  );

-- Uploading and replacing need `edit`.
create policy "upload files by module access"
  on storage.objects for insert to authenticated
  with check (
    public.bucket_module(bucket_id) is not null
    and public.has_access(public.bucket_module(bucket_id), 'edit')
  );

create policy "update files by module access"
  on storage.objects for update to authenticated
  using (
    public.bucket_module(bucket_id) is not null
    and public.has_access(public.bucket_module(bucket_id), 'edit')
  );

-- Deleting a stored document needs `full`, matching the rule that an ordinary
-- user should not be able to erase a financial or HR record.
create policy "delete files by module access"
  on storage.objects for delete to authenticated
  using (
    public.bucket_module(bucket_id) is not null
    and public.has_access(public.bucket_module(bucket_id), 'full')
  );

-- ---------------------------------------------------------------------------
-- Attachment references
--
-- One table rather than a jsonb column per parent, so a file can be found and
-- cleaned up without knowing which module put it there.
-- ---------------------------------------------------------------------------

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  -- What the file belongs to. Kept loose because the owning row may be created
  -- after the upload (a file attached while a ticket is still being drafted).
  owner_table text,
  owner_id uuid,
  -- Distinguishes an employee's CV from their ID copy, and so on.
  purpose text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket_id, storage_path)
);

create index attachments_owner_idx on public.attachments (owner_table, owner_id);
create index attachments_purpose_idx on public.attachments (owner_id, purpose);

alter table public.attachments enable row level security;

create policy attachments_read on public.attachments
  for select to authenticated
  using (public.has_access(public.bucket_module(bucket_id), 'view'));

create policy attachments_write on public.attachments
  for insert to authenticated
  with check (public.has_access(public.bucket_module(bucket_id), 'edit'));

create policy attachments_update on public.attachments
  for update to authenticated
  using (public.has_access(public.bucket_module(bucket_id), 'edit'))
  with check (public.has_access(public.bucket_module(bucket_id), 'edit'));

create policy attachments_delete on public.attachments
  for delete to authenticated
  using (public.has_access(public.bucket_module(bucket_id), 'full'));

grant select, insert, update, delete on public.attachments to authenticated;
grant execute on function public.bucket_module(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Replace the jsonb blob columns with references
-- ---------------------------------------------------------------------------

-- These held arrays of base64 data URLs. Files live in storage now; the
-- attachments table records where.
alter table public.employees drop column if exists documents;
alter table public.projects  drop column if exists files;
alter table public.tickets   drop column if exists attachments;
alter table public.leads     drop column if exists attachments;

alter table public.expenses drop column if exists receipt_data_url;

-- Company logo and signature are single files, so a direct path is simpler
-- than a join.
alter table public.company_settings
  drop column if exists logo_data_url,
  drop column if exists signature_data_url,
  add column if not exists logo_path text,
  add column if not exists signature_path text;
