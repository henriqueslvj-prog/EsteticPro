# EsteticPro V29 — implantação manual no Supabase

## Arquivos desta entrega
- `supabase/private_access_v29.sql`: cria tabelas de acesso e convites, configura o administrador inicial e registra novas contas como pendentes.
- `supabase/audit_security_v29.sql`: consultas somente leitura para inventariar RLS, privilégios e Storage.
- `supabase/functions/manage-access/index.ts`: envio de convite por e-mail, lista de contas/convites, bloqueio/liberação e revogação.
- `public/privacidade.html`, `public/termos.html`, `public/google-drive-termos.html`: documentos iniciais para revisão.
- `src/App.jsx`: remove o cadastro público; o acesso exige status aprovado.
- `src/styles.css`: padroniza números com algarismos tabulares e refina o painel administrativo.

## Sequência segura

1. Faça backup do projeto Supabase e confirme que está no projeto correto.
2. Abra SQL Editor e execute primeiro `audit_security_v29.sql`. Salve os resultados para revisão. Este script é somente leitura.
3. Confira que o usuário `henriqueslvj@gmail.com` já existe em Authentication → Users. Não crie uma conta manualmente se não tiver certeza de que é sua conta atual.
4. Execute `private_access_v29.sql`. O script promove a conta existente com esse e-mail para admin; se não encontrar a conta, não cria usuário administrador.
5. Faça deploy da Edge Function `manage-access` a partir de `supabase/functions/manage-access/index.ts`.
6. Configure o secret `APP_ORIGIN=https://estetipro.vercel.app` na Edge Function. O segredo `SUPABASE_SERVICE_ROLE_KEY` é disponibilizado pelo ambiente Supabase; nunca o adicione ao frontend, repositório ou Vercel como variável VITE.
7. Confirme no Supabase Auth → URL Configuration que a URL do app e o redirect de convite estão permitidos. Configure SMTP/e-mail transacional para entrega confiável de convites.
8. Faça deploy da branch/ZIP no Preview Vercel. Entre com a conta administradora, abra Acessos, envie convite para um e-mail de teste e valide recebimento, confirmação, acesso e revogação.
9. Só depois de revisar os resultados da auditoria, corrija as policies de cada tabela e bucket conforme o modelo real de propriedade dos dados. Não execute policies genéricas de terceiros nem torne buckets públicos.
10. Valide com duas contas diferentes que nenhuma consegue consultar ou baixar dados da outra; teste REST API e Storage além da interface.

## Observações de segurança

- `verify_jwt = false` na configuração da função significa que a plataforma não faz o gate JWT antes de executar; a função valida explicitamente o Bearer token usando Auth. Mantenha essa verificação e a checagem de administrador.
- O primeiro administrador é identificado pelo e-mail fixo no SQL e na função. Se esse e-mail mudar, ajuste ambos antes do deploy.
- A função de convite usa o serviço de e-mail de Supabase Auth. Entrega depende de SMTP, URL allowlist e templates corretos.
- A aceitação de convite procura convite pendente pelo e-mail confirmado; convites expirados não podem ser aceitos. Revogar convite antes da aceitação impede ativação.
- Contas pré-existentes que não são a administradora são definidas como pendentes pela migração; valide individualmente quem deve receber acesso antes de ativar o sistema.
- A interface por si só não garante segurança. RLS e Storage precisam ser revisados e testados. O script de auditoria identifica configuração, mas não certifica a correção sem análise dos resultados.
- Termos e Política de Privacidade são rascunhos operacionais, não parecer jurídico. Antes de convidar profissionais reais, preencher a identificação do controlador, canal de contato, retenção, processo de direitos dos titulares, backups, subprocessadores e base legal; obter revisão jurídica LGPD.
