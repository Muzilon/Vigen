# Consolidação do contexto do projeto Vigen (02/10/2026)

> Origem: relatórios de 3 subagentes (Haiku 4.5) que leram `.claude/agents/`, `docs/00` a `docs/07` e `docs/planejamento`, `ideias`, `ideias-implantadas`, `tarefas`, `relatorios` e `conversa-contexto-01.10.2026.md`. Eu li os relatórios, não os arquivos brutos. Onde um relatório contradizia outro ou o que já se sabia, a correção está na seção 8. Nada aqui é verificado no navegador.
> Não há segredos neste arquivo.

## 1. Diretrizes de trabalho (gravadas em `CLAUDE.md`, commit `6f8910c`)

- Nunca executar o trabalho direto: delegar a um subagente, **um subagente por tarefa**, planejando antes e rodando independentes em paralelo.
- Ler o **relatório** dos agentes, não os arquivos brutos; o Claude também gera um MD de relatório/consolidação.
- Modelos por tarefa: **Fable 5.1** arquitetura, bugs complexos, revisão de código; **Opus 5.5** tarefas simples, edições, testes, documentação, refatoração; **Haiku 4.5** pesquisas e resumos.
- Regras de convivência com o Eric (do contexto de 01/10): responder em português claro; separar "passou no tsc/build/testes" de "testado no navegador"; perguntar antes de ação com efeito externo (push, deploy, ClickUp fora do combinado, apagar); commits só quando ele pedir, um por módulo.

## 2. O projeto

Vigen: gestão integrada (ISO 9001/14001/45001), multi-tenant, para a Monto. Next.js 16 (leia `node_modules/next/dist/docs/` antes de codar), React 19, Prisma 6, Postgres (Neon, sa-east-1), Auth.js v5, vitest, CSS Modules com tokens em `src/paginas/css/base.css`. Produção em vigen.vercel.app (Hobby, funções em gru1). Migrations **não** rodam no build da Vercel.

Estrutura: página fina em `src/app/(app)/` → componente em `src/paginas/html/` → serviço/regras em `src/lib/<modulo>/`. Serviços recebem `Ator`; `prismaAdmin` só em seed, cron e login.

## 3. Os 21 agentes de `.claude/agents/`

Modelo indicado conforme relatado pelo B (confirmar no frontmatter antes de depender dele).

| Agente | Modelo | Papel | Observação-chave |
|---|---|---|---|
| arquitetura-dados | Fable | Schema, migrações, actions, permissões, anexos, e-mail, cron | Acionar antes de criar entidade/permissão/rota |
| integridade-dados | Fable | Trava otimista, histórico append-only, CHECKs, transações | Corrige; o QA só revisa |
| autenticacao-acesso | Fable | Login, perfis, permissões, `tokenVersao`, escopo por unidade | Sem SSO/MFA sem ordem do Eric |
| qa-revisao | Fable | Revisão ao fim da fatia | Não implementa |
| pmo | Fable | Plano e ClickUp | Só grava em `docs/planejamento/` e `docs/relatorios/`; sem commit/push |
| nao-conformidades | Opus | RNC e Plano de Ação 5W2H | Máquina de estados em `lib/rnc/estados.ts` |
| riscos-hira-laia | Opus | Riscos, SWOT, HIRA, LAIA | Score recalculado no servidor |
| documentos | Opus | Documentos ISO 9001 7.5 | Validade calculada, nunca gravada |
| treinamentos | Opus | Treinamentos e competências | Status calculado; ASO é futuro |
| auditorias-processos | Opus | Auditorias e Mapa de Processos | Hub que vincula módulos |
| inspecoes-incidentes | Opus | Campo/celular, incidentes | Incidente com pessoa envolvida é restrito (LGPD) |
| indicadores-sgi | Opus | Indicadores | Lançamento append-only |
| notificacoes | Opus | Sino, e-mail, cron, idempotência | Nunca texto livre de registro restrito |
| minha-fila | Opus | Início, Minhas ações, Aprovações | Não duplica regra de negócio |
| ux-ui | Opus | Telas, tokens, WCAG 2.1 AA | Só tokens do `base.css` |
| responsivo | Opus | 360px a desktop | Valida 390/768/1440 |
| feedback-acessibilidade | Opus | Feedback de envio, validação, a11y | Transversal |
| visao-minimalista | Opus | O que fica na tela principal | Nunca remove evidência de auditoria |
| pesquisa | Haiku | Pesquisa sem alterar código | Sem Write/Bash |
| busca-global | Opus | Ctrl+K | **FUTURO**, só com ordem do Eric |
| painel-auditoria | Opus | Prontidão para certificação | **FUTURO**, só com ordem do Eric |

### Regras que valem para todos

Isolamento entre empresas (`empresaId`, FKs compostas, `criarDbTenant`); LGPD (sensíveis `null` sem permissão `*_VER_RESTRITAS`, nada de texto livre em notificação); trava otimista por `versao` e histórico append-only na mesma transação; permissão nova = enum + migração + `TODAS_PERMISSOES` + perfil + rótulo; datas por `hojeNoFuso`; handlers e fontes de reavaliação registrados por import (esquecer deixa a função morta em silêncio); comentários em português; só tokens do `base.css`; ideias de `docs/ideias/` não são implementadas sem ordem; só a fatia pedida (se outra parte precisar mudar, descrever e parar); relatório final do agente em `docs/relatorios/AAAA-MM-DD-<fatia>-<assunto>.md`; sem segredos em arquivo versionado; nada removido sem validação.

## 4. Estado do planejamento

| Marco | Situação |
|---|---|
| M0 Plano aprovado | Concluído (01/10, plano v0.2) |
| M1 Estabilizar (31/12/2026) | Em andamento; bloqueado pelo reteste do Eric e pelo BE-001 |
| M2 Casca e componentes (28/02/2027) | Não iniciado; depende de M1 |
| M3 a M5 Design das 58 telas / 16 módulos | Não iniciado (datas provisórias até 30/11/2027) |
| M6 Produção endurecida (31/03/2027) | Em paralelo; e-mail, backup, expurgo, cron, rate limit |

Fluxo de design: Eric revisa no sistema, ajusta no Figma se precisar, pede implantação; **uma tarefa por tela**, ciclo de 4 etapas, um commit por módulo. Sidebar (FE-014) é a prioridade e espera a exportação do Figma (D-16).

## 5. Decisões do Eric

- **Respondidas:** D-01 (plano), D-02 (senhas, ele troca no Neon), D-03 (ClickUp opção A), D-11 (estabilizar antes de redesenhar), D-12 (prazos folgados; horas por semana não informadas), D-14 (P1 a P4, exceto sidebar), D-15, D-17 (concluído fora do prazo conta, laranja, sem notificação).
- **Abertas:** D-04 tokens novos, D-05 créditos de ícones, D-06 envio em Documentos (restaurar antigo ou ligar novo), D-07 confirmar ao fechar janela, D-08 e-mail real, D-09 LGPD/backup, D-10 extras, D-13 itens sem lastro, D-16 desenho do sidebar.
- As que mais travam trabalho: D-04, D-06, D-07, D-16.

## 6. Riscos mais graves (de 21 registrados)

- **R-01 (crítico):** janela flutuante e conclusão de ações não verificadas no navegador; 3 falhas relatadas.
- **R-02 (crítico):** sem armazenamento Blob em produção, o download de revisão falha. BE-001, dono Eric.
- **R-21 (alto):** conector do ClickUp limitado a 100 chamadas por dia; risco de duplicar.
- **R-04, R-05, R-06, R-07 (altos):** regra quebrada no redesign; sem backup do Postgres; LGPD de anexos; Eric como único testador e decisor.

## 7. Pendências

**Só do Eric:** reteste no navegador e preencher a seção 4 de `docs/relatorios/2026-10-01-testes-nao-verificados.md`; BE-001; trocar senhas de teste no Neon (TR-016); responder D-04, D-06, D-07, D-16; informar horas por semana, se há dados reais em produção, e quem mais testa.

**O Claude pode executar (por subagente):** planos `02-plano-frontend.md` e `03-plano-backend.md` (agente-pmo); zerar os 10 erros antigos de eslint (TR-008); casos novos nos scripts de integração (precisam de banco, indisponível aqui); retomar o lote do ClickUp (12 mães FE-024 a FE-035, 58 subtarefas, dependência FE-001→FE-014, tags), quando o Eric liberar e respeitando o limite diário; decidir o `UploadAnexo` simulado (depende de D-06).

**Ideias:** só HIRA/LAIA (heatmap, árvore, funil de controles, clone) estão implantadas. QR de cópia controlada, micro-quiz, swipe de inspeção e relatório de auditoria em 1 clique seguem como ideia (o doc de ideias implantadas e o guia divergem sobre QR/quiz em Documentos; conferir o código). RH/Incidentes, Alta Direção, Fornecedores e Calibração são rascunhos. `docs/tarefas/03-rh-incidentes-direcao.md` está vazio.

## 8. Correções e cautelas sobre os relatórios dos agentes

- O C1 contou **22** agentes e marcou `minha-fila` como futuro. Corretos: **21** agentes, e só `busca-global` e `painel-auditoria` são futuros.
- O C2 listou "push do git" como pendência crítica do Eric. Está **superada**: o push foi feito em 02/10 (branch `claude/youthful-dirac-su9dh8`).
- O C2 e o B trouxeram números e agrupamentos inconsistentes (por exemplo, "16+2+3+2" agentes no resumo do B; contagem de testes e de tarefas do ClickUp imprecisa). Valem as tabelas acima, não os totais dos relatórios.
- Fontes divergentes sobre o ClickUp: o contexto de 01/10 diz que as **58 subtarefas de tela ainda não foram criadas**; relatório do C2 sugere contagens parciais. Conferir o mapa ID → tarefa (`docs/planejamento/06-inventario-telas-e-lote-clickup.md`) antes de criar qualquer coisa.
- Duas migrations compartilham o prefixo `20260930100000` (`remove_requisitos_legais` e `item_acao_conclusao_sem_evidencia`). Ambas já aplicadas; não renomear.
- O contexto de 01/10 descreve Windows/PowerShell/GitHub Desktop/OneDrive; esta sessão roda em Linux na nuvem, sem banco. Comandos e scripts de integração não se aplicam aqui.
- Limite do Vercel Hobby ("não comercial") e dados reais em produção seguem sem resposta (afetam LGPD e R-10).
