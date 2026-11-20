-- EsteticPro V27 — infraestrutura de lembretes e Web Push
-- Execute no SQL Editor do Supabase antes de implantar a Edge Function.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

alter table public.business_settings
  add column if not exists whatsapp_birthday_template text not null default 'Olá, {nome_cliente}! 💚🎂 Hoje é um dia especial! Desejo a você muita saúde, alegria e realizações neste novo ciclo. Obrigada pela confiança no meu trabalho. Será sempre um prazer cuidar de você! 🌿 Com carinho, {nome_profissional}.';

alter table public.user_settings
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists appointment_reminder_day_before boolean not null default true,
  add column if not exists appointment_reminder_day_of boolean not null default true,
  add column if not exists birthday_reminder_day_before boolean not null default true,
  add column if not exists birthday_reminder_day_of boolean not null default true,
  add column if not exists birthday_weekly_summary boolean not null default true;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own_read on public.push_subscriptions;
create policy push_subscriptions_own_read on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists push_subscriptions_own_insert on public.push_subscriptions;
create policy push_subscriptions_own_insert on public.push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_own_update on public.push_subscriptions;
create policy push_subscriptions_own_update on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_own_delete on public.push_subscriptions;
create policy push_subscriptions_own_delete on public.push_subscriptions for delete using (auth.uid() = user_id);

create table if not exists public.reminder_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_key text not null,
  reminder_type text not null check (reminder_type in ('appointment_day_before','appointment_day_of','birthday_day_before','birthday_day_of','birthday_weekly_summary')),
  scheduled_for date not null,
  delivered_at timestamptz,
  delivery_channel text not null default 'push' check (delivery_channel in ('in_app','push')),
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  unique(user_id, reminder_key, reminder_type, scheduled_for, delivery_channel)
);
alter table public.reminder_delivery_logs enable row level security;
drop policy if exists reminder_delivery_logs_own_data on public.reminder_delivery_logs;
create policy reminder_delivery_logs_own_data on public.reminder_delivery_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists reminder_delivery_logs_user_date_idx on public.reminder_delivery_logs(user_id, scheduled_for desc);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- Secret para proteger o endpoint agendado. Depois de criar o segredo no Vault,
-- substitua o valor abaixo pelo nome correto se preferir outro.
-- Não armazene a chave privada VAPID em tabelas acessíveis ao navegador.
notify pgrst, 'reload schema';
