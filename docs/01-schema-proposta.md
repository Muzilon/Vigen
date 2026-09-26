# Vigen — Marco 1: Proposta de schema (aguardando validação)

Status: **proposta, não aplicada**. Nada foi migrado. Scaffold bloqueado (Node.js não instalado).

## Entidades
| Modelo | Papel | Destaques |
|---|---|---|
| Empresa | tenant | plano, modulosAtivos[], diasAlertaPrazo (default 3), config Json |
| Usuario | login | email **único global**, senhaHash, papel (ADMIN/GESTOR_SGI/INSPETOR/COLABORADOR), tokenVersao (revogar JWT) |
| ObraUnidade | local | único por (empresa, nome) |
| ContadorSequencial | numeração | PK (empresa, tipo, ano); upsert atômico → RNC-2026-014 sem buracos |
| Rnc | RNC | status ABERTO→EM_ANALISE→PLANO_EM_EXECUCAO→EM_VERIFICACAO→ENCERRADO (+REABERTO, CANCELADO); analiseCausa Json (5 Porquês/Ishikawa estruturado); versao (lock otimista) |
| VerificacaoEficacia | histórico | tentativa n, EFICAZ/INEFICAZ, comentário, verificador |
| HistoricoStatusRnc | auditoria | append-only, de→para, usuário, snapshot |
| PlanoAcao | motor | origemTipo + origemId polimórfico (sem FK) |
| ItemAcao | 5W2H | quando = @db.Date; status PENDENTE/EM_ANDAMENTO/CONCLUIDO/CANCELADO |
| Anexo | genérico | entidadeTipo/entidadeId, Vercel Blob, soft delete |

## Decisões principais
- **Isolamento:** empresa_id em toda tabela + FKs compostas `(empresa_id, id)` — o Postgres recusa referências entre empresas. Na aplicação, `getDb()` com Prisma extension injeta empresa_id da sessão. RLS fica para depois do MVP.
- **Auth:** Auth.js v5, Credentials, sessão JWT (sem tabelas de adapter).
- **Calculado na leitura (não armazenado):** status_geral do plano e ATRASADO do item. Cron diário só notifica.
- **Reprovação:** grava verificação INEFICAZ → REABERTO → EM_ANALISE; o plano original é mantido e recebe novas ações.
- `onDelete: Restrict` na maioria dos casos; exclusão lógica (ativo/removidoEm).

## Pontos para validar
1. E-mail global (um consultor não pode usar o mesmo e-mail em duas empresas)?
2. Após reprovação: mesmo plano ou plano novo? Limite de tentativas?
3. Fuso por empresa (padrão America/Sao_Paulo)?
4. Existe cancelamento de RNC? Quem verifica a eficácia? O verificador pode ser o próprio responsável?
5. Numeração reinicia por ano? Prefixo por tipo?
6. INSPETOR/COLABORADOR veem só a própria obra ou a empresa toda?
7. Item 5W2H com responsável externo ou mais de um responsável?
8. Limites de anexo e retenção (ISO)?
9. LGPD: RNC de SSO com dados de acidentados precisa de restrição extra?

---
## Marco 2 — Scaffold + schema aplicado (2026-09-26)
- Decisões do dono incorporadas: login global com usuário em uma empresa; Perfil (permissões configuráveis pelo admin), Setor, UsuarioAcessoObra (escopo TODAS/SELECIONADAS); SolicitacaoCancelamento (aprovação do admin, auditável); numeração `RNC-001-26` reiniciando por ano; responsável 5W2H só interno; RncDadosSensiveis (LGPD, pronta para criptografia); fuso por empresa.
- Stack: Next 16.3 + React 19.2, Prisma 6.19, Auth.js 5 beta, Node 24, Postgres 16 local (`postgresql://vigen:vigen@localhost:5432/vigen`).
- Migrações: `init` + `regras_sql` (índice parcial de cancelamento pendente, trigger que torna historico_status_rnc append-only).
- build e lint OK. Obs.: npm 11 bloqueia install scripts — rodar `npx prisma generate` após instalar.

## Marco 3 — Autenticação + isolamento (2026-09-26)
- Auth.js v5 Credentials + JWT (revalida a cada 5 min; `tokenVersao` derruba sessões). Proxy exige login em tudo exceto /login.
- `getDb()` injeta empresa_id automaticamente; `prismaAdmin` só para seed/cron. Teste de isolamento: 11/11 OK.
- Seed: empresa Monto (admin, qualidade, inspetor, colaborador @monto.com.br) + Demo (admin@demo.com.br), senha `vigen123`.
- Limitações: escritas aninhadas/include e SQL cru não passam pela extension (FKs compostas cobrem no banco); filtro por obra é manual via `filtroObras(ctx)`.

## Marco 4 — Módulo RNC + Plano de Ação (2026-09-26)
- Domínio: `src/lib/rnc/` (estados, numeracao, servico, rotulos), `src/lib/plano-acao/` (status, servico). Lock otimista + histórico na mesma transação.
- Telas: Início, /rncs (filtros), /rncs/nova, /rncs/[id] (Resumo, Causa raiz 5 Porquês/Ishikawa/livre, Plano 5W2H, Verificação, Histórico, Cancelamento), /plano-acao (visão unificada).
- Testes: vitest 15/15; fluxo ponta-a-ponta 12/12 (inclui reabertura em ciclo 2, cancelamento aprovado, restrição LGPD automática, 10 numerações paralelas sem duplicata). lint + build OK.
- Pendências: anexos (Vercel Blob), tela de plano MANUAL, form de nova RNC perde campos em erro, dados de teste no banco dev (histórico append-only), dashboard e notificações/cron.
