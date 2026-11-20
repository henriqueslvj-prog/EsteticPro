# EsteticPro V18.2.1 — Correção de salvamento de pacote do catálogo

Correção do formulário da Agenda para permitir agendar um pacote ativo do catálogo mesmo quando ele ainda não foi vinculado à cliente.

- `service_package_id` é obrigatório quando o tipo é pacote.
- `client_package_id` permanece opcional.
- Pacotes já vinculados continuam descontando sessões quando o atendimento é concluído.
- Pacotes apenas do catálogo são registrados sem descontar sessão.
