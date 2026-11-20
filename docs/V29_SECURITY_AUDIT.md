# Revisão técnica inicial — RLS, Storage, privacidade e acesso V29

**Data:** 3 de outubro de 2026  
**Escopo:** revisão estática dos arquivos disponíveis no repositório, não uma auditoria executada no projeto Supabase em produção.

## Achados observados
1. O schema inicial contém política de acesso por proprietário para `clients` e políticas próprias de `profiles`; isso é uma boa base, mas não prova cobertura uniforme de todas as tabelas.
2. O aplicativo utiliza Supabase Storage para fotos de perfil e integração Google Drive para arquivos de evolução. A proteção depende das políticas concretas dos buckets e da autorização das Edge Functions.
3. Antes desta versão, a interface de login continha fluxo de cadastro por `auth.signUp`. Ocultar o link no frontend não desativa o cadastro público no Supabase Auth.
4. A verificação de aprovação na interface, isoladamente, não impede chamadas diretas ao REST/Storage; por isso a migração V29 adiciona uma função de aprovação e políticas restritivas a tabelas com RLS já habilitado e ao `storage.objects`.

## Limitações importantes
- Não foi possível consultar as políticas realmente instaladas no projeto Supabase (pg_policies, buckets e permissões) a partir deste repositório.
- A migração não habilita RLS automaticamente em tabelas que estejam sem RLS, pois isso pode interromper operações legítimas. Essas tabelas precisam ser identificadas e corrigidas após inspeção do banco real.
- O tratamento de dados de saúde e fotografias exige avaliação jurídica e definição das bases legais, papéis de controlador/operador, retenção e canais de titulares.
- A função de convite depende de SMTP/e-mail Supabase configurado e de segredos server-side. Não colocar service role no navegador.
- Confirme que o e-mail administrador definido no SQL é a conta correta antes de executar. Não se deve confiar somente em um endereço de e-mail sem verificar o usuário existente no projeto.
- O SQL deve ser validado em ambiente de teste com backup antes da produção. Testar conta admin, convite pendente, confirmação de e-mail, revogação, usuário bloqueado, REST e Storage.

## Checklist operacional
- [ ] Desativar “Allow new users to sign up” no Supabase Auth.
- [ ] Confirmar redirect URL de produção e Preview no Supabase Auth.
- [ ] Confirmar SMTP de produção e limites de envio de convite.
- [ ] Implantar `manage-access` com `SUPABASE_SERVICE_ROLE_KEY` apenas nos secrets do Supabase.
- [ ] Confirmar e-mail do administrador inicial e testar recuperação de acesso.
- [ ] Listar todas as tabelas públicas e conferir `relrowsecurity`, permissive policies e restrictive policies.
- [ ] Conferir políticas de cada bucket Storage, inclusive uploads, leitura, update e delete.
- [ ] Testar REST API/Storage com conta bloqueada e sem registro aprovado.
- [ ] Definir procedimento de incidente, exportação, exclusão, backup e retenção.
- [ ] Revisar Política de Privacidade e Termos com profissional jurídico antes de publicar.
