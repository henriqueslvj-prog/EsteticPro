-- ============================================================
-- ESTETICPRO V24 — CONFIGURAÇÕES
-- Dados do espaço + preferências do usuário
-- ============================================================

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  business_name text,
  description text,
  phone text,
  whatsapp text,
  instagram text,
  address text,
  city text,
  state text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_settings_user_id_idx
  on public.business_settings(user_id);

alter table public.business_settings enable row level security;
drop policy if exists "business_settings_own_data" on public.business_settings;
create policy "business_settings_own_data"
on public.business_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_business_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_settings_updated_at on public.business_settings;
create trigger business_settings_updated_at
before update on public.business_settings
for each row execute function public.touch_business_settings_updated_at();

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  week_start integer not null default 1 check (week_start in (0,1)),
  work_start time not null default '08:00',
  work_end time not null default '18:00',
  default_slot_minutes integer not null default 30 check (default_slot_minutes in (15,30,45,60)),
  min_booking_hours integer not null default 2 check (min_booking_hours >= 0 and min_booking_hours <= 168),
  show_weekends boolean not null default true,
  auto_stock_consumption boolean not null default true,
  require_payment_confirmation boolean not null default true,
  allow_unpaid_completion boolean not null default true,
  currency text not null default 'BRL' check (currency in ('BRL','USD')),
  theme text not null default 'light' check (theme in ('dark','light')),
  document_footer text,
  anamnesis_consent_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_settings_user_id_idx
  on public.user_settings(user_id);

alter table public.user_settings enable row level security;
drop policy if exists "user_settings_own_data" on public.user_settings;
create policy "user_settings_own_data"
on public.user_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_user_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at
before update on public.user_settings
for each row execute function public.touch_user_settings_updated_at();

-- Bucket privado para a logo do espaço.
insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', false)
on conflict (id) do update set public = false;

drop policy if exists "business_assets_select_own" on storage.objects;
create policy "business_assets_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "business_assets_insert_own" on storage.objects;
create policy "business_assets_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "business_assets_update_own" on storage.objects;
create policy "business_assets_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "business_assets_delete_own" on storage.objects;
create policy "business_assets_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
