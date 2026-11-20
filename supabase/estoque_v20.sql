-- ============================================================
-- ESTETICPRO V20 — ESTOQUE OPERACIONAL
-- Produtos + entradas + saídas + estoque mínimo + histórico
-- ============================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text,
  brand text,
  unit text not null default 'un',
  stock_quantity numeric(12,3) not null default 0,
  minimum_stock numeric(12,3) not null default 0,
  cost_price numeric(12,2) not null default 0,
  reference_price numeric(12,2) not null default 0,
  supplier text,
  lot text,
  expiry_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_stock_quantity_check check (stock_quantity >= 0),
  constraint products_minimum_stock_check check (minimum_stock >= 0),
  constraint products_cost_price_check check (cost_price >= 0),
  constraint products_reference_price_check check (reference_price >= 0),
  constraint products_name_check check (length(trim(name)) > 0),
  constraint products_unit_check check (unit in ('un','ml','l','g','kg','cx','kit'))
);

create index if not exists products_user_id_idx on public.products(user_id);
create index if not exists products_active_idx on public.products(user_id, active);
create index if not exists products_stock_idx on public.products(user_id, stock_quantity, minimum_stock);
create index if not exists products_expiry_idx on public.products(user_id, expiry_date);

alter table public.products enable row level security;

drop policy if exists "products_own_data" on public.products;
create policy "products_own_data"
on public.products
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ============================================================
-- MOVIMENTAÇÕES
-- ============================================================

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null,
  quantity numeric(12,3) not null,
  unit_cost numeric(12,2) not null default 0,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (movement_type in ('entrada','saida')),
  constraint inventory_movements_quantity_check check (quantity > 0),
  constraint inventory_movements_unit_cost_check check (unit_cost >= 0)
);

create index if not exists inventory_movements_user_id_idx on public.inventory_movements(user_id);
create index if not exists inventory_movements_product_id_idx on public.inventory_movements(product_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists "inventory_movements_select_own" on public.inventory_movements;
create policy "inventory_movements_select_own"
on public.inventory_movements
for select
using (auth.uid() = user_id);

drop policy if exists "inventory_movements_insert_own" on public.inventory_movements;
create policy "inventory_movements_insert_own"
on public.inventory_movements
for insert
with check (auth.uid() = user_id);

-- Não permitimos edição/exclusão de movimentações pela aplicação.
-- O histórico é um livro-caixa operacional: uma movimentação incorreta
-- deve ser compensada por uma nova entrada/saída.

-- ============================================================
-- UPDATED_AT DOS PRODUTOS
-- ============================================================

create or replace function public.touch_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
before update on public.products
for each row
execute function public.touch_products_updated_at();

-- ============================================================
-- APLICA MOVIMENTAÇÃO AO ESTOQUE
-- ============================================================

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_user_id uuid;
  v_current numeric(12,3);
  v_next numeric(12,3);
begin
  select user_id, stock_quantity
    into v_product_user_id, v_current
  from public.products
  where id = new.product_id
  for update;

  if v_product_user_id is null then
    raise exception 'Produto não encontrado.';
  end if;

  if v_product_user_id <> new.user_id then
    raise exception 'O produto não pertence ao usuário autenticado.';
  end if;

  if new.quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  if new.movement_type = 'entrada' then
    v_next := v_current + new.quantity;
  else
    v_next := v_current - new.quantity;
    if v_next < 0 then
      raise exception 'Estoque insuficiente. Estoque atual: %, quantidade solicitada: %.', v_current, new.quantity;
    end if;
  end if;

  update public.products
  set stock_quantity = v_next,
      updated_at = now()
  where id = new.product_id;

  return new;
end;
$$;

drop trigger if exists apply_inventory_movement on public.inventory_movements;
create trigger apply_inventory_movement
after insert on public.inventory_movements
for each row
execute function public.apply_inventory_movement();

-- ============================================================
-- VALIDAÇÃO DE PROPRIEDADE NO BANCO
-- ============================================================

create or replace function public.validate_inventory_movement_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_user_id uuid;
begin
  select user_id into v_product_user_id
  from public.products
  where id = new.product_id;

  if v_product_user_id is null then
    raise exception 'Produto não encontrado.';
  end if;

  if v_product_user_id <> new.user_id then
    raise exception 'A movimentação não pertence ao mesmo usuário do produto.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_inventory_movement_owner on public.inventory_movements;
create trigger validate_inventory_movement_owner
before insert on public.inventory_movements
for each row
execute function public.validate_inventory_movement_owner();

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V20
-- ============================================================
