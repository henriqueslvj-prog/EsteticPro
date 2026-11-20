# EsteticPro V27 — configuração do Web Push

## O que esta entrega prepara
- Inscrição do navegador/dispositivo a partir de **Lembretes > Ativar notificações**.
- Edge Function `reminder-push` para lembretes de atendimentos hoje/amanhã, aniversários hoje/amanhã e resumo semanal às segundas.
- Registro de entrega para reduzir duplicações e remoção de inscrições expiradas.
- Agendamento diário pelo `pg_cron` às 09:00 no fuso de Recife.

## 1. Banco de dados
No Supabase > SQL Editor, execute `supabase/reminders_v27.sql`.

## 2. Gerar chaves VAPID
Em um terminal local com Node.js:
```bash
npx web-push generate-vapid-keys
```
Guarde as chaves com segurança. Nunca coloque a chave privada no Vercel, no código frontend, nem em SQL público/repositório.

## 3. Configurar secrets da Edge Function
No Supabase > Edge Functions > Secrets, configure:
- `VAPID_PUBLIC_KEY`: chave pública gerada.
- `VAPID_PRIVATE_KEY`: chave privada gerada.
- `VAPID_SUBJECT`: `mailto:seu-email-de-suporte`.
- `REMINDER_CRON_SECRET`: um token aleatório forte (32 bytes ou mais).
- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key do projeto, somente em secrets do backend.
- `SUPABASE_ANON_KEY`: anon/publishable key do projeto, usada para validar sessões no modo autenticado.

## 4. Publicar a Edge Function
Implante `supabase/functions/reminder-push/index.ts` como função `reminder-push`. O arquivo `supabase/config.toml` já declara `verify_jwt = false`; a própria função valida sessão de usuário ou token de cron. Não exponha o token do cron ao navegador.

Com Supabase CLI, a partir da raiz do projeto:
```bash
supabase functions deploy reminder-push
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:seu-email" REMINDER_CRON_SECRET="..." SUPABASE_URL="https://siceqyfkqafjrwkcacin.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." SUPABASE_ANON_KEY="..."
```
Use os valores reais localmente; não os commite no Git.

## 5. Configurar o frontend na Vercel
Em Project Settings > Environment Variables, adicione:
- `VITE_VAPID_PUBLIC_KEY` = a mesma chave pública VAPID.

Faça redeploy da branch após configurar a variável. A chave pública pode estar no frontend; a privada não.

## 6. Agendar
No Supabase SQL Editor, abra `supabase/reminders_schedule_v27.sql`, substitua o placeholder por exatamente o mesmo `REMINDER_CRON_SECRET` usado nas secrets da Edge Function e execute. Confirme o job em `cron.job`.

## 7. Teste obrigatório
1. Abra o app em HTTPS, entre com um usuário real e vá a Lembretes.
2. Clique em Ativar notificações e confirme que aparece a notificação de teste.
3. Confira uma linha em `public.push_subscriptions` para esse usuário.
4. Execute manualmente a função usando o token de cron **somente em ambiente seguro** e confira o JSON de resultado/logs.
5. Confirme um lembrete real e veja `reminder_delivery_logs` e o dispositivo.
6. Teste com o navegador fechado e com o app instalado no celular. iOS exige versão compatível e instalação na tela inicial para Web Push.

## Limitações conhecidas
- O envio é uma notificação operacional; não envia mensagens pelo WhatsApp.
- O resumo semanal inclui no máximo cinco nomes no corpo da notificação.
- A função usa as opções de lembrete em `user_settings`; quando não há linha de preferências, assume os avisos ligados.
- O banco precisa conter as tabelas/colunas usadas pelo app (`profiles`, `user_settings`, `clients`, `appointments` e `business_settings`).
- A execução automática só começa depois de executar SQL, implantar a função, configurar secrets, adicionar a chave pública na Vercel e criar o job cron.
