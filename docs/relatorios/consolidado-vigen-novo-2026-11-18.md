# Vigen-novo: o que existe em 18/11/2026

**Repositório:** `Muzilon/Vigen-novo`, branch `main`, último commit `31e5ccf`.
**Estado:** funciona e passa em 110 testes **no ambiente de testes**. **Nada foi usado por uma pessoa real ainda**: o deploy no Vercel depende das variáveis e do `migrate deploy` (ver §5).

## 1. Módulos prontos

| Módulo | Servidor | Telas | Avisos |
|---|---|---|---|
| Login por código no e-mail | ✓ | `/entrar` | e-mail do código |
| Plano de Ação | ✓ criar, iniciar, evidência, concluir, reprogramar com aprovação, trocar responsável, cancelar | lista (tabela e quadro), nova, detalhe, reprogramações | atribuída, troca, reprogramação, 5 dias úteis, vencida |
| RNC | ✓ registro → análise crítica → tratamento → ações → eficácia com ciclos; antecipação com aprovação; cancelamento em cascata | lista, nova, detalhe com «Próximo passo» | registrada, tratador, improcedente, última ação, eficácia (7 dias, vencida, antecipação), encerrada |
| Feriados | ✓ por empresa, importação nacional | `/configuracoes/feriados` (admin) | — |
| Sino | ✓ | `/avisos` + contador no menu | — |

## 2. Segurança (o que está garantido por teste)

- Cada empresa só vê os próprios dados (FKs compostas por empresa no banco + testes que tentam burlar).
- Confidencialidade em 3 níveis, com **uma** regra por módulo, usada em listas, detalhe, sino e e-mail.
- Administrador puro não vê RNC (doc 11 §8.8).
- Histórico só de inclusão (o banco recusa alterar e apagar).
- Trava otimista (versão) e ordem única de travas (RNC antes de ação).
- E-mail nunca leva descrição; mensagens de erro não vazam detalhe interno.
- Next.js atualizado para 16.4.5 (falha crítica corrigida).
- Teste que barra código de fornecedor (Vercel, Netlify, Neon, AWS) fora de `src/servidor/infra/`.

## 3. Decisões do Eric registradas

Doc 11 §7 (transparência do SGI), §8 (8 decisões da RNC), §9 (eficácia: antecipação com aprovação). Doc de portabilidade em `docs/portabilidade.md` do Vigen-novo.

## 4. O que falta na Fase 1

1. **Anexos de evidência** (aguarda confirmação do Cloudflare R2).
2. **Documentos** (fatia 5).
3. Cadastro de usuários e áreas pela tela (hoje só por script).
4. Agendador da tarefa diária de avisos (depois do deploy).
5. Design final (logo, fonte, paleta do Figma).
6. Unidades (hoje «unidade» = área).

## 5. Passos do Eric para colocar no ar

1. Gerar `AUTH_SEGREDO` e `CRON_SEGREDO` (comando no guia da conversa).
2. `npx prisma migrate deploy` no Neon: **11 migrações**. Nunca `migrate dev` ou `reset`.
3. `npx tsx scripts/criar-primeiro-usuario.ts "Empresa Teste" "Seu nome" seu@email` (use o e-mail da conta do Resend).
4. No Vercel: `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_REMETENTE`, `AUTH_SEGREDO`, `CRON_SEGREDO`, `APP_URL`; depois **Redeploy**.
5. Testar: login → criar ação → ver o aviso no sino → registrar uma RNC.

## 6. Guias de estudo

`docs/estudo/` do Vigen-novo: fatia 3a (Plano no servidor), 3b (telas), 4 (RNC).
