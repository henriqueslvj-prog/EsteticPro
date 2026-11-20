# EsteticPro V19 — Finalização, Pagamento e Sessões de Pacotes

## Novidades

- Ao alterar um atendimento para **Concluído**, a Agenda abre uma confirmação de finalização.
- Para procedimento avulso, permite informar valor, forma de pagamento e situação (Pago/Pendente).
- Atendimento avulso concluído gera ou atualiza uma receita em `financial_transactions`, vinculada ao `appointment_id`.
- Para sessão de pacote, a conclusão registra a utilização da sessão e não cria cobrança individual.
- Adicionados `payment_status`, `payment_method` e `payment_amount` em `appointments`.
- Em pacote já vinculado à cliente, o botão **Agendar todas** permite definir data e horário de cada sessão restante e criar todos os agendamentos de uma vez.
- As sessões criadas ficam como **Agendado** e só são consumidas quando o atendimento é concluído.

## SQL

Execute no Supabase antes de usar a V19:

`supabase/v19_finalizacao_pagamento_sessoes.sql`

A migração é incremental e não apaga dados existentes.

## Observação

A validação local de build não foi concluída neste ambiente porque a instalação das dependências do projeto excedeu o tempo disponível. O código foi alterado diretamente sobre a V18.2.1.
