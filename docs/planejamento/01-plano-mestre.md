# Plano mestre do Vigen

**Versão:** 0.2 (APROVADO pelo Eric em 01/10/2026, com as atualizações abaixo) · **Data:** 01/10/2026 · **Patrocinador:** Eric

> **Atualizações da rodada 2 (01/10/2026):**
> - **Fluxo de design novo:** o Eric revisa cada tela no sistema, ajusta no Figma se precisar, e pede a implantação; uma tarefa por tela, por módulo, com ciclo de 4 etapas. As ondas FE-006 a FE-011 ficam substituídas por FE-020 a FE-035 (58 telas). Detalhe: [06-inventario-telas-e-lote-clickup.md](06-inventario-telas-e-lote-clickup.md).
> - **Prioridade:** redesenho do sidebar (FE-014) antes do resto do design; P4 do doc. 07 fica reaberta só para o sidebar (D-16).
> - **Estabilizar (M1) antes do redesign:** confirmado (D-11); o Eric executa por tarefa.
> - **Prazos (D-12):** datas provisórias e com muita folga, ajustadas pelo Eric; o PMO só verifica (06, seção 3).
> - **Falhas de 01/10:** três tarefas de correção (TR-013, TR-014, BE-013), nunca concluídas antes do reteste do Eric.
> - **Itens do design que faltam (cabeçalho, avisos, Configurações) (D-15):** tratados junto com todas as telas, na verificação do Eric, que também testa as funcionalidades.
> - **ClickUp:** Opção A aprovada e implantada na rodada 4 (ver atualização abaixo).
>
> **Atualizações da rodada 3 (01/10/2026):**
> - **D-17 respondida:** "Concluído fora do prazo" conta como ação concluída e mede o atendimento ao prazo; sem notificação, mas catalogado. TR-014 atualizado; nova tarefa **BE-014** (indicador de atendimento ao prazo no Dashboard/Indicadores, depende de TR-014).
> - **BE-001 vira prioritária** (Urgente, dono Eric, "Pronto para fazer"); o projeto segue em paralelo. **BE-013 depende de BE-001.** Passo a passo em 06, seção 4.2.
> - **ClickUp desbloqueado (rodada 4, 01/10/2026):** espaço "Vigen" visível; estrutura e a maior parte do lote criados; o conector tem limite de 100 chamadas por dia, então o restante continua na próxima chamada (06, seção 4.7). R-19 resolvido; R-21 novo.
Detalhamento virá em [02-plano-frontend.md] e [03-plano-backend.md] (próxima rodada). Riscos e decisões: [04-riscos-e-decisoes.md](04-riscos-e-decisoes.md). Método: [00-base-de-conhecimento-pmo.md](00-base-de-conhecimento-pmo.md).

## 1. Objetivo
Levar o Vigen (gestão integrada de qualidade, meio ambiente e segurança) a um estado **estável, seguro e com o novo design aplicado em todos os módulos**, pronto para uso real em produção (Vercel + Neon), sem alterar regras de negócio na mudança visual.

## 2. Escopo
**Dentro**
1. **Estabilizar** as entregas de 01/10/2026 (janela flutuante, conclusão de ações): rodar os testes manuais pendentes, corrigir o que falhou.
2. **Endurecer a produção**: arquivos (Blob), senhas, scripts de integração, e-mail, backup, expurgo de anexos.
3. **Aplicar o novo design** (paleta teal, Inter, sidebar por seções, nova logo) a todas as telas, avisos e janelas, seguindo as fases 2 a 5 do [documento 07](../07-plano-implantacao-design.md).
4. Renomes de texto já decididos (Perigos e Riscos, Ameaças e Oportunidades, Acidentes e Incidentes, Aspectos e Impactos, Auditoria).
5. Qualidade verificável: testes, acessibilidade, responsividade 390/768/1440.

**Fora (por enquanto)**
- Novos módulos e as ideias de `docs/ideias/` (fornecedores, calibração, gestão de mudanças, alta direção): backlog.
- Requisitos Legais (descontinuado em 30/09/2026; os campos de texto "requisito legal" em Perigos e Riscos e LAIA permanecem).
- Renomear URL, arquivos e permissão de HIRA (decisão P2: só texto).
- Evoluções de UX do documento 06 (Kanban do plano, RNC rápida, macroprocessos...) e itens de mockup sem lastro no código (exportar CSV, filtro "somente atrasadas"): só com decisão do Eric.
- `agente-painel-auditoria`: só com ordem do Eric.
- Treinamentos: ASO, LGPD, crachá digital, eSocial.

## 3. Premissas (explícitas)
| # | Premissa | Se falhar |
|---|---|---|
| PR-1 | O design de referência é a exportação do Figma em `docs/ideias/ideias_design/Vigen — Sistema (SGI)/` (fora do git) mais o [documento 07](../07-plano-implantacao-design.md). **Divergência a confirmar:** o `README.md` de `ideias_design/` está vazio e `01-design-system-paleta.md` é uma proposta; os tokens oficiais são os do `base.css` já reescrito. | Fidelidade visual cai; pedir exportação nova. |
| PR-2 | As perguntas P1 a P4 do documento 07 **já foram respondidas** (§9 do próprio documento): paleta teal e Inter (P1), só texto no renome da HIRA (P2), campos de requisito legal ficam (P3), sidebar por cliques com as categorias do §9 (P4). O pedido do Eric as listava como abertas: **confirmar que valem**. | Retrabalho de casca e menu. |
| PR-3 | Onde o Figma não tem quadro (cabeçalho, avisos, confirmações, estados vazios, telas de Configurações etc.), vale a regra do documento 07 §6: reaproveitar, copiar a tela irmã, e só em último caso desenhar e **mostrar ao Eric antes**. | Telas inconsistentes. |
| PR-4 | O design é **só apresentação**: nenhum dado, serviço, permissão ou schema muda. Se mudar, para e pergunta (doc. 07 §7). | Entra como solicitação de mudança. |
| PR-5 | Não há prazo fixado. Marcos são ordenados, sem datas, até o Eric informar. | Cronograma só indicativo. |
| PR-6 | A capacidade do Eric (testar no navegador, decidir) é o gargalo; os agentes executam quando acionados pelo agente principal. | Fila de decisões trava a execução. |
| PR-7 | Os usuários de teste e o seed continuam em produção até o Eric decidir o contrário. | Ver risco R-03. |
| PR-8 | Não pude rodar `git log`, `tsc` nem testes nesta rodada (sem ferramenta de execução). Estado de código vem dos documentos; **conferir no próximo acompanhamento**. | Plano baseado em informação desatualizada. |

## 4. Restrições
- **Vercel Hobby** (funções em São Paulo, `gru1`): limites do plano (tempo de execução, tamanho de requisição, execuções de cron) a conferir antes de depender deles; uso não comercial é cláusula do plano a confirmar pelo Eric.
- **Neon** (sa-east-1, plano gratuito presumido): limites de armazenamento e retenção de backup a conferir.
- Equipe = Eric + agentes de `.claude/agents/`. Um commit por módulo, só tokens do `base.css`, comentários em português (doc. 07 §7).
- Windows: `migrate dev` pede reset do banco; usar `migrate diff` + `migrate deploy` (guia §12). Nunca resetar banco.
- LGPD: nada de dados reais nos documentos e no ClickUp.

## 5. Estado de partida (01/10/2026)
- **Design:** Fase 0 e 1 concluídas (tokens teal, Inter, logos); Fase 2 concluída exceto o **cabeçalho**; fases 3 a 5 não iniciadas. Login e sidebar novos feitos.
- **Entregas recentes sem confirmação no navegador:** janela flutuante (16 telas) e conclusão de ações. 230 testes unitários, `tsc` e build passam, mas o Eric relatou falhas ainda não registradas ([relatório](../relatorios/2026-10-01-testes-nao-verificados.md), seção 4).
- **Produção:** login funcionando; download de revisão de documento retorna "Não encontrado" (hipótese: armazenamento Blob não configurado).
- **Dívida:** 10 erros de eslint em código de outra origem, scripts de integração sem casos novos, `UploadAnexo` de exemplo em Documentos.

## 6. Marcos e fases
Formato Agora / Próximo / Depois, sem datas. Cada marco só fecha com a definição de pronto (seção 9).

| Marco | Conteúdo | Itens | Depende de |
|---|---|---|---|
| **M0. Plano aprovado** | Eric aprova plano, estrutura ClickUp e lote inicial | D-01, D-03 | Eric |
| **M1. Estabilizar (AGORA)** | Testes manuais executados, falhas registradas e corrigidas, produção segura (arquivos, senhas), eslint limpo | TR-001 a TR-006, TR-008, BE-001 a BE-004 | M0 |
| **M2. Casca e componentes (PRÓXIMO)** | Cabeçalho, tokens aprovados, componentes compartilhados, avisos/confirmação/estados, janela flutuante no novo design | FE-001 a FE-005 | M1 (itens críticos) |
| **M3. Ondas 4a e 4b (PRÓXIMO)** | Base (Início, Dashboard, Notificações, Mensagens, Aprovações) e RNC + Plano de Ação | FE-006, FE-007 | M2 |
| **M4. Ondas 4c a 4e (DEPOIS)** | Qualidade, Gestão, Segurança e Meio Ambiente | FE-008 a FE-010 | M3 |
| **M5. Fechamento do design (DEPOIS)** | Configurações, varredura de cor solta, acessibilidade, 390/768/1440, guias atualizados | FE-011 a FE-013, TR-011 | M4 |
| **M6. Produção endurecida (em paralelo, DEPOIS de M1)** | E-mail real, backup, expurgo, cron, rate limit, criptografia por campo (se aprovada), observabilidade | BE-005 a BE-012 | M1, decisões D-06 a D-09 |

**Recomendação do PMO:** não começar M3 antes de M1 fechar, para não empilhar mudança visual sobre base não verificada. M2 pode começar em paralelo para itens sem relação com os defeitos (cabeçalho, tokens).

## 7. Itens preliminares (IDs estáveis)
Tamanho: P, M ou G. Situação inicial de todos: não iniciado, exceto onde indicado. Critério de aceite detalhado vem nos planos 02 e 03; aqui só o essencial.

### 7.1 Transversal e testes (TR)
| ID | Item | Critério de aceite (resumo) | Dep. | Tam. | Agente sugerido |
|---|---|---|---|---|---|
| TR-001 | Registrar as falhas que o Eric viu em 01/10 | Seção 4 do relatório preenchida, cada falha com nº do teste ou descrição | Eric | P | Eric + `agente-qa-revisao` |
| TR-002 | Executar testes 1.1 a 1.11 (janela flutuante) | Cada linha marcada ok ou falhou no relatório | TR-001 | M | Eric + `agente-qa-revisao` |
| TR-003 | Executar testes 2.1 a 2.5 (responsividade da janela) | Marcados em 390/768/1440 | TR-002 | M | `agente-responsivo` |
| TR-004 | Executar testes 3.1 a 3.12 (conclusão de ações) | Marcados; usuários de teste do guia §11 | TR-001 | M | `agente-nao-conformidades` + `agente-qa-revisao` |
| TR-005 | Corrigir defeitos de TR-002 a TR-004 | Cada defeito vira subitem com correção, teste e reteste ok | TR-002..004 | G (a dimensionar) | agente do módulo + `agente-qa-revisao` |
| TR-006 | Itens "outras pendências": confirmação ao fechar janela com formulário preenchido | Decisão D-07 registrada e, se sim, implementada | D-07 | P | `agente-feedback-acessibilidade` |
| TR-008 | eslint: zerar os 10 erros e 3 avisos de código de outra origem | `npm run lint` sem erros | nenhuma | M | `agente-qa-revisao` (+ `agente-documentos` para Documentos) |
| TR-009 | Aprovar e registrar tokens novos do `base.css` (alvo de toque, sombra, fundo escuro da janela) | Tokens aprovados e medidas literais trocadas | D-04 | P | `agente-ux-ui` |
| TR-010 | Créditos de ícones (Flaticon UIcons) | Decisão D-05 aplicada (rodapé de créditos ou plano pago) antes de publicar | D-05 | P | `agente-ux-ui` |
| TR-011 | Atualizar `docs/05-guia-paginas-css.md`, guia §10 e `docs/00-status.md` (este só se o Eric pedir) | Documentos refletem o estado final | M5 | P | PMO + `agente-ux-ui` |
| TR-012 | Checklist de revisão por módulo (QA) aplicado a cada onda | Relatório de QA gravado por módulo em `docs/relatorios/` | nenhuma | P | `agente-qa-revisao` |

### 7.2 Front-end (FE) — o que o plano 02 deverá cobrir
O plano 02 detalhará: tokens, telas por módulo, componentes, janela flutuante, estados, responsividade, acessibilidade, desempenho percebido, textos, testes de interface.

| ID | Item | Critério de aceite (resumo) | Dep. | Tam. | Agente sugerido |
|---|---|---|---|---|---|
| FE-001 | Cabeçalho do app (último da Fase 2) | Conforme Figma ou padrão aprovado; 390/768/1440 | PR-3 | M | `agente-ux-ui`, `agente-responsivo` |
| FE-002 | Componentes compartilhados no novo design (badge, botão, tabela, cartão, campo, alerta, heatmap, anexos, trilha de assinaturas, painel de notificações) | Todos só com tokens; páginas herdam | TR-009 | G | `agente-ux-ui` |
| FE-003 | Padrões de aviso: alerta, confirmação (modal próprio e acessível), estados vazio/carregando/erro/sem permissão | Foco preso, Esc fecha, `aria-live`, `prefers-reduced-motion` | FE-002 | G | `agente-feedback-acessibilidade` |
| FE-004 | Janela flutuante no novo design (inclui corrigir o que falhar em TR-005) | Testes 1.x e 2.x todos ok | TR-005, FE-003 | M | `agente-ux-ui`, `agente-responsivo` |
| FE-005 | Textos e renomes em todas as telas, menus, e-mails e notificações visíveis | Sem "HIRA" visível ao usuário; nomes do doc. 07 §9 | nenhuma | P | `agente-visao-minimalista` |
| FE-006 | Onda 4a: Início, Dashboard, Notificações, Mensagens, Aprovações | 1 commit por módulo; QA aprovado | FE-002..004 | G | `agente-ux-ui` + `agente-minha-fila`, `agente-notificacoes` |
| FE-007 | Onda 4b: RNC e Plano de Ação | `test:fluxo-rnc` passa; QA aprovado | FE-006 | G | `agente-ux-ui` + `agente-nao-conformidades` |
| FE-008 | Onda 4c: Mapa de Processos, Documentos, Inspeções, Auditoria | Idem; Inspeções em celular | FE-007 | G | `agente-ux-ui` + `agente-documentos`, `agente-inspecoes-incidentes`, `agente-auditorias-processos` |
| FE-009 | Onda 4d: Ameaças e Oportunidades, SWOT, Indicadores, Treinamentos | Idem | FE-008 | G | `agente-ux-ui` + `agente-riscos-hira-laia`, `agente-indicadores-sgi`, `agente-treinamentos` |
| FE-010 | Onda 4e: Perigos e Riscos, Acidentes e Incidentes, Aspectos e Impactos (LAIA) | Idem; Incidentes em celular | FE-009 | G | `agente-ux-ui` + `agente-riscos-hira-laia`, `agente-inspecoes-incidentes` |
| FE-011 | Onda 4f: Configurações (10 abas) | Idem | FE-010 | G | `agente-ux-ui` + `agente-autenticacao-acesso` |
| FE-012 | Varredura final: cor solta, WCAG 2.1 AA (inclui contraste da paleta), 390/768/1440 | Relatório de varredura sem pendência crítica | FE-011 | M | `agente-feedback-acessibilidade`, `agente-responsivo` |
| FE-013 | Busca global (Ctrl+K) e modo trilho da sidebar | **Opcional**, só se o Eric pedir (doc. 07 §3, fase 2 opcional) | D-10 | M | `agente-busca-global` |

### 7.3 Back-end (BE) — o que o plano 03 deverá cobrir
O plano 03 detalhará: schema e migrações, serviços e permissões, isolamento entre empresas, integridade, notificações e cron, anexos e Blob, e-mail, segurança e LGPD, observabilidade, deploy, backup, testes.

| ID | Item | Critério de aceite (resumo) | Dep. | Tam. | Agente sugerido |
|---|---|---|---|---|---|
| BE-001 | Armazenamento de arquivos em produção | `ARMAZENAMENTO=blob` e token configurados na Vercel; baixar revisão e anexo funciona em produção e em nova aba (testes 1.6 e 1.7) | Eric configura | M | `agente-arquitetura-dados` + `agente-documentos` |
| BE-002 | Segurança operacional | Senha do banco trocada e atualizada na Vercel; `vigen123` substituída ou usuários de teste desativados em produção | D-02 | P | `agente-autenticacao-acesso` (orienta); Eric executa |
| BE-003 | Scripts de integração com casos novos | Casos para conclusão pela qualidade, `semEvidencia`, notificação e justificativa de data; `test:fluxo-rnc`, anexos, notificações e isolamento passam num banco de teste | TR-004 | M | `agente-integridade-dados` + `agente-nao-conformidades` |
| BE-004 | Documentos: ligar o envio de arquivo de verdade | `UploadAnexo` real grava, remove "id-exemplo" e o código comentado; teste de envio ok | D-06, BE-001 | M | `agente-documentos` |
| BE-005 | E-mail real | `EMAIL_DRIVER` definido, e-mail de teste entregue, sem credenciais no repositório | D-08 | M | `agente-notificacoes` |
| BE-006 | Backup do Postgres | Rotina documentada e uma restauração testada | D-09 | M | `agente-arquitetura-dados` |
| BE-007 | Expurgo físico de anexos excluídos (LGPD) | Política de retenção aprovada, rotina e teste | D-09 | M | `agente-integridade-dados` |
| BE-008 | Cron e alertas na Vercel Hobby | `CRON_SECRET` definido; limites do plano conferidos; alerta de prazo e resumo semanal rodando em produção | BE-001 | M | `agente-notificacoes` |
| BE-009 | Limite de tentativas por IP confiável | Teste de isolamento e de login ok | nenhuma | M | `agente-autenticacao-acesso` |
| BE-010 | Observabilidade mínima | Erros de produção visíveis (logs da Vercel) e roteiro de diagnóstico | nenhuma | P | `agente-arquitetura-dados` |
| BE-011 | Checklist de deploy (`migrate deploy`, variáveis, rollback) | Documento usado no próximo deploy | nenhuma | P | PMO (`engineering:deploy-checklist`) |
| BE-014 | Indicador de atendimento ao prazo (% de ações concluídas no prazo × fora do prazo; D-17), ligado a Indicadores/Dashboard | Cálculo definido, exibido com tokens, teste unitário, Eric verifica; se a medição já existir, vira só verificação | TR-014 | M | `agente-indicadores-sgi` + `agente-nao-conformidades` |
| BE-012 | Criptografia em nível de campo | **Só se aprovada** (D-09); schema já preparado | D-09 | G | `agente-arquitetura-dados` + `agente-integridade-dados` |

## 8. Critérios de aceite do projeto
1. Todos os testes manuais do relatório de 01/10/2026 marcados ok (ou falha registrada com tarefa) e nenhum defeito crítico aberto.
2. Todas as telas, avisos e janelas no novo design, sem cor solta, validadas em 390, 768 e 1440 px sem rolagem horizontal da página.
3. Acessibilidade WCAG 2.1 AA verificada nas telas principais (teclado, foco, contraste, leitor de tela).
4. Produção: arquivos persistem, senhas trocadas, backup restaurável, e-mail funcionando (se aprovado).
5. `tsc`, `lint`, `npm test`, scripts de integração e build passam.
6. Guias atualizados e plano alinhado ao ClickUp.

## 9. Definição de pronto (DoD)
Um item só é **concluído** quando todos estes pontos têm evidência registrada:
1. `npx tsc --noEmit` sem erros.
2. `npm run lint` sem **novos** erros nos arquivos tocados (meta global: zero, TR-008).
3. `npm test` passa e, se tocar o módulo, o `npm run test:<modulo>` também.
4. Critério de aceite do item marcado, um a um.
5. Para tela: conferida em 390, 768 e 1440 px, estados vazio/erro/carregando/sem permissão, teclado e foco.
6. **Teste manual no navegador feito** (pelo Eric ou registrado no relatório). Entrega que depende de teste não verificado fica **em revisão**, nunca concluída.
7. `agente-qa-revisao` aprovou e o relatório está gravado em `docs/relatorios/`.
8. Regras do doc. 07 §7: só tokens, comentários em português atualizados, um commit por módulo (`design(<modulo>): ...`), sem regra de negócio alterada.
9. Hash do commit informado e tarefa do ClickUp atualizada com comentário e evidência.

## 10. Dependências principais
`M1 → M2 → M3 → M4 → M5`; `M1 → M6`. Dentro de M2: `TR-009 → FE-002 → FE-003 → FE-004`. BE-001 destrava TR-002 (testes 1.6 e 1.7), BE-004 e BE-008. TR-004 alimenta BE-003. As ondas de design também dependem de nenhum dado novo (PR-4).

## 11. Proposta de estrutura no ClickUp (para aprovação do Eric; nada foi criado)

**O que existe hoje (leitura de 01/10/2026):**
- Espaço **Indicadores do SGI**: lista solta "Indicadores - Pendências (E-mails)" e pasta **Projetos** com duas listas, **Projeto 1** e **Projeto 2** (não está vazia como se esperava; o conteúdo das tarefas não foi aberto). Status do espaço: `pendente`, `em progresso`, `concluído` (só 3).
- Espaço **Sharepoint SGI**: listas Atividades e Spreadsheet Import. **Não será tocado.**

**Opção A (recomendada): novo espaço "Vigen"** com status próprios, sem misturar com Projeto 1 e 2. Cria 1 espaço, 1 pasta e 5 listas.
**Opção B:** usar a pasta **Projetos** do espaço Indicadores do SGI, criando listas novas ao lado de Projeto 1 e 2. Só 3 status disponíveis; "em revisão" e "bloqueado" viram tags. Mistura com o que já existe.

**Estrutura da Opção A**
```
Espaço: Vigen
  Pasta: Projeto Vigen 2026
    01 Front-end (novo design)
    02 Back-end e produção
    03 Transversal e testes
    04 Backlog de ideias
  Lista solta: Decisões do Eric  (D-01...)
```
Riscos ficam no documento 04 (não viram tarefa, salvo ação de mitigação).

**Status sugeridos:** `Backlog` → `Pronto para fazer` → `Em andamento` → `Em revisão (QA e teste manual)` → `Concluído` (fechado, só com evidência). Mais `Bloqueado` (ativo). Limite de trabalho em andamento: 4 itens no total.

**Convenção de nomes:** `[FE-006] Onda 4a: Início, Dashboard, Notificações, Mensagens, Aprovações`. Descrição: objetivo, checklist de aceite, links para documentos, agente responsável, dependências. Prioridade: Urgente (crítico para M1), Alta, Normal, Baixa. **Datas só quando o Eric fixar.** Dependências com `clickup_add_task_dependency`.

**Tags:** `frontend`, `backend`, `transversal`, `teste-manual`, `bloqueado`, `sem-evidencia`, `decisao-do-eric`, marco (`m1`...`m6`) e módulo (`rnc`, `plano-acao`, `documentos`, `riscos`, `hira`, `laia`, `inspecoes`, `auditorias`, `incidentes`, `indicadores`, `treinamentos`, `configuracoes`, `base`).

**Lote inicial proposto (13 tarefas de trabalho mais as tarefas de decisão; M1 e início de M2; nenhuma concluída, nenhum prazo):**
| ID | Lista | Prioridade |
|---|---|---|
| TR-001, TR-002, TR-003, TR-004 | 03 Transversal e testes | Urgente |
| TR-005 (tarefa-mãe; subtarefas após TR-001) | 03 Transversal e testes | Urgente |
| TR-008 | 03 Transversal e testes | Normal |
| BE-001, BE-002 | 02 Back-end e produção | Urgente |
| BE-003, BE-004 | 02 Back-end e produção | Alta |
| FE-001 | 01 Front-end | Alta |
| TR-009, TR-010 | 03 Transversal e testes | Normal |
| D-01 a D-15 (tarefas de decisão, tag `decisao-do-eric`) | Decisões do Eric | Alta |

Os demais itens entram em `Backlog` no segundo lote, após o plano 02 e 03.

## 11b. Atualização da seção 11 (rodada 2)
- Opção A **aprovada e criada** na rodada 4 (01/10/2026), parcialmente (limite diário do conector); ver 11c e 06, seção 4.7.
- Lote inicial ampliado: TR-013, TR-014, TR-016, BE-013, FE-014, mães FE-020 a FE-035 e 58 subtarefas de tela; D-16 e D-17 novas. Lista completa em [06](06-inventario-telas-e-lote-clickup.md), seção 4.
- BE-002 muda: senha do banco já trocada; resta TR-016 (Eric troca `vigen123` no Neon).
- TR-001: falhas de 01/10 já parcialmente registradas (TR-013, TR-014, BE-013); o relatório de testes ainda precisa ser preenchido.

## 11c. Mapeamento ID do plano para tarefa do ClickUp
**Rodada 4 (01/10/2026): ClickUp desbloqueado, criação PARCIAL.** Espaço "Vigen" visível (workspace 9013448793). Criados: pasta, 5 listas, 9 decisões, 7+5 tarefas de TR, 7 de BE, FE-014, FE-001 a FE-005, FE-012, FE-013 e as mães FE-020 a FE-023. O conector atingiu o limite diário de 100 chamadas; o restante (mães FE-024 a FE-035, 58 subtarefas de tela, TR-007 se existir, itens BE-005 a BE-012 em separado e backlog de ideias) continua na próxima chamada, sem duplicar. Tabela completa, mapeamento de status e pendências em [06](06-inventario-telas-e-lote-clickup.md), seções 4.7 e 6.

| ID | Tarefa no ClickUp |
|---|---|
| FE-014 | [FE-014 Sidebar/navegação](https://app.clickup.com/t/86akrnyc4) |
| BE-001 | [BE-001 Blob em produção](https://app.clickup.com/t/86akrny4g) |
| TR-013, TR-014, BE-013 | [TR-013](https://app.clickup.com/t/86akrnxx8), [TR-014](https://app.clickup.com/t/86akrnxxc), [BE-013](https://app.clickup.com/t/86akrny4r) |
| Demais | ver 06, seção 6 |

## 12. Decisões pendentes
Lista completa e acompanhamento em [04-riscos-e-decisoes.md](04-riscos-e-decisoes.md), seção 2. D-01, D-02, D-03, D-11, D-12, D-14 (exceto sidebar) e D-15 estão **respondidas** em 01/10/2026. Abertas: D-04 a D-10, D-13 e D-16. **D-17 respondida na rodada 3** (concluído fora do prazo conta como concluída; etiqueta laranja; catalogado, sem notificação).
