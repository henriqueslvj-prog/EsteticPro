# EsteticPro V24.6 — WhatsApp Business sem API

Esta versão remove a dependência da WhatsApp Cloud API/Meta para mensagens do EsteticPro.

## Como funciona

- Cada profissional cadastra seu próprio número em **Configurações → WhatsApp Business**.
- O número fica salvo em `business_settings.whatsapp`, vinculado ao `user_id`.
- Na Agenda, o botão **WhatsApp** abre `https://wa.me/NUMERO_DA_CLIENTE?text=...`.
- A mensagem é preenchida automaticamente.
- O profissional confirma o envio dentro do WhatsApp Business.
- Não há token Meta, Graph API, template ou Edge Function de WhatsApp.

### Observação importante

O número cadastrado identifica o WhatsApp Business do profissional dentro do EsteticPro, mas o link `wa.me` não escolhe a conta remetente. No celular, o sistema abre o WhatsApp disponível no aparelho; no computador, abre o WhatsApp Web da conta conectada.

## Banco de dados

A coluna `business_settings.whatsapp` já faz parte do V24. O arquivo `supabase/v24_6_whatsapp_business.sql` é apenas uma garantia para projetos que ainda não possuem a coluna.
