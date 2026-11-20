-- ============================================================
-- ESTETICPRO V19.2
-- PACOTES: VÍNCULO SIMPLIFICADO COM CLIENTE
-- ============================================================

alter table public.client_packages
  add column if not exists package_id uuid;

alter table public.client_packages
  add column if not exists purchased_at date not null default current_date;

alter table public.client_packages
  add column if not exists expires_at date;

alter table public.client_packages
  add column if not exists total_sessions integer not null default 1;

alter table public.client_packages
  add column if not exists used_sessions integer not null default 0;

alter table public.client_packages
  add column if not exists amount numeric(12,2) not null default 0;

alter table public.client_packages
  add column if not exists status text not null default 'ativo';

alter table public.client_packages
  add column if not exists notes text;

-- Garante que o pacote contratado aponta para o catálogo.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_packages_package_id_fkey'
      and conrelid = 'public.client_packages'::regclass
  ) then
    alter table public.client_packages
      add constraint client_packages_package_id_fkey
      foreign key (package_id)
      references public.service_packages(id)
      on delete restrict;
  end if;
end $$;

-- Garante valores válidos.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'client_packages_sessions_check_v192'
      and conrelid = 'public.client_packages'::regclass
  ) then
    alter table public.client_packages
      add constraint client_packages_sessions_check_v192
      check (total_sessions > 0 and used_sessions >= 0 and used_sessions <= total_sessions);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'client_packages_status_check_v192'
      and conrelid = 'public.client_packages'::regclass
  ) then
    alter table public.client_packages
      add constraint client_packages_status_check_v192
      check (status in ('ativo','concluido','expirado','cancelado'));
  end if;
end $$;

create index if not exists client_packages_package_id_idx
  on public.client_packages(package_id);

create index if not exists client_packages_client_status_idx
  on public.client_packages(client_id, status);

alter table public.client_packages enable row level security;

drop policy if exists "client_packages_own_data" on public.client_packages;
create policy "client_packages_own_data"
on public.client_packages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V19.2
-- ============================================================
