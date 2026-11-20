create table if not exists public.client_anamneses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  answers jsonb not null default '{}'::jsonb,
  consent boolean not null default false,
  consent_text text,
  signed_name text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_anamneses_user_id_idx on public.client_anamneses(user_id);
create index if not exists client_anamneses_client_id_idx on public.client_anamneses(client_id);
create index if not exists client_anamneses_client_version_idx on public.client_anamneses(client_id, version desc);
alter table public.client_anamneses enable row level security;
drop policy if exists "client_anamneses_own_data" on public.client_anamneses;
create policy "client_anamneses_own_data" on public.client_anamneses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.validate_client_anamnesis_owner() returns trigger language plpgsql security definer set search_path = public as $$
declare v_client_user uuid; begin select user_id into v_client_user from public.clients where id = new.client_id; if v_client_user is null then raise exception 'Cliente não encontrada.'; end if; if v_client_user <> new.user_id then raise exception 'Cliente e anamnese devem pertencer ao mesmo usuário.'; end if; return new; end; $$;
drop trigger if exists validate_client_anamnesis_owner on public.client_anamneses;
create trigger validate_client_anamnesis_owner before insert or update on public.client_anamneses for each row execute function public.validate_client_anamnesis_owner();
create or replace function public.touch_client_anamneses_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists client_anamneses_updated_at on public.client_anamneses;
create trigger client_anamneses_updated_at before update on public.client_anamneses for each row execute function public.touch_client_anamneses_updated_at();
notify pgrst, 'reload schema';
