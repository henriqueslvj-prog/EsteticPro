# EsteticPro V19.3 — Pagamento corrigido e múltiplas formas

## Correções
- Adiciona/garante `appointments.payment_amount`, `payment_status` e `payment_method`.
- Adiciona `appointments.payment_received_amount`.
- Cria `appointment_payment_parts` para registrar duas ou mais formas de pagamento no mesmo atendimento.
- Finalização do atendimento valida a soma das formas de pagamento.
- Quando marcado como pago, a soma deve corresponder ao valor do serviço.
- O Financeiro recebe a descrição consolidada das formas de pagamento.

## SQL
Execute `supabase/v19_3_pagamento_multiformas.sql` no Supabase antes de publicar.
