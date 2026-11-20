# Teste grátis de 7 dias — como ativar

1. **SQL:** no Supabase, abra *SQL Editor*, cole o conteúdo de `supabase/trial_v30.sql` e execute. Faça isso antes ou logo depois de publicar o novo front-end.
2. **Cadastro aberto:** *Authentication → Sign In / Providers → Email* → mantenha *Allow new users to sign up* ligado.
3. **Confirmação de e-mail:** recomendado manter *Confirm email* ligado. O app mostra a tela "Confirme seu e-mail" e o teste começa na criação da conta.
4. **URLs:** *Authentication → URL Configuration* → *Site URL* = `https://esteticproapp.vercel.app` e adicione o mesmo endereço (com `/**`) em *Redirect URLs*.
5. **Antiabuso (opcional, recomendado):** *Authentication → Attack Protection* → ative CAPTCHA (hCaptcha ou Turnstile). Sem isso, uma pessoa pode criar várias contas com e-mails diferentes.

## Como funciona
- O botão "Teste grátis por 7 dias" cria a conta com `signup_source = trial`. O banco marca `plan = trial` e `trial_ends_at = agora + 7 dias`.
- Durante o teste aparece o selo "Teste grátis · N dias" no topo. Ao vencer, o app mostra "Seu teste grátis terminou" e o banco passa a recusar leitura e escrita dos dados (RLS restritiva), mesmo que alguém use a API direto.
- Os dados da pessoa não são apagados; ao liberar o plano completo ela volta a ver tudo.
- Você (administradora) libera, prorroga ou bloqueia contas com os comandos SQL no final de `trial_v30.sql`.
- O módulo **Acessos** foi removido do app.

## Limites conhecidos
- Arquivos no *Storage* (fotos de evolução etc.) não são cobertos pela policy automática; as policies dos buckets continuam as atuais.
- A contagem de dias exibida usa o relógio do aparelho; o bloqueio de verdade usa o relógio do banco.
