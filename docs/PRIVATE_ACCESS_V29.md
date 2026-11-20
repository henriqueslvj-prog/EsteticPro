# EsteticPro V29 — acesso privado, convites e auditoria

## Implementado nesta branch
- Cadastro livre removido da tela pública de autenticação; o acesso começa por login e convite administrativo.
- A sessão consulta `user_access`; somente status `approved` pode abrir o painel.
- Edge Function `manage-access` valida JWT no servidor e exige `role=admin`, `status=approved` e e-mail administrativo exato `henriqueslvj@gmail.com`.
- A função suporta envio de convite, listagem de convites/contas, revogação e bloqueio/liberação.
- Convite pendente pode ser aceito somente após confirmação do e-mail e validação do convite ainda válido.
- Migração SQL cria controles privados e promove a conta administrativa se esse e-mail já existir em `auth.users`.
- Tipografia numérica recebe ajustes de alinhamento tabular e legibilidade em métricas, campos e gráficos.
- Páginas de Termos, Privacidade e Google Drive são documentos de trabalho, não parecer jurídico final.

## Procedimento seguro de implantação
1. Faça backup do projeto Supabase e valide em projeto de teste.
2. Confirme que `henriqueslvj@gmail.com` já existe em Authentication → Users. O SQL não cria a conta nem altera senha; se ela não existir, crie/convide a conta pelo fluxo normal do Supabase e só então execute o bootstrap.
3. Revise e execute `supabase/private_access_v29.sql` no SQL Editor do projeto correto.
4. Publique a Edge Function `manage-access` com as variáveis padrão Supabase disponíveis no ambiente de funções. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no frontend.
5. Configure o envio de e-mail/SMTP do Supabase e URLs de redirecionamento para o domínio de produção e preview autorizado. A mensagem de convite precisa ser testada na caixa de entrada e no link de confirmação.
6. Teste primeiro com uma conta de profissional convidada e com uma conta não autorizada antes de usar produção.

## Auditoria de RLS e Storage — estado
Esta é uma revisão estática do código e dos scripts versionados, não uma auditoria live do projeto Supabase. Não foi possível inspecionar via API as policies atualmente implantadas, buckets, objetos, permissões, chaves ou dados de produção.

- `user_access`: RLS ativado; usuários autenticados podem ler apenas o próprio status; clientes não podem inserir/alterar/excluir a própria autorização.
- `access_invites`: RLS ativado sem policies para anon/authenticated; gerenciamento via Edge Function com service role após verificação administrativa.
- Tabelas funcionais existentes: precisam de inventário e validação de policies por `user_id`/proprietário. Não se pode declarar isolamento completo sem testar cada tabela com duas contas distintas.
- Storage: revisar todos os buckets, incluindo evolução, avatars e arquivos anexos. Confirmar se são privados; evitar buckets públicos para anamneses e imagens; testar URLs assinadas, listagem, upload, download e exclusão entre duas contas. Não foram aplicadas policies genéricas de Storage automaticamente para não bloquear arquivos existentes.
- Edge Functions: verificar que cada função sensível valida o usuário e a autorização no servidor. `verify_jwt=false` exige validação explícita do JWT dentro da função; não confiar apenas no frontend.
- Dados sensíveis/LGPD: imagens de evolução e anamneses podem conter dados pessoais sensíveis. Definir controlador, base legal, minimização, retenção, exclusão, canal de titulares, resposta a incidentes e contratos com operadores antes do lançamento.

## Critérios de aceite pendentes
- [ ] Build Vercel para a branch V29 termina com sucesso.
- [ ] Conta administrativa real confirma que consegue entrar e ver menu Acessos.
- [ ] Convite chega por e-mail, link confirma o endereço, status passa para aprovado e a profissional entra.
- [ ] Convite expirado/revogado não libera acesso.
- [ ] Usuário comum não consegue chamar list/invite/revoke/set_access nem alterar a própria role/status via REST.
- [ ] Conta bloqueada perde acesso aos dados, APIs e Storage, não apenas à interface.
- [ ] Duas contas profissionais não conseguem ler/modificar registros nem arquivos uma da outra.
- [ ] Políticas atuais e permissões de todos os buckets foram verificadas no Supabase Dashboard.
- [ ] Responsável legal, contato de privacidade e política de retenção foram preenchidos e documentos revisados por advogado.

Não mesclar para produção até concluir esses critérios.
