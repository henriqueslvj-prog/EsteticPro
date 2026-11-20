-- ============================================================
-- ESTETICPRO V19
-- FINALIZAÇÃO DO ATENDIMENTO + PAGAMENTO + PACOTES
-- ============================================================

-- Dados de pagamento do próprio agendamento.
alter table public.appointments
  add column if not exists payment_status text;

alter table public.appointments
  add column if not exists payment_method text;

alter table public.appointments
  add column if not exists payment_amount numeric(12,2);

-- Status aceitos:
-- pago     = recebido e lançado como receita paga
-- pendente = atendimento concluído, mas valor ainda não recebido
-- pacote   = sessão pertencente a pacote, sem nova cobrança
-- null     = ainda não finalizado

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

create index if not exists appointments_payment_status_idx
  on public.appointments(user_id, payment_status);

-- Um atendimento gera no máximo uma receita financeira vinculada.
-- Não é criada uma constraint UNIQUE para não quebrar dados históricos.
-- A aplicação verifica o appointment_id antes de inserir/atualizar.

notify pgrst, 'reload schema';

-- ============================================================
-- FIM V19
-- ============================================================
