# EsteticPro V18 — Procedimentos, Pacotes e Agenda

## O que foi atualizado

- Agenda agora permite selecionar um procedimento cadastrado.
- Ao selecionar procedimento, valor e duração ficam visíveis e a duração pode preencher o horário final.
- Agenda permite selecionar um pacote já vinculado à cliente.
- Dentro do pacote, é possível escolher qual procedimento da composição será realizado naquela sessão.
- O agendamento guarda `procedure_id` e `client_package_id`.
- Pacotes vinculados à cliente aparecem na ficha profissional.
- Ficha da cliente ganhou ação **Adicionar pacote**.
- É possível vincular um pacote existente à cliente, informando data da compra, valor pago e observações.
- Ao marcar um atendimento de pacote como **Concluído**, uma sessão é registrada automaticamente.
- Ao desfazer o status **Concluído**, a sessão volta para o saldo do pacote.
- O banco mantém `used_sessions` sincronizado com o histórico de uso.
- O EsteticPro bloqueia utilização acima do total de sessões contratado.

## SQL

Execute no Supabase:

`supabase/procedimentos_pacotes_v18.sql`

O SQL é uma migração da V17 e não exige apagar as tabelas existentes.

## Fluxo da V18

Cliente → Pacote vinculado → Agenda → Procedimento da sessão → Atendimento concluído → Sessão utilizada

## Observação

A V18 mantém a possibilidade de registrar um procedimento personalizado quando ele ainda não estiver cadastrado. Para o fluxo integrado, prefira selecionar um procedimento existente.
