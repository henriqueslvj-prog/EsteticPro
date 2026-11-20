# EsteticPro V15.1 — Perfil profissional

## O que foi adicionado
- Clique no bloco do perfil no topo para abrir **Meu perfil**.
- Edição do nome profissional.
- Edição do título exibido abaixo do nome (ex.: Profissional, Esteticista, Especialista em estética).
- Edição de telefone e Instagram.
- E-mail exibido como somente leitura.
- Upload, substituição e preview de foto de perfil.
- Foto armazenada em bucket privado do Supabase Storage.
- Foto vinculada à pasta individual do usuário (`{user_id}/...`).
- Avatar atualizado no topo após salvar.
- Nome atualizado também no metadata do Supabase Auth.
- Interface seguindo o padrão visual escuro do EsteticPro V15.

## SQL necessário
Execute `supabase/profile.sql` no SQL Editor do Supabase antes de testar o upload da foto.

O script adiciona os campos de perfil e cria o bucket privado `profile-avatars` com políticas para que cada profissional acesse apenas seus próprios arquivos.
