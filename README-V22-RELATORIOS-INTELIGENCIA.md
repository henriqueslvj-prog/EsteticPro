# EsteticPro V22 — Relatórios & Inteligência

Base: EsteticPro V21 — Estoque Integrado aos Procedimentos.

## Entregas
- Módulo Relatórios conectado aos dados reais do Supabase.
- Filtros de 7, 30, 90 dias, ano e período personalizado.
- Indicadores financeiros: receitas, despesas, resultado, ticket médio e pendências.
- Indicadores de agenda: atendimentos, concluídos, cancelados e faltas.
- Novos clientes no período.
- Ranking de procedimentos por volume e receita vinculada aos atendimentos.
- Resumo de estoque: entradas, saídas, estoque baixo e sem estoque.
- Produtos mais consumidos no período.
- Clientes sem retorno há 45 dias ou mais, para acompanhamento comercial.
- Interface responsiva mantendo o padrão visual do EsteticPro.

## Banco de dados
Esta versão não exige nova tabela. O módulo usa as tabelas já existentes: clients, appointments, financial_transactions, products e inventory_movements.

## Observação
Os indicadores financeiros consideram lançamentos com status `pago` para receitas/despesas realizadas e mostram `pendente` separadamente.
