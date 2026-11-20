-- ============================================================
-- ESTETICPRO V21 — ESTOQUE INTEGRADO AOS PROCEDIMENTOS
-- Composição de produtos + consumo automático no atendimento
-- ============================================================

alter table public.inventory_movements
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

create index if not exists inventory_movements_appointment_id_idx
  on public.inventory_movements(appointment_id);

create table if not exists public.procedure_inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procedure_inventory_items_unique unique (procedure_id, product_id)
);

create index if not exists procedure_inventory_items_user_id_idx
  on public.procedure_inventory_items(user_id);
create index if not exists procedure_inventory_items_procedure_id_idx
  on public.procedure_inventory_items(procedure_id);
create index if not exists procedure_inventory_items_product_id_idx
  on public.procedure_inventory_items(product_id);

alter table public.procedure_inventory_items enable row level security;

drop policy if exists "procedure_inventory_items_own_data"
on public.procedure_inventory_items;
create policy "procedure_inventory_items_own_data"
on public.procedure_inventory_items
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.validate_procedure_inventory_item_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_procedure_user uuid;
  v_product_user uuid;
begin
  select user_id into v_procedure_user from public.procedures where id = new.procedure_id;
  select user_id into v_product_user from public.products where id = new.product_id;
  if v_procedure_user is null then raise exception 'Procedimento não encontrado.'; end if;
  if v_product_user is null then raise exception 'Produto não encontrado.'; end if;
  if v_procedure_user <> new.user_id or v_product_user <> new.user_id then
    raise exception 'Procedimento e produto devem pertencer ao mesmo usuário.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_procedure_inventory_item_owner
on public.procedure_inventory_items;
create trigger validate_procedure_inventory_item_owner
before insert or update on public.procedure_inventory_items
for each row execute function public.validate_procedure_inventory_item_owner();

create or replace function public.touch_procedure_inventory_items_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists procedure_inventory_items_updated_at
on public.procedure_inventory_items;
create trigger procedure_inventory_items_updated_at
before update on public.procedure_inventory_items
for each row execute function public.touch_procedure_inventory_items_updated_at();

create table if not exists public.appointment_inventory_consumptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  movement_id uuid references public.inventory_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint appointment_inventory_consumptions_unique unique (appointment_id, product_id)
);

create index if not exists appointment_inventory_consumptions_user_id_idx
  on public.appointment_inventory_consumptions(user_id);
create index if not exists appointment_inventory_consumptions_appointment_id_idx
  on public.appointment_inventory_consumptions(appointment_id);

alter table public.appointment_inventory_consumptions enable row level security;
drop policy if exists "appointment_inventory_consumptions_own_data"
on public.appointment_inventory_consumptions;
create policy "appointment_inventory_consumptions_own_data"
on public.appointment_inventory_consumptions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.consume_inventory_for_appointment(p_appointment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_count integer := 0;
  v_item record;
  v_stock numeric(12,3);
  v_movement_id uuid;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id and user_id = v_user;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_appointment.procedure_id is null then return 0; end if;

  if exists (select 1 from public.appointment_inventory_consumptions where appointment_id = p_appointment_id and user_id = v_user) then
    select count(*)::integer into v_count from public.appointment_inventory_consumptions where appointment_id = p_appointment_id and user_id = v_user;
    return v_count;
  end if;

  -- Primeiro valida todo o estoque para evitar consumo parcial.
  for v_item in
    select pii.product_id, pii.quantity, p.name, p.unit, p.stock_quantity
    from public.procedure_inventory_items pii
    join public.products p on p.id = pii.product_id
    where pii.procedure_id = v_appointment.procedure_id
      and pii.user_id = v_user
      and p.active = true
    order by pii.product_id
  loop
    if v_item.stock_quantity < v_item.quantity then
      raise exception 'Estoque insuficiente para %. Disponível: %, necessário: % %.', v_item.name, v_item.stock_quantity, v_item.quantity, v_item.unit;
    end if;
  end loop;

  -- Só depois da validação, cria as saídas.
  for v_item in
    select pii.product_id, pii.quantity, p.name
    from public.procedure_inventory_items pii
    join public.products p on p.id = pii.product_id
    where pii.procedure_id = v_appointment.procedure_id
      and pii.user_id = v_user
      and p.active = true
    order by pii.product_id
  loop
    insert into public.inventory_movements (
      user_id, product_id, movement_type, quantity, unit_cost, reason, notes, appointment_id
    )
    select v_user, v_item.product_id, 'saida', v_item.quantity, p.cost_price,
      'Uso em atendimento',
      'EsteticPro: consumo automático do atendimento ' || p_appointment_id::text,
      p_appointment_id
    from public.products p
    where p.id = v_item.product_id
    returning id into v_movement_id;

    insert into public.appointment_inventory_consumptions (
      user_id, appointment_id, procedure_id, product_id, quantity, movement_id
    ) values (
      v_user, p_appointment_id, v_appointment.procedure_id, v_item.product_id, v_item.quantity, v_movement_id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.consume_inventory_for_appointment(uuid) from public;
grant execute on function public.consume_inventory_for_appointment(uuid) to authenticated;

create or replace function public.restore_inventory_for_appointment(p_appointment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select aic.*, p.cost_price
    from public.appointment_inventory_consumptions aic
    join public.products p on p.id = aic.product_id
    where aic.appointment_id = p_appointment_id and aic.user_id = v_user
  loop
    insert into public.inventory_movements (
      user_id, product_id, movement_type, quantity, unit_cost, reason, notes, appointment_id
    ) values (
      v_user, v_row.product_id, 'entrada', v_row.quantity, v_row.cost_price,
      'Estorno de consumo',
      'EsteticPro: estorno do consumo do atendimento ' || p_appointment_id::text,
      p_appointment_id
    );
    v_count := v_count + 1;
  end loop;

  delete from public.appointment_inventory_consumptions
  where appointment_id = p_appointment_id and user_id = v_user;
  return v_count;
end;
$$;

revoke all on function public.restore_inventory_for_appointment(uuid) from public;
grant execute on function public.restore_inventory_for_appointment(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V21
-- ============================================================
