# EsteticPro V25.1 — Mensagens prontas do WhatsApp

## O que mudou
- Configurações → WhatsApp agora permite editar seis mensagens padrão: confirmação, lembrete, pós-atendimento, retorno, reagendamento e localização.
- Os modelos são guardados em `business_settings.whatsapp_message_templates`, por profissional/usuário.
- O botão WhatsApp da Agenda usa o modelo de confirmação e preenche nome, procedimento, data e horário.
- Continua usando link `wa.me`, sem API da Meta; a profissional revisa e envia a mensagem no WhatsApp.

## Aplicação do banco
No Supabase → SQL Editor, execute `supabase/v25_1_whatsapp_templates.sql` uma vez.

## Variáveis disponíveis nos modelos
- `{nome_cliente}`
- `{procedimento}`
- `{data}`
- `{horario}`
- `{localizacao}`

O botão da Agenda preenche nome, procedimento, data e horário. Campos sem informação são removidos da mensagem.
