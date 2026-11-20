-- EsteticPro V26 — Lembretes, aniversários e modelo de WhatsApp
-- Seguro para executar mais de uma vez.

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS whatsapp_birthday_template text NOT NULL DEFAULT 'Olá, {nome_cliente}! 💚🎂 Hoje é um dia especial! Desejo a você muita saúde, alegria e realizações neste novo ciclo. Obrigada pela confiança no meu trabalho. Será sempre um prazer cuidar de você! 🌿 Com carinho, {nome_profissional}.';

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS appointment_reminder_day_before boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS appointment_reminder_day_of boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_reminder_day_before boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_reminder_day_of boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_weekly_summary boolean NOT NULL DEFAULT true;

-- Base para registro futuro de lembretes entregues sem duplicação.
CREATE TABLE IF NOT EXISTS public.reminder_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_key text NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('appointment_day_before','appointment_day_of','birthday_day_before','birthday_day_of','birthday_weekly_summary')),
  scheduled_for date NOT NULL,
  delivered_at timestamptz,
  delivery_channel text NOT NULL DEFAULT 'in_app' CHECK (delivery_channel IN ('in_app','push')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reminder_key, reminder_type, scheduled_for, delivery_channel)
);

ALTER TABLE public.reminder_delivery_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reminder_delivery_logs_own_data ON public.reminder_delivery_logs;
CREATE POLICY reminder_delivery_logs_own_data ON public.reminder_delivery_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS reminder_delivery_logs_user_date_idx
  ON public.reminder_delivery_logs(user_id, scheduled_for DESC);

-- Tabela de inscrições para Web Push. A chave privada VAPID nunca deve ficar no navegador.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own_read ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_read ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_own_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_insert ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_own_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_update ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS push_subscriptions_own_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_delete ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
