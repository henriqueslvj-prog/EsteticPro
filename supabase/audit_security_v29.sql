-- EsteticPro V29 — auditoria de RLS e Storage (somente leitura)
-- Execute no SQL Editor do Supabase. Este script NÃO altera dados nem políticas.
-- Resultado 1: tabelas públicas sem RLS ativado.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
order by c.relname;

-- Resultado 2: políticas ativas por tabela e permissões.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

-- Resultado 3: buckets e visibilidade.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by name;

-- Resultado 4: políticas de objetos no Storage.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='storage' and tablename='objects'
order by policyname;

-- Resultado 5: privilégios diretos em tabelas públicas.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
order by table_name, grantee, privilege_type;

-- Como interpretar:
-- 1) Toda tabela com dados de cliente/saúde/financeiro deve ter RLS e policies com ownership validado.
-- 2) Nunca use policy genérica USING(true) para tabelas de clientes, anamneses, agenda, financeiro ou evolução.
-- 3) Buckets de fotografias de evolução devem ser privados; servir arquivos por endpoint autenticado ou URL assinada curta.
-- 4) Confirme que todas as policies verificam o proprietário/tenant real e que o user_id não pode ser falsificado pelo cliente.
-- 5) Não aplique políticas genéricas de correção sem revisar o esquema: os nomes de ownership variam entre tabelas.
