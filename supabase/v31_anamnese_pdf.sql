-- EsteticPro v31 — Ficha de anamnese personalizada (PDF de referência)
-- Rode uma vez no Supabase → SQL Editor.

create table if not exists public.anamnesis_templates (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  field_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.anamnesis_templates enable row level security;
drop policy if exists "anamnesis_templates_own_data" on public.anamnesis_templates;
create policy "anamnesis_templates_own_data" on public.anamnesis_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anamnesis-files', 'anamnesis-files', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

-- Cada usuária acessa apenas a própria pasta (<user_id>/...)
drop policy if exists "anamnesis_files_select_own" on storage.objects;
create policy "anamnesis_files_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'anamnesis-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "anamnesis_files_insert_own" on storage.objects;
create policy "anamnesis_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'anamnesis-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "anamnesis_files_update_own" on storage.objects;
create policy "anamnesis_files_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'anamnesis-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "anamnesis_files_delete_own" on storage.objects;
create policy "anamnesis_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'anamnesis-files' and (storage.foldername(name))[1] = auth.uid()::text);
