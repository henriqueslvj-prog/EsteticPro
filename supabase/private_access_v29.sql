-- EsteticPro V29 - controle de acesso privado
-- Execute primeiro em ambiente de teste. Nao altera senhas nem remove usuarios.
create extension if not exists pgcrypto;

create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'professional' check (role in ('admin','professional')),
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_access enable row level security;
revoke all on public.user_access from anon;
revoke insert, update, delete on public.user_access from authenticated;
drop policy if exists "Users can read own access status" on public.user_access;
create policy "Users can read own access status" on public.user_access for select to authenticated using (user_id = auth.uid());

create table if not exists public.access_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_by uuid not null references auth.users(id),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists access_invites_one_pending_email on public.access_invites (lower(email)) where status='pending';
alter table public.access_invites enable row level security;
revoke all on public.access_invites from anon, authenticated;

-- Admin inicial: promove somente a conta Auth existente com o e-mail indicado.
-- Se ela ainda nao existir no Supabase Auth, nenhum usuario sera criado automaticamente.
insert into public.user_access (user_id, email, role, status)
select id, lower(email), 'admin', 'approved'
from auth.users where lower(email) = 'henriqueslvj@gmail.com'
on conflict (user_id) do update set email=excluded.email, role='admin', status='approved', updated_at=now();

-- Usuarios existentes nao sao aprovados implicitamente.
insert into public.user_access (user_id,email,role,status)
select id,lower(email),'professional','pending' from auth.users
where lower(email) <> 'henriqueslvj@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.handle_new_user_access_v29()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.user_access(user_id,email,role,status)
  values(new.id,lower(coalesce(new.email,'')),'professional','pending')
  on conflict(user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_access_v29 on auth.users;
create trigger on_auth_user_created_access_v29 after insert on auth.users
for each row execute function public.handle_new_user_access_v29();

-- Nao altera policies de Storage automaticamente: revisar bucket por bucket com base no modelo de ownership.
