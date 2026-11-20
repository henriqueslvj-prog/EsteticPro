-- ============================================================
-- ESTETICPRO V24.5 — AUTOMAÇÃO WHATSAPP
-- Confirmação automática + lembretes + histórico de automações.
-- ============================================================

alter table public.user_settings
  add column if not exists whatsapp_automation_enabled boolean not null default true;
alter table public.user_settings
  add column if not exists whatsapp_auto_confirmation boolean not null default true;
alter table public.user_settings
  add column if not exists whatsapp_auto_reminder boolean not null default true;
alter table public.user_settings
  add column if not exists whatsapp_reminder_hours integer not null default 24;

do $$
begin
  alter table public.user_settings
    drop constraint if exists user_settings_whatsapp_reminder_hours_check;
  alter table public.user_settings
    add constraint user_settings_whatsapp_reminder_hours_check
    check (whatsapp_reminder_hours in (2,4,12,24,48));
exception when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_automation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  automation_type text not null,
  status text not null default 'enviado',
  message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint whatsapp_automation_logs_type_check check (automation_type in ('confirmacao','lembrete')),
  constraint whatsapp_automation_logs_status_check check (status in ('enviado','erro')),
  constraint whatsapp_automation_logs_unique unique (appointment_id, automation_type)
);

create index if not exists whatsapp_automation_logs_user_idx
  on public.whatsapp_automation_logs(user_id, created_at desc);
create index if not exists whatsapp_automation_logs_appointment_idx
  on public.whatsapp_automation_logs(appointment_id);

alter table public.whatsapp_automation_logs enable row level security;
drop policy if exists "whatsapp_automation_logs_own_data" on public.whatsapp_automation_logs;
create policy "whatsapp_automation_logs_own_data"
on public.whatsapp_automation_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
