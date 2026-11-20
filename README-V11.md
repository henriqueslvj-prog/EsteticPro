# EsteticPro — V11.1 Corrigida

Correções desta versão:
- Corrigido erro de build causado por import duplicado de `ChevronRight` em `src/App.jsx`.
- Corrigido o caminho da Edge Function `google-drive-delete-photo` para o formato aceito pelo Supabase: `supabase/functions/google-drive-delete-photo/index.ts`.
- Galeria separada em Antes, Depois e Adicionais.
- Miniaturas com dimensões uniformes sem cortar a imagem (`object-fit: contain`).
- Clique/toque na imagem abre o visualizador.
- Navegação anterior/próxima, ESC, clique fora e swipe no celular.
- Exclusão individual de foto sincronizada com o Google Drive.
- Alteração do tipo da foto.
- Edição da evolução permite adicionar novas fotos sem apagar as existentes.

## Deploy da nova Edge Function

```bash
supabase functions deploy google-drive-delete-photo
```

Não coloque tokens do Google no frontend.
