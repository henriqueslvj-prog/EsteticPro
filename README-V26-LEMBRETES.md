# EsteticPro V26 — Lembretes

## Incluído nesta versão
- Nova área Lembretes na navegação.
- Resumo dos atendimentos de hoje e amanhã, ignorando agendamentos cancelados ou faltas.
- Lista de aniversários de hoje e dos próximos sete dias, usando a data de nascimento já cadastrada na ficha da cliente.
- Mensagem de aniversário por profissional, editável e salva em `business_settings.whatsapp_birthday_template`.
- Atalho de WhatsApp manual, com substituição de `{nome_cliente}`, `{nome_profissional}` e `{data}`.
- Pedido de permissão e teste de notificação no dispositivo.
- Service worker com tratamento de eventos Web Push e clique na notificação.
- SQL para preferências de lembretes, logs e inscrições Push.

## Aplicação
1. Execute `supabase/v26_lembretes.sql` no SQL Editor do Supabase.
2. Publique o projeto na Vercel.
3. Abra Lembretes e autorize as notificações no navegador/dispositivo.
4. Cadastre datas de nascimento nas fichas dos clientes e teste o atalho de WhatsApp.

## Importante sobre notificações com o app fechado
Esta versão prepara o Service Worker e a tabela `push_subscriptions`, além de permitir testar a permissão local. Para notificações automáticas entregues quando o app estiver fechado, ainda é necessário completar o fluxo Web Push: assinar a inscrição com uma chave pública VAPID, armazenar a inscrição autenticada, configurar uma Edge Function de envio com a chave privada VAPID e agendar sua execução no Supabase. Não coloque a chave privada VAPID no frontend. A permissão concedida, por si só, não agenda notificações futuras.

O resumo dentro do app funciona sem esse serviço Push externo.
