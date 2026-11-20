-- ============================================================
-- ESTETICPRO V18.2
-- PACOTES DO CATÁLOGO DISPONÍVEIS NA AGENDA
-- ============================================================

alter table public.appointments
  add column if not exists service_package_id uuid
  references public.service_packages(id)
  on delete set null;

create index if not exists appointments_service_package_id_idx
  on public.appointments(service_package_id);

-- Garante que o pacote selecionado pertence ao profissional.
create or replace function public.validate_appointment_service_package_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package_user uuid;
begin
  if new.service_package_id is not null then
    select user_id into v_package_user
    from public.service_packages
    where id = new.service_package_id;

    if v_package_user is null then
      raise exception 'Pacote não encontrado.';
    end if;

    if v_package_user <> new.user_id then
      raise exception 'O pacote não pertence ao usuário autenticado.';
    end if;

    if not exists (
      select 1 from public.service_packages
      where id = new.service_package_id
        and active = true
    ) then
      raise exception 'Este pacote está inativo e não pode ser usado em novos agendamentos.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_appointment_service_package_owner
on public.appointments;

create trigger validate_appointment_service_package_owner
before insert or update of service_package_id, user_id
on public.appointments
for each row
execute function public.validate_appointment_service_package_owner();

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V18.2
-- ============================================================
