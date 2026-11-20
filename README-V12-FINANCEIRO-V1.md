# EsteticPro — V12 · Financeiro V1

Esta versão evolui o módulo Financeiro sem alterar a arquitetura existente do EsteticPro.

## O que foi implementado

- 4 indicadores: Receitas pagas, Despesas pagas, Resultado e A receber.
- Totais do mês calculados com base em lançamentos pagos.
- A receber calculado a partir de receitas pendentes.
- Busca por lançamento, cliente, categoria ou forma de pagamento.
- Filtro por tipo: Todos, Receitas e Despesas.
- Filtro por status: Pagos, Pendentes e Cancelados.
- Filtro por categoria.
- Botão para limpar filtros.
- Contador de lançamentos filtrados.
- Status visível em cada lançamento.
- Modal de lançamento revisado.
- Campos: descrição, valor, data, categoria, status, forma de pagamento, cliente e observações.
- Categorias de receita e despesa organizadas.
- Cliente disponível para receitas.
- Exclusão e edição preservadas.
- Índices Supabase para status/data e categoria adicionados ao finance.sql.
- Layout responsivo preservado para desktop e mobile.

## Banco de dados

A estrutura existente de `financial_transactions` já suportava os campos utilizados nesta V1. Portanto, não foi criada uma nova tabela nem alterada a estrutura principal. O arquivo `supabase/finance.sql` apenas adiciona índices para melhorar consultas por status/data e categoria.

## Observação sobre o build

O código foi atualizado e empacotado a partir da versão V11.1 existente. A validação de build local não pôde ser concluída neste ambiente porque as dependências npm não estavam instaladas e a tentativa de instalação atingiu o limite de tempo. Recomenda-se executar `npm install` e `npm run build` localmente antes do deploy.
