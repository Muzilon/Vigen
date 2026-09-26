# Vigen — Revisão de segurança e isolamento (2026-09-26)

Nenhuma falha Crítica ou Alta. Isolamento entre empresas em duas camadas (extension + FKs compostas), SQL cru parametrizado, nenhum segredo versionado. Testes 15/15.

## Média
- **M1 — Corrida entre itens do plano e mudança de status da RNC** (`src/lib/plano-acao/servico.ts`, `src/lib/rnc/servico.ts`): adicionar/cancelar item em paralelo a "enviar para verificação" pode deixar RNC em verificação com item pendente. Correção: incrementar `rnc.versao` (ou `FOR UPDATE`) em toda escrita de item.
- **M2 — Login sem limite de tentativas** (`src/auth.ts`, `src/app/login/actions.ts`): permite força bruta e custo de CPU. Correção: rate limit por IP+e-mail com bloqueio temporário.
- **M3 — Permissão revogada vale por até 5 min** (`src/auth.ts`): conferir `ativo`/`tokenVersao` no banco nas ações de escrita e de dados sensíveis.

## Baixa
- B1 Filtros de URL inválidos geram 500 (`rncs/page.tsx`, `plano-acao/page.tsx`) — validar com zod.
- B2 Duas verificações simultâneas → erro P2002 vira 500 genérico — converter em ErroConflito.
- B3 Responsável sem `RNC_TRATAR` consegue tratar a RNC — **decisão de produto**.
- B4 Responsável/quem fora da obra vê a RNC e dados sensíveis por ser "envolvido" — **decisão de produto**.
- B5 `analiseCausa` sem limite de tamanho — validar estrutura e tamanho.
- B6 `/api/auth/session` expõe `obrasIds`/`tokenVersao` — remover do lado cliente.
- B7 Lista e Início escondem RNCs de outra obra em que o usuário é envolvido (inconsistente com o detalhe).

## Pontos positivos
Isolamento em duas camadas; lock otimista; numeração atômica; máquina de estados pura e testada; login sem enumeração de e-mail; datas no fuso da empresa.

---
## Correções aplicadas (2026-09-26)
- M1: `travarRnc` — toda escrita de item incrementa `rnc.versao` na mesma transação.
- M2: tabela `tentativa_login`; 5 falhas/15 min por e-mail, 20 por IP → bloqueio 15 min.
- M3: sessão e permissões conferidas no banco a cada request (revogação imediata).
- B1, B2, B5, B6, B7 corrigidos (filtros validados, P2002 → conflito, análise validada, sessão enxuta, lista usa a mesma regra do detalhe).
- B3: tratar exige `RNC_TRATAR`. B4: "quem" vê só as próprias ações (`/plano-acao/[id]`); dados sensíveis só com `RNC_VER_RESTRITAS`.
- Novo: Interações (thread por RNC/item, `/mensagens`, não lidas no menu). `notificar()` pronto para e-mail.
- Migração `20260926044913_seguranca_interacoes`. Testes: unit 23/23, fluxo 20/20, isolamento 11/11, lint e build OK.

### Pendências
- Limite por IP confia em `x-forwarded-for` (ok atrás da Vercel; o limite por e-mail vale sempre).
- Job de limpeza de `tentativa_login`.
- Contador de mensagens não lidas só atualiza na próxima navegação.
