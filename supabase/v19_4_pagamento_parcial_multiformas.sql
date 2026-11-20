-- ============================================================
-- ESTETICPRO V19.4
-- PAGAMENTO MULTIFORMAS + SALDO PENDENTE
-- ============================================================

alter table public.appointments
  add column if not exists payment_received_amount numeric(12,2) default 0;

alter table public.appointment_payment_parts
  add column if not exists status text not null default 'pago';

alter table public.appointment_payment_parts
  alter column payment_method drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointment_payment_parts_status_check'
      and conrelid = 'public.appointment_payment_parts'::regclass
  ) then
    alter table public.appointment_payment_parts
      add constraint appointment_payment_parts_status_check
      check (status in ('pago','pendente'));
  end if;
end $$;

create index if not exists appointment_payment_parts_status_idx
  on public.appointment_payment_parts(appointment_id, status);

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V19.4
-- ============================================================
