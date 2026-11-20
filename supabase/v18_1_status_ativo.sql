-- ============================================================
-- ESTETICPRO V18.1
-- STATUS ATIVO/INATIVO PARA CLIENTES, PROCEDIMENTOS E PACOTES
-- E COMPATIBILIDADE PARA PACOTES EXISTENTES
-- ============================================================

-- ============================================================
-- 1. CLIENTES: adicionar status ativo/inativo sem apagar histórico
-- ============================================================

alter table public.clients
  add column if not exists active boolean not null default true;

update public.clients
set active = true
where active is null;

create index if not exists clients_active_idx
  on public.clients(active);

-- ============================================================
-- 2. PROCEDIMENTOS: garantir status
-- ============================================================

alter table public.procedures
  add column if not exists active boolean not null default true;

update public.procedures
set active = true
where active is null;

create index if not exists procedures_active_idx
  on public.procedures(active);

-- ============================================================
-- 3. PACOTES: garantir status
-- ============================================================

alter table public.service_packages
  add column if not exists active boolean not null default true;

update public.service_packages
set active = true
where active is null;

create index if not exists service_packages_active_idx
  on public.service_packages(active);

-- ============================================================
-- 4. COMPATIBILIDADE DOS PACOTES DA CLIENTE
-- ============================================================
-- Garante que pacotes já vinculados continuem com seus dados.

alter table public.client_packages
  add column if not exists used_sessions integer not null default 0;

alter table public.client_packages
  add column if not exists amount numeric(12,2) not null default 0;

do $$
begin
  if to_regclass('public.client_package_usages') is not null then
    execute $fn$
      update public.client_packages cp
      set used_sessions = coalesce((
        select count(*)::integer
        from public.client_package_usages cpu
        where cpu.client_package_id = cp.id
      ), 0)
    $fn$;
  else
    update public.client_packages
    set used_sessions = coalesce(used_sessions, 0);
  end if;
end $$;

-- Se amount ainda estiver zerado, aproveita o valor antigo do pacote.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'client_packages'
      and column_name = 'total_price'
  ) then
    execute $fn$
      update public.client_packages
      set amount = coalesce(nullif(amount, 0), total_price, 0)
      where amount = 0
    $fn$;
  end if;
end $$;

-- ============================================================
-- 5. RECARREGAR CACHE DO POSTGREST
-- ============================================================

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V18.1
-- ============================================================
