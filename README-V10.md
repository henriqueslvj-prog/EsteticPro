# EsteticPro V10 — Evoluções + Google Drive

## O que foi alterado

- Exclusão de evolução pelo próprio módulo Evolução.
- Ao excluir, a Edge Function `google-drive-delete-evolution` remove as imagens vinculadas do Google Drive e depois remove o registro do Supabase.
- A pasta da evolução também é removida quando encontrada.
- A identificação visual da evolução mostra o nome da cliente.
- Novos uploads passam a usar nomes legíveis no Google Drive:

```text
EsteticPro/
└── Clientes/
    └── Maria Silva - 8f31a2/
        └── Evolução - 22-09-2026 - Limpeza de pele - a42c91/
            ├── ANTES - 22-09-2026 - Limpeza de pele - ...jpg
            ├── DEPOIS - 22-09-2026 - Limpeza de pele - ...jpg
            └── ADICIONAL - 22-09-2026 - Limpeza de pele - ...jpg
```

CPF, telefone e outros dados pessoais não são usados nos nomes das pastas/arquivos.

## Deploy

1. Substitua o `src/App.jsx` e `src/styles.css` pelos arquivos desta versão.
2. Substitua a Edge Function `google-drive-upload` pela versão incluída.
3. Crie/deploy a nova Edge Function `google-drive-delete-evolution`.
4. Não altere `google-drive-auth` nem `google-drive-media`.
5. Não adicione tokens Google no frontend.

A V10 não exige alteração de schema SQL.

## Observação sobre arquivos antigos

As evoluções já existentes continuam vinculadas aos seus `drive_file_id`. A mudança de nomes é aplicada aos novos uploads; os arquivos antigos não são movidos ou renomeados automaticamente nesta versão.
