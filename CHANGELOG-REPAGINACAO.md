# Repaginação EsteticPro — o que mudou

- **Login** em tela dividida (painel de marca + formulário), com botão claro/escuro.
- **Modo claro/escuro** no topo do sistema. Salvo no navegador e na conta (`user_settings.theme`); também em Configurações → Aparência.
- **Busca global** (`Ctrl/⌘ + K` ou `/`): clientes, agendamentos, procedimentos, estoque, pacotes e financeiro, além de "Ir para" e "Ações" (novo cliente, agendamento, lançamento, despesa, procedimento, alternar tema). Navegação por ↑ ↓ Enter Esc.
- **Dashboard** redesenhado: faturamento em destaque com gráfico diário, KPIs, agenda do dia, ações rápidas, rosca financeira, clientes recentes e próximos atendimentos ("Próximos retornos" virou "Próximos atendimentos").
- **Menu lateral** agrupado (Principal, Relacionamento, Gestão, Sistema).
- **Identidade oficial**: tokens de cor, Crimson Text + DM Sans (carregadas no `index.html`), símbolo original em `src/brand/symbol.js`, ícones/favicons/manifest atualizados.
- Arquivos novos: `src/theme.css`, `src/brand/symbol.js`. `src/styles.css` foi convertido para tokens de tema. Service worker: cache `v30`.
- Não alterados: `App.jsx.bak`, `App-EsteticPro-v10.jsx`.
