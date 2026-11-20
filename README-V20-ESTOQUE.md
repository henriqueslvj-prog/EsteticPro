# EsteticPro V20 — Estoque

## O que esta versão adiciona
- Cadastro de produtos
- Categoria, marca, unidade, fornecedor, lote e validade
- Estoque inicial
- Estoque mínimo
- Custo de aquisição e preço de referência
- Ativo/Inativo
- Entradas e saídas
- Bloqueio de saída acima do estoque disponível
- Histórico de movimentações
- Indicadores de produtos ativos, estoque baixo e sem estoque

## Banco de dados
Execute no Supabase:

`supabase/estoque_v20.sql`

A movimentação é a fonte de alteração do estoque. A aplicação não altera o estoque atual diretamente após o cadastro.

## Próxima evolução sugerida
V21 pode vincular produtos aos procedimentos e registrar consumo automaticamente ao concluir um atendimento.
