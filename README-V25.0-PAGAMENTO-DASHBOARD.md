# EsteticPro V25.0 — Pagamento único + Dashboard

## Pagamento com múltiplas formas

Quando um atendimento é pago usando duas ou mais formas (ex.: Pix + cartão), o EsteticPro mantém o detalhamento em `appointment_payment_parts`, mas cria **um único lançamento de receita paga** em `financial_transactions`, com o valor total recebido e a forma de pagamento combinada.

Isso evita que o mesmo atendimento seja contado como duas receitas para o cálculo do ticket médio.

Se houver saldo pendente, o saldo continua como um lançamento separado com status `pendente`.

## Ticket médio

O Dashboard e o módulo Financeiro passam a contar uma receita automática vinculada a um mesmo `appointment_id` como um único atendimento para o ticket médio. Isso também torna o indicador mais resistente a registros históricos antigos que tenham sido gravados como múltiplas linhas por forma de pagamento.

## Dashboard

A V25.0 melhora a hierarquia visual, espaçamento, alinhamento e legibilidade do painel Financeiro, indicadores, métricas e cards principais, preservando a identidade visual do EsteticPro.

## Banco de dados

Não há SQL obrigatório nesta versão. A tabela `appointment_payment_parts` continua armazenando cada forma de pagamento individual para manter o detalhamento do recebimento.
