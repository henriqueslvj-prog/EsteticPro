# EsteticPro V24 — Configurações

Base: V23 — Anamnese Digital + PDF.

## Entregue
- Módulo Configurações funcional e integrado à navegação.
- Meu perfil com atalho para o perfil já existente.
- Dados do espaço: nome, descrição, contatos, endereço, cidade/UF e logo privada.
- Preferências de Agenda.
- Preferências de Atendimento e consumo de estoque.
- Área de WhatsApp para preferências/estado da integração sem expor credenciais.
- Preferências Financeiras.
- Preferências de Estoque.
- Configurações de Documentos/PDF, incluindo rodapé e texto padrão da anamnese.
- Preferência visual Escuro/Sistema, preservando a identidade EsteticPro.
- Área de Segurança e integrações.
- Layout responsivo para desktop e mobile.

## SQL
Execute `supabase/v24_configuracoes.sql` no SQL Editor do Supabase antes de usar as funções persistentes da V24.

## Observação
As preferências ficam armazenadas, mas os módulos operacionais existentes ainda não foram refatorados para consumir todas essas preferências automaticamente. A V24 prepara essa camada de configuração de forma segura e separada.


## V24.1 — Tema claro
- A opção **Sistema** foi substituída por **Claro**.
- O padrão do EsteticPro agora é `light`.
- Preferências antigas salvas como `system` são convertidas para `light` pela migração `supabase/v24_1_tema_claro.sql`.
- A opção **Escuro** continua disponível.
