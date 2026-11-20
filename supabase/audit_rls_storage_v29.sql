-- EsteticPro V29 — auditoria de RLS e Storage (somente leitura).
-- Execute no SQL Editor para gerar inventário; revise os resultados antes de alterar políticas.
-- 1) Tabelas públicas e status de RLS
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('public','storage')
order by n.nspname,c.relname;

-- 2) Políticas atuais de tabelas
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

-- 3) Buckets de Storage e visibilidade
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by name;

-- 4) Políticas de objetos de Storage
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='storage' and tablename='objects'
order by policyname;

-- 5) Funções SECURITY DEFINER em schemas de aplicação
select n.nspname as schema_name, p.proname as function_name,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','storage')
order by n.nspname,p.proname;

-- Não é seguro criar políticas genéricas sem mapear a coluna de propriedade de cada tabela.
-- Depois de exportar os resultados, validar: acesso por owner_id/user_id, bloqueio entre usuários,
-- Storage privado, URLs assinadas curtas, funções SECURITY DEFINER e acesso anon/authenticated.
