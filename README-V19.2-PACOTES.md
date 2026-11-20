# EsteticPro V19.2 — Pacotes

## Principais ajustes

- Vínculo de pacote com cliente em uma janela própria e simplificada.
- Ação "Vincular cliente" diretamente no card do pacote.
- Clientes inativas não aparecem para novos vínculos.
- Pacotes inativos não podem ser vinculados a novas clientes.
- A composição passou a ser a fonte do total de sessões.
- A quantidade de cada procedimento representa quantas sessões daquele procedimento existem no pacote.
- Exemplo: 3x Limpeza de Pele + 2x Peeling = 5 sessões.
- O total de sessões é calculado automaticamente pela soma da composição.
- Contratações anteriores continuam preservadas.

## SQL

Execute `supabase/v19_2_pacotes_cliente.sql` se a estrutura de `client_packages` ainda não estiver com as colunas usadas pela V19.2.
