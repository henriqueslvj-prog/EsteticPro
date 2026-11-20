# EsteticPro V29 — correções do fluxo de acessos

## O que foi corrigido
- A tela de administração agora aceita `accesses` (retornado pela Edge Function atual) e mantém compatibilidade com `users`.
- Bloquear/liberar agora chama `set_status`, em vez de enviar `status` para `set_access`.
- A Edge Function aceita os status `approved`, `pending` e `blocked`, alinhados ao SQL `private_access_v29.sql`.
- A aceitação do convite encaminha `invite_token` da URL para a Edge Function.
- A mensagem de erro da chamada mostra mais detalhes disponíveis do SDK e registra o erro no Console, em vez de esconder tudo atrás da mesma mensagem genérica.
- O cache do Service Worker foi versionado para `esteticpro-shell-v29`, forçando renovação do shell após a publicação.

## Publicação
1. Faça backup da versão atual do repositório.
2. Substitua os arquivos pelos desta versão e publique o frontend na Vercel.
3. Publique `supabase/functions/manage-access/index.ts` na Edge Function `manage-access`.
4. Não compartilhe nem coloque a `SUPABASE_SERVICE_ROLE_KEY` no frontend. Mantenha-a somente nos secrets da Edge Function.
5. Após publicar, teste listar acessos, enviar convite e bloquear/liberar uma conta de teste antes de usar em produção.

## Observação sobre CORS
O teste de preflight via PowerShell fornecido na conversa retornou `204` e `Access-Control-Allow-Origin: https://estetipro.vercel.app`. Isso confirma que a resposta ao teste independente estava correta naquele momento, mas não prova que todas as chamadas do navegador estejam resolvidas. As correções deste pacote também corrigem incompatibilidades reais entre a tela e a função; não afirmamos que isso, isoladamente, resolve qualquer erro de rede/CORS que persista no navegador.
