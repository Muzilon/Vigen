# Vigen — Status consolidado (2026-09-26)

## Entregue
| Marco | Conteúdo |
|---|---|
| 1–2 | Next 16 + Prisma 6 + Postgres 16 local; schema multi-tenant (FKs compostas por empresa) |
| 3 | Auth.js (JWT, revogação imediata, bloqueio após 5 falhas), isolamento automático por empresa |
| 4 | RNC completa: numeração RNC-001-26, ciclo de status, causa raiz (5 Porquês/Ishikawa), plano 5W2H em ciclos, verificação, cancelamento com aprovação, LGPD (restrita + dados sensíveis) |
| 5 | Interações (conversas por RNC/ação) |
| 6 | Anexos (tipo validado pelo conteúdo, download sempre autenticado, soft delete) |
| 7 | Dashboard de indicadores |
| 8 | Notificações in-app + e-mail, alerta de prazo, atraso, resumo semanal (cron) |
| 9 | Administração: usuários, perfis/permissões, obras, setores, preferências |

Testes: unit 53 · fluxo 27 · anexos 11 · notificações 11 · isolamento 11 · admin 6 · lint/build OK. E2E no navegador validado.

## Como rodar
`npm run dev` → http://localhost:3000 · senha `vigen123` · admin@monto.com.br, qualidade@, inspetor@, colaborador@, admin@demo.com.br.

## Pendências
- Expurgo físico de anexos excluídos (retenção LGPD).
- Configurar e-mail real (`EMAIL_DRIVER` smtp/resend) e deploy na Vercel (Blob, CRON_SECRET, banco em nuvem).
- Backup em nuvem gratuito do Postgres.
- Criptografia em nível de campo (schema já preparado).
- Dashboard: agregar no banco quando crescer; plano de ação MANUAL (tela).
- **Testes não verificados** da janela flutuante e da conclusão de ações (01/10/2026): ver [relatório](relatorios/2026-10-01-testes-nao-verificados.md).

Relatórios: [01 schema e marcos](01-schema-proposta.md) · [02 revisão de segurança](02-revisao-seguranca.md) · [03 revisão final](03-revisao-final.md)
