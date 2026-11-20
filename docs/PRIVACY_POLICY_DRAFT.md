# EsteticPro — Política de Privacidade (rascunho para revisão jurídica)

**Versão:** 0.1 — 3 de outubro de 2026  
**Status:** minuta técnica; não publicar como documento jurídico final sem confirmar os dados do controlador, canais de contato, fornecedores e práticas reais.

## 1. Quem opera o EsteticPro
O EsteticPro é uma plataforma privada de organização de rotinas de profissionais de estética. Antes da publicação, identificar o nome/razão social do controlador, CPF/CNPJ quando aplicável, endereço e e-mail de contato para privacidade.

## 2. Dados tratados
Dependendo dos recursos utilizados, podem ser tratados: dados de conta e autenticação; dados profissionais e de perfil; informações de clientes inseridas pela profissional (nome, contato, agendamentos, pagamentos, observações); informações de anamnese e saúde; fotografias de evolução; dados de uso, registros técnicos e preferências.

A profissional deve inserir somente dados necessários ao atendimento e informar seus clientes sobre o tratamento aplicável. Dados de saúde são dados pessoais sensíveis segundo a LGPD e exigem base legal adequada.

## 3. Finalidades
Autenticar profissionais autorizadas; fornecer agenda, gestão de clientes, registros de atendimento, financeiro e lembretes; armazenar arquivos solicitados pela profissional; manter segurança, prevenir fraude, prestar suporte e cumprir obrigações legais.

## 4. Base legal e responsabilidades
A base legal deve ser avaliada para cada finalidade e categoria de dado. A profissional que registra dados de seus clientes pode atuar como controladora desses dados e deve definir a base legal, fornecer transparência e atender direitos dos titulares. O operador do EsteticPro e os fornecedores de infraestrutura podem tratar dados em nome da profissional conforme os papéis que forem confirmados contratualmente. Não presumir consentimento como base universal.

## 5. Armazenamento e fornecedores
O serviço utiliza Supabase para autenticação, banco de dados e recursos de backend, e pode integrar com Google Drive para arquivos de evolução mediante autorização da profissional. Confirmar regiões, contratos, escopos OAuth, políticas de retenção e subprocessadores antes da publicação. Arquivos do Google Drive ficam sujeitos também às configurações e políticas da conta Google da profissional.

## 6. Acesso e segurança
O acesso é restrito a profissionais convidadas e autorizadas. São previstas autenticação, controle de acesso, políticas de banco de dados e armazenamento, proteção de segredos no servidor e registros administrativos. Nenhum sistema pode garantir segurança absoluta. A efetiva implementação e revisão das políticas devem ser concluídas antes de afirmar que todas as medidas estão ativas.

## 7. Retenção e exclusão
Definir prazos de retenção por categoria e processo de exclusão de conta, dados, backups e arquivos no Drive. Desconectar a integração não necessariamente apaga arquivos já enviados ao Drive; a profissional deve poder gerir e excluir esses arquivos conforme as regras apresentadas no produto.

## 8. Direitos dos titulares
Pedidos de confirmação, acesso, correção, anonimização, bloqueio, eliminação, portabilidade e informações sobre compartilhamento devem ser direcionados ao canal de privacidade a ser informado pelo controlador, observadas as condições e exceções legais aplicáveis.

## 9. Incidentes e compartilhamentos
Documentar o processo de avaliação, resposta e comunicação de incidentes conforme a LGPD e regulamentação aplicável. Não vender dados pessoais. Qualquer compartilhamento adicional deve ser informado e ter base legal.

## 10. Atualizações
Publicar data, versão e resumo das alterações. Mudanças relevantes devem ser comunicadas e, quando necessário, requerer nova ciência ou consentimento específico.

## Pendências obrigatórias antes de publicar
- Preencher identidade e contato do controlador e do canal de privacidade.
- Confirmar papéis controlador/operador, bases legais e contratos com fornecedores.
- Confirmar hospedagem/região, logs, backups, retenção e exclusão efetiva.
- Confirmar escopos OAuth do Google e comportamento ao revogar acesso.
- Validar controles técnicos e fluxo de incidentes com revisão jurídica.
