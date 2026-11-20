-- ============================================================
-- ESTETICPRO — PERFIL PROFISSIONAL
-- Execute este script no SQL Editor do Supabase.
-- ============================================================

alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists instagram text,
  add column if not exists professional_title text default 'Profissional';

update public.profiles p
set email = coalesce(p.email, u.email),
    professional_title = coalesce(nullif(trim(p.professional_title), ''), 'Profissional')
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do update
  set full_name = case
        when excluded.full_name <> '' then excluded.full_name
        else public.profiles.full_name
      end,
      email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Bucket privado para fotos de perfil.
insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do update set public = false;

-- Cada usuário só pode acessar objetos dentro da própria pasta: {user_id}/...
drop policy if exists "profile_avatars_select_own" on storage.objects;
create policy "profile_avatars_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_avatars_insert_own" on storage.objects;
create policy "profile_avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_avatars_update_own" on storage.objects;
create policy "profile_avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_avatars_delete_own" on storage.objects;
create policy "profile_avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
