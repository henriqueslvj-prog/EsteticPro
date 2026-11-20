-- EsteticPro V3 - rateio de lançamentos por múltiplas categorias
-- Execute este script no Supabase SQL Editor antes de usar o rateio.

create table if not exists public.financial_transaction_categories (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.financial_transactions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  percentage numeric(7,3) not null default 0 check (percentage >= 0 and percentage <= 100),
  created_at timestamptz not null default now()
);

alter table public.financial_transaction_categories enable row level security;

drop policy if exists "financial_transaction_categories_own_data" on public.financial_transaction_categories;
create policy "financial_transaction_categories_own_data"
on public.financial_transaction_categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists financial_transaction_categories_transaction_idx
on public.financial_transaction_categories(transaction_id);

create index if not exists financial_transaction_categories_user_category_idx
on public.financial_transaction_categories(user_id, category);

create or replace function public.validate_financial_transaction_category_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.financial_transactions t
    where t.id = new.transaction_id
      and t.user_id = new.user_id
  ) then
    raise exception 'O lançamento selecionado não pertence ao usuário autenticado.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_financial_transaction_category_owner on public.financial_transaction_categories;
create trigger validate_financial_transaction_category_owner
before insert or update of transaction_id, user_id
on public.financial_transaction_categories
for each row execute procedure public.validate_financial_transaction_category_owner();

-- Garante que exclusões/alterações do lançamento não deixem rateios órfãos.
-- O FK com ON DELETE CASCADE cuida da exclusão.
