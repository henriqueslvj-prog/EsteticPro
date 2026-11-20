# EsteticPro — V13 Financeiro V2

## O que mudou

A V2 transforma o Financeiro em uma camada de análise, mantendo toda a V1:

- Comparação das receitas, despesas e resultado com o mês anterior.
- Gráfico diário de receitas x despesas.
- Ticket médio das receitas pagas.
- Receita pendente e margem operacional.
- Distribuição das receitas por forma de pagamento.
- Despesas agrupadas por categoria.
- Ranking objetivo das clientes que mais geraram receita no mês, quando a receita está vinculada a uma cliente.
- Área de contas a receber com ação rápida "Marcar recebido".
- Lançamentos, filtros, busca, edição e exclusão da V1 preservados.
- Layout responsivo para desktop e mobile.

## Banco de dados

Não é necessária uma nova tabela para os recursos da V2. A implementação usa os campos existentes de `financial_transactions`.

Recomenda-se manter o SQL de `supabase/finance.sql` aplicado no projeto.

## Observações

- As métricas financeiras consideram apenas lançamentos com status `pago`.
- "A receber" considera receitas com status `pendente`.
- O gráfico diário usa o dia de `transaction_date`.
- A comparação mensal consulta o mês imediatamente anterior ao período selecionado.
- O ranking de clientes depende de `client_id` preenchido na receita.
- Procedimentos ainda não possuem entidade própria no módulo financeiro; por isso a V2 não cria uma falsa relação com procedimentos. A integração automática Agenda → Atendimento → Pagamento → Financeiro fica para uma etapa posterior.
