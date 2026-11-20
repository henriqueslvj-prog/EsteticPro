# EsteticPro V24.5 — Tema claro + legibilidade + automação WhatsApp

## Visual
- Tema claro com contraste reforçado.
- Cards e métricas com fundo branco e texto verde-escuro.
- Tipografia mínima ampliada, principalmente textos auxiliares e rodapé.
- Mantida a identidade verde do EsteticPro.

## WhatsApp
A V24.5 inicia a automação em duas etapas:
1. Confirmação automática após criar um novo agendamento, quando a automação estiver ativa.
2. Lembrete automático antes do atendimento, usando a Edge Function `whatsapp-automation`.

### Secrets necessários nas Edge Functions
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_REMINDER_TEMPLATE_NAME` (opcional; se não informado, usa o template de confirmação)
- `WHATSAPP_TEMPLATE_LANGUAGE` (ex.: `pt_BR`)
- `WHATSAPP_AUTOMATION_SECRET` (crie um segredo forte seu)
- `SUPABASE_SECRET_KEYS` já usado pelo projeto

### Banco
Execute `supabase/v24_5_whatsapp_automation.sql` no Supabase.

### Deploy das funções
```bash
supabase functions deploy send-whatsapp
supabase functions deploy whatsapp-automation
```

### Agendamento do lembrete
Configure a Edge Function `whatsapp-automation` para ser chamada periodicamente (por exemplo, a cada 15 minutos) pelo scheduler/cron do Supabase, enviando o header:
`x-esteticpro-automation-secret: <seu WHATSAPP_AUTOMATION_SECRET>`

O endpoint deve ser:
`https://siceqyfkqafjrwkcacin.supabase.co/functions/v1/whatsapp-automation`

A função evita duplicidade com `whatsapp_automation_logs`.

> A API oficial do WhatsApp/Meta exige template aprovado para mensagens proativas fora da janela de atendimento. O EsteticPro não coloca tokens no frontend.

### Comportamento no cadastro
- Novo agendamento: confirmação automática pode ser enviada imediatamente.
- Agendamento em lote de pacote: cada sessão criada pode receber a confirmação automática.
- Se a API estiver indisponível, o agendamento continua sendo salvo.
