-- EsteticPro V24.6 — WhatsApp Business sem API
-- Não é necessário criar novas tabelas: business_settings.whatsapp já é individual por user_id.
-- Este SQL apenas garante que a coluna exista em projetos que ainda não receberam V24.

alter table public.business_settings
  add column if not exists whatsapp text;

notify pgrst, 'reload schema';
