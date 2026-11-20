-- ============================================================
-- ESTETICPRO V18 — PROCEDIMENTOS, PACOTES E USO NA AGENDA
-- ============================================================

alter table public.appointments
  add column if not exists procedure_id uuid references public.procedures(id) on delete set null;

alter table public.appointments
  add column if not exists client_package_id uuid references public.client_packages(id) on delete set null;

create index if not exists appointments_procedure_id_idx
  on public.appointments(procedure_id);

create index if not exists appointments_client_package_id_idx
  on public.appointments(client_package_id);

-- Histórico de sessões efetivamente utilizadas.
create table if not exists public.client_package_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  used_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists client_package_usages_user_id_idx
  on public.client_package_usages(user_id);
create index if not exists client_package_usages_package_idx
  on public.client_package_usages(client_package_id);

alter table public.client_package_usages enable row level security;

drop policy if exists "client_package_usages_own_data" on public.client_package_usages;
create policy "client_package_usages_own_data"
on public.client_package_usages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Mantém used_sessions e status do pacote sincronizados com o histórico.
create or replace function public.refresh_client_package_usage(p_client_package_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_total integer;
  v_status text;
begin
  select total_sessions into v_total
  from public.client_packages
  where id = p_client_package_id;

  if v_total is null then return; end if;

  select count(*)::integer into v_used
  from public.client_package_usages
  where client_package_id = p_client_package_id;

  select status into v_status
  from public.client_packages
  where id = p_client_package_id;

  update public.client_packages
  set used_sessions = v_used,
      status = case
        when status = 'cancelado' then 'cancelado'
        when expires_at is not null and expires_at < current_date and v_used < v_total then 'expirado'
        when v_used >= v_total then 'concluido'
        else 'ativo'
      end,
      updated_at = now()
  where id = p_client_package_id;
end;
$$;

-- Confere propriedade e limite antes de registrar uma sessão.
create or replace function public.validate_client_package_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package public.client_packages%rowtype;
  v_used integer;
begin
  select * into v_package
  from public.client_packages
  where id = new.client_package_id;

  if not found then raise exception 'Pacote da cliente não encontrado.'; end if;
  if v_package.user_id <> new.user_id then raise exception 'O pacote não pertence ao usuário autenticado.'; end if;
  if v_package.status in ('cancelado','expirado') then raise exception 'Este pacote não está disponível para uso.'; end if;

  select count(*)::integer into v_used
  from public.client_package_usages
  where client_package_id = new.client_package_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_used >= v_package.total_sessions then
    raise exception 'Todas as sessões deste pacote já foram utilizadas.';
  end if;

  if not exists (
    select 1 from public.appointments a
    where a.id = new.appointment_id
      and a.user_id = new.user_id
      and a.client_id = v_package.client_id
  ) then
    raise exception 'O agendamento não pertence à cliente vinculada ao pacote.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_client_package_usage on public.client_package_usages;
create trigger validate_client_package_usage
before insert or update on public.client_package_usages
for each row execute function public.validate_client_package_usage();

-- Atualiza contagem quando uma sessão entra ou sai do histórico.
create or replace function public.sync_client_package_usage_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_client_package_usage(old.client_package_id);
    return old;
  end if;

  perform public.refresh_client_package_usage(new.client_package_id);

  if tg_op = 'UPDATE' and old.client_package_id <> new.client_package_id then
    perform public.refresh_client_package_usage(old.client_package_id);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_client_package_usage_count on public.client_package_usages;
create trigger sync_client_package_usage_count
after insert or update or delete on public.client_package_usages
for each row execute function public.sync_client_package_usage_count();

-- Cria/remove a sessão automaticamente conforme o status do agendamento.
create or replace function public.sync_appointment_package_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'Concluído' and (new.status <> 'Concluído' or old.client_package_id is distinct from new.client_package_id) then
      delete from public.client_package_usages where appointment_id = old.id;
    end if;
  end if;

  if new.status = 'Concluído' and new.client_package_id is not null then
    insert into public.client_package_usages (user_id, client_package_id, appointment_id, procedure_id, notes)
    values (new.user_id, new.client_package_id, new.id, new.procedure_id, new.notes)
    on conflict (appointment_id) do update
      set client_package_id = excluded.client_package_id,
          procedure_id = excluded.procedure_id,
          notes = excluded.notes;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_appointment_package_usage on public.appointments;
create trigger sync_appointment_package_usage
after insert or update of status, client_package_id, procedure_id on public.appointments
for each row execute function public.sync_appointment_package_usage();

-- Valida o vínculo do pacote e procedimento no agendamento.
create or replace function public.validate_appointment_service_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package public.client_packages%rowtype;
  v_proc_user uuid;
begin
  if new.procedure_id is not null then
    select user_id into v_proc_user from public.procedures where id = new.procedure_id;
    if v_proc_user is null then raise exception 'Procedimento não encontrado.'; end if;
    if v_proc_user <> new.user_id then raise exception 'O procedimento não pertence ao usuário autenticado.'; end if;
  end if;

  if new.client_package_id is not null then
    select * into v_package from public.client_packages where id = new.client_package_id;
    if not found then raise exception 'Pacote da cliente não encontrado.'; end if;
    if v_package.user_id <> new.user_id then raise exception 'O pacote não pertence ao usuário autenticado.'; end if;
    if v_package.client_id <> new.client_id then raise exception 'O pacote selecionado não pertence à cliente deste agendamento.'; end if;
    if v_package.status in ('cancelado','expirado','concluido') and new.status <> 'Concluído' then
      raise exception 'Este pacote não possui sessões disponíveis.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_appointment_service_links on public.appointments;
create trigger validate_appointment_service_links
before insert or update of client_id, user_id, procedure_id, client_package_id, status
on public.appointments
for each row execute function public.validate_appointment_service_links();

notify pgrst, 'reload schema';
