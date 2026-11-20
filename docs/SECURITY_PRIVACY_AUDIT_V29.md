# EsteticPro V29 — relatório de segurança e privacidade (pré-auditoria)

Data: 03/10/2026  
Status: revisão estática inicial; não equivale a auditoria externa nem a teste no projeto Supabase real.

## Alterações preparadas
- Acesso ao painel exige registro `user_access.status = approved`.
- O cliente não pode inserir/alterar `user_access`; cada pessoa pode ler somente o próprio registro.
- Conta administrativa inicial configurada por e-mail `henriqueslvj@gmail.com`, desde que já exista e esteja confirmada em Supabase Auth.
- Edge Function `manage-access` verifica JWT, confirma papel/status no banco e restringe as operações administrativas à conta administradora configurada.
- Convite enviado via `auth.admin.inviteUserByEmail`; o status fica pendente até confirmação do e-mail, quando o trigger associa o convite pendente.
- A função de acesso lista contas e convites, bloqueia/libera profissionais e revoga convites pendentes.
- Migração aplica RLS e política restritiva de acesso aprovado a tabelas públicas existentes e a `storage.objects`.
- Política de Privacidade e Termos de Uso existentes permanecem preliminares; foi acrescentada uma página preliminar específica para Google Drive.
- Tipografia numérica atualizada com números tabulares para alinhar valores, contadores e eixos de gráficos.

## Itens que exigem validação no ambiente real antes de produção
1. Confirmar a conta `henriqueslvj@gmail.com` em Authentication → Users e verificar que o e-mail está confirmado. A migração aborta se não estiver.
2. Definir secrets da Edge Function: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ORIGIN`. Não inserir service-role key no frontend.
3. `APP_ORIGIN` deve corresponder ao domínio do app publicado; para testar Preview, autorizar também o domínio de preview de forma explícita. Não usar wildcard de origem.
4. Configurar SMTP de produção no Supabase e testar entrega, expiração, convite duplicado, revogação e confirmação de e-mail.
5. Desabilitar sign-ups públicos em Supabase Auth antes de produção. Confirmar que o mecanismo de convite administrativo continua funcionando nessa configuração.
6. Verificar se a integração OAuth Google está em conformidade com os escopos efetivos e com a política de dados do Google; preencher o responsável/controlador, canal de contato e processo de solicitações de titulares.
7. A migração adiciona uma barreira de aprovação, mas não substitui auditoria de cada política existente. Inspecionar tabela por tabela se as policies limitam os registros ao dono correto (por exemplo, `user_id = auth.uid()`) e não permitem leitura cruzada entre profissionais.
8. Inspecionar cada bucket e as políticas de Storage. A política restritiva global barra usuários não aprovados; ainda é necessário conferir isolamento por proprietário e a função dos buckets públicos/privados.
9. Testar endpoints Edge Functions existentes (upload/delete/media/Drive/push) para garantir validação do usuário e propriedade do recurso no servidor.
10. Testar acesso direto a PostgREST e Storage com usuário pendente/bloqueado; esconder módulos na interface não é uma medida de segurança suficiente.
11. Revisar os textos de privacidade e termos com profissional jurídico. As páginas são rascunhos e não devem ser apresentadas como aconselhamento jurídico ou conformidade certificada.
12. Confirmar que a revogação de uma conta bloqueia também sessões já emitidas e operações Edge Function; sessão Auth pode continuar válida até expirar, mas o guard de banco deve impedir acesso. Testar especificamente.

## Observações de risco
- Se houver outros usuários existentes na base no momento da migração, eles são preservados como aprovados, para evitar bloqueio acidental. Antes da implantação, confirmar a lista de contas existentes e bloquear qualquer conta que não deva manter acesso.
- O e-mail administrativo é um identificador inicial, não um segredo. A função também exige JWT válido e registro admin/aprovado no banco.
- A aplicação não deve usar chaves de serviço no navegador.
- A exclusão de conta deve ter procedimento de retenção/exportação e exclusão de dados conforme obrigações legais e contratos com terceiros.

## Critério mínimo de aceite
Só publicar após build passar, fluxo de convite e recuperação ser testado, administrador conseguir entrar, usuários não convidados não conseguirem entrar e as policies de dados e Storage terem sido testadas com duas contas distintas.
