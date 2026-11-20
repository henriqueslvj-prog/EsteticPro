-- ============================================================
-- ESTETICPRO V24.1 — TEMA CLARO COMO PADRÃO
-- Substitui a opção "Sistema" por "Claro".
-- ============================================================

alter table public.user_settings
  drop constraint if exists user_settings_theme_check;

update public.user_settings
set theme = 'light',
    updated_at = now()
where theme = 'system' or theme is null;

alter table public.user_settings
  alter column theme set default 'light';

alter table public.user_settings
  add constraint user_settings_theme_check
  check (theme in ('dark', 'light'));

notify pgrst, 'reload schema';
