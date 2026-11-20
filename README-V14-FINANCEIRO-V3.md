# EsteticPro — V14 Financeiro V3

## Novidade principal: múltiplas categorias com rateio

A V3 adiciona uma forma segura de dividir um único lançamento entre várias categorias.

Exemplo:
- Compra de produtos: R$ 300,00
- Produtos: R$ 200,00
- Materiais descartáveis: R$ 100,00

O lançamento continua sendo único, mas o relatório consegue enxergar o valor correto em cada categoria.

### Importante
Não é um simples multi-select de categorias. O sistema usa **rateio por valor**, porque selecionar duas categorias para o mesmo lançamento sem dividir o valor causaria duplicidade nos relatórios.

## Banco de dados
Execute:

`supabase/finance_v3.sql`

Ele cria `financial_transaction_categories` com RLS e validação de propriedade.

## Compatibilidade
- Lançamentos antigos continuam funcionando.
- Lançamentos com uma única categoria continuam usando `financial_transactions.category`.
- O rateio é opcional.
- A V3 mantém os recursos da V1 e V2.

## Teste recomendado
1. Criar uma despesa de R$ 300,00.
2. Escolher “Dividir em categorias”.
3. Informar Produtos = R$ 200,00.
4. Informar Materiais descartáveis = R$ 100,00.
5. Salvar.
6. Confirmar que a lista mostra as duas categorias.
7. Confirmar que “Despesas por categoria” soma R$ 200 em Produtos e R$ 100 em Materiais.
8. Editar o lançamento e testar novamente.
