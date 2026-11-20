-- ============================================================
-- ESTETICPRO V19.3
-- CORREÇÃO DO PAGAMENTO + MÚLTIPLAS FORMAS DE PAGAMENTO
-- ============================================================

-- Garante que as colunas da V19 realmente existam.
alter table public.appointments
  add column if not exists payment_status text;

alter table public.appointments
  add column if not exists payment_method text;

alter table public.appointments
  add column if not exists payment_amount numeric(12,2);

alter table public.appointments
  add column if not exists payment_received_amount numeric(12,2) default 0;

-- Evita conflito caso uma instalação anterior tenha criado a
-- constraint com os mesmos nomes.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_payment_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_payment_status_check
      check (payment_status is null or payment_status in ('pago','pendente','pacote'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_payment_amount_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_payment_amount_check
      check (payment_amount is null or payment_amount >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_payment_received_amount_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_payment_received_amount_check
      check (payment_received_amount is null or payment_received_amount >= 0);
  end if;
end $$;

-- ============================================================
-- DETALHAMENTO DO PAGAMENTO
-- ============================================================

create table if not exists public.appointment_payment_parts (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_method text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists appointment_payment_parts_appointment_idx
  on public.appointment_payment_parts(appointment_id);

create index if not exists appointment_payment_parts_user_idx
  on public.appointment_payment_parts(user_id);

alter table public.appointment_payment_parts enable row level security;

drop policy if exists "appointment_payment_parts_own_data"
on public.appointment_payment_parts;

create policy "appointment_payment_parts_own_data"
on public.appointment_payment_parts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Garante que a parte do pagamento pertence ao mesmo usuário
-- do agendamento.
create or replace function public.validate_appointment_payment_part_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.appointments
  where id = new.appointment_id;

  if v_user_id is null then
    raise exception 'Agendamento não encontrado.';
  end if;

  if v_user_id <> new.user_id then
    raise exception 'O pagamento não pertence ao mesmo usuário do agendamento.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_appointment_payment_part_owner
on public.appointment_payment_parts;

create trigger validate_appointment_payment_part_owner
before insert or update
on public.appointment_payment_parts
for each row
execute function public.validate_appointment_payment_part_owner();

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V19.3
-- ============================================================
