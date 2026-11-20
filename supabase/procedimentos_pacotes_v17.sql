-- ESTETICPRO V17 — PROCEDIMENTOS E PACOTES

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  duration_minutes integer,
  price numeric(12,2) not null default 0 check (price >= 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  total_sessions integer not null default 1 check (total_sessions > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  validity_days integer check (validity_days is null or validity_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  procedure_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid not null references public.service_packages(id) on delete restrict,
  purchased_at date not null default current_date,
  expires_at date,
  total_sessions integer not null check (total_sessions > 0),
  used_sessions integer not null default 0 check (used_sessions >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'ativo' check (status in ('ativo','concluido','expirado','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (used_sessions <= total_sessions)
);

create index if not exists procedures_user_id_idx on public.procedures(user_id);
create index if not exists service_packages_user_id_idx on public.service_packages(user_id);
create index if not exists service_package_items_package_id_idx on public.service_package_items(package_id);
create index if not exists client_packages_user_id_idx on public.client_packages(user_id);
create index if not exists client_packages_client_id_idx on public.client_packages(client_id);

alter table public.procedures enable row level security;
alter table public.service_packages enable row level security;
alter table public.service_package_items enable row level security;
alter table public.client_packages enable row level security;

drop policy if exists "procedures_own_data" on public.procedures;
create policy "procedures_own_data" on public.procedures for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "service_packages_own_data" on public.service_packages;
create policy "service_packages_own_data" on public.service_packages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "service_package_items_own_data" on public.service_package_items;
create policy "service_package_items_own_data" on public.service_package_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "client_packages_own_data" on public.client_packages;
create policy "client_packages_own_data" on public.client_packages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
