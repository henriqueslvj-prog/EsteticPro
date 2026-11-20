# EsteticPro V16 — Ficha Profissional da Cliente

Base: EsteticPro V15.1 — Perfil Profissional.

## Atualização

A área de Clientes agora possui uma ficha profissional integrada, aberta ao clicar no card da cliente.

### Incluído
- Resumo da cliente e dados de contato.
- Atalho para WhatsApp quando telefone estiver cadastrado.
- Atalhos para novo agendamento, nova evolução e edição da ficha.
- Indicadores de atendimentos concluídos, receitas pagas, valores em aberto e despesas vinculadas.
- Próximo retorno.
- Histórico recente de agendamentos.
- Histórico recente de evoluções.
- Histórico recente de lançamentos financeiros.
- Dados cadastrais e observações.
- Layout responsivo alinhado ao padrão visual V15/V15.1.

## Banco
Nenhuma nova tabela é necessária. A ficha consulta as tabelas existentes:
- clients
- appointments
- client_evolutions
- financial_transactions

## Publicação
1. Substitua os arquivos do projeto pela versão deste ZIP.
2. Execute `npm install`.
3. Execute `npm run build`.
4. Publique no Vercel.
