-- EsteticPro V30 — Teste grátis de 7 dias
-- Rode UMA vez no SQL Editor do Supabase (depois do private_access_v29.sql). Pode ser repetido sem efeitos colaterais.
--
-- O que faz:
--   1) Adiciona plano (full | trial) e data de fim do teste em user_access.
--   2) Contas criadas pelo botão "Teste grátis" nascem aprovadas, com plano trial e fim em 7 dias.
--      Qualquer outro cadastro continua "pending" (você libera manualmente).
--   3) Bloqueia no BANCO (RLS restritiva) o acesso aos dados de contas bloqueadas, pendentes ou com teste vencido.
--      Assim o limite de 7 dias não depende só da tela do app.

alter table public.user_access add column if not exists plan text not null default 'full';
alter table public.user_access add column if not exists trial_ends_at timestamptz;
alter table public.user_access drop constraint if exists user_access_plan_check;
alter table public.user_access add constraint user_access_plan_check check (plan in ('full','trial'));

-- 2) Novo usuário: trial automático só quando veio do botão de teste grátis.
create or replace function public.handle_new_user_access_v29()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  is_trial boolean := coalesce(new.raw_user_meta_data ->> 'signup_source', '') = 'trial';
begin
  if is_trial then
    insert into public.user_access (user_id, email, role, status, plan, trial_ends_at)
    values (new.id, lower(coalesce(new.email, '')), 'professional', 'approved', 'trial', now() + interval '7 days')
    on conflict (user_id) do nothing;
  else
    insert into public.user_access (user_id, email, role, status)
    values (new.id, lower(coalesce(new.email, '')), 'professional', 'pending')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- 3) Função de checagem usada pelas policies.
create or replace function public.has_active_access()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_access ua
    where ua.user_id = auth.uid()
      and ua.status = 'approved'
      and (ua.plan <> 'trial' or ua.trial_ends_at is null or ua.trial_ends_at > now())
  );
$$;
revoke all on function public.has_active_access() from public, anon;
grant execute on function public.has_active_access() to authenticated;

-- Policy RESTRITIVA em toda tabela do schema public que tenha user_id e RLS ligada
-- (soma-se às policies existentes: o dono continua vendo só os próprios dados, e só se o acesso estiver ativo).
do $$
declare r record;
begin
  for r in
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('user_access', 'access_invites')
  loop
    if r.relrowsecurity then
      execute format('drop policy if exists "esteticpro_acesso_ativo" on public.%I', r.relname);
      execute format('create policy "esteticpro_acesso_ativo" on public.%I as restrictive for all to authenticated using (public.has_active_access()) with check (public.has_active_access())', r.relname);
    else
      raise notice 'Tabela % tem user_id mas está sem RLS: o bloqueio não se aplica a ela.', r.relname;
    end if;
  end loop;
end $$;

-- ========== Rotinas do administrador (rode quando precisar) ==========
-- Liberar acesso completo (sem prazo) para uma pessoa:
--   update public.user_access set status='approved', plan='full', trial_ends_at=null, updated_at=now() where lower(email)=lower('pessoa@email.com');
-- Prorrogar o teste por mais 7 dias:
--   update public.user_access set status='approved', plan='trial', trial_ends_at=now()+interval '7 days', updated_at=now() where lower(email)=lower('pessoa@email.com');
-- Bloquear uma conta:
--   update public.user_access set status='blocked', updated_at=now() where lower(email)=lower('pessoa@email.com');
-- Ver quem está em teste e quando vence:
--   select email, status, plan, trial_ends_at from public.user_access where plan='trial' order by trial_ends_at;
