# EsteticPro V21 — Estoque Integrado aos Procedimentos

## O que mudou
- Produtos podem ser vinculados a procedimentos com quantidade de consumo.
- Ao editar/criar um procedimento, a seção **Consumo de estoque** permite definir os produtos utilizados.
- Ao concluir um atendimento, a tela de finalização mostra os produtos configurados e o estoque atual.
- O consumo automático fica ativado por padrão, mas pode ser desativado naquela finalização.
- A baixa é registrada como movimentação de saída com motivo **Uso em atendimento**.
- O sistema impede concluir com consumo automático quando algum produto não possui estoque suficiente.
- Cada consumo fica vinculado ao agendamento para rastreabilidade.
- Se um atendimento concluído voltar para outro status, o consumo é estornado automaticamente quando a ação de status passa pelo EsteticPro.

## Instalação
1. Publique a V21.
2. No Supabase, execute `supabase/v21_estoque_procedimentos.sql` depois da V20.
3. Atualize o navegador com Ctrl+F5.
4. Edite um procedimento e vincule os produtos que ele utiliza.
5. Conclua um atendimento para testar a baixa automática.

## Exemplo
Procedimento: Limpeza de Pele
- Sabonete facial: 5 ml
- Máscara: 10 g
- Sérum: 2 ml

Ao concluir o atendimento, essas quantidades são baixadas do estoque.
