# Base de conhecimento do PMO do Vigen

**Criada em:** 01/10/2026 · **Revisar até:** 30/12/2026 (90 dias) · **Dono:** PMO do Vigen · **Patrocinador:** Eric

Resumo prático de como gerir o Vigen. Não copia os textos das fontes; adapta as ideias a um projeto pequeno: **1 patrocinador + agentes de IA**, sem prazos contratuais.

## 1. Ciclo de vida do projeto
Fases com decisão (portão) entre elas, adaptadas ao tamanho do projeto (ISO 21502 fala em fases com pontos de decisão e em adaptar o rigor à complexidade).

| Fase | No Vigen | Portão (quem decide) |
|---|---|---|
| Iniciar | Objetivo, escopo, restrições (plano mestre) | Eric aprova o plano |
| Planejar | Planos de front e back, itens com ID e critério de aceite | Eric aprova prioridades |
| Executar | Agentes implementam, um módulo por vez | QA aprova cada entrega |
| Controlar | Acompanhamento, riscos, mudanças | Eric decide desvios |
| Encerrar fase | Evidências, atualização dos guias | Eric aceita |

## 2. Cadência de acompanhamento
- **Kanban como base** (Kanban Guide, 2025): fluxo visível no ClickUp, **limite de trabalho em andamento** (sugestão: no máximo 2 módulos de design e 2 itens de back ao mesmo tempo) e regras explícitas de cada status. Métricas úteis: itens em andamento, itens concluídos por semana, idade do item e tempo de ciclo.
- **Rituais leves emprestados do Scrum** (Scrum Guide, 2020): meta única por ciclo (equivale ao *Sprint Goal*), revisão do que foi entregue com o Eric (Sprint Review) e uma retrospectiva curta.
- **Ritmo proposto** (a confirmar pelo Eric): relatório de acompanhamento a cada semana ou a cada entrega grande, o que vier primeiro. Datas só quando o Eric fixar prazo.

## 3. Definição de pronto (DoD)
O Scrum Guide trata a DoD como a descrição formal do estado em que a entrega atinge a qualidade exigida; o que não atinge **não conta como entregue**. Para o Vigen, a DoD completa está no [plano mestre](01-plano-mestre.md), seção 9. Regra central: **sem evidência, não é concluído**, e entrega que depende de teste manual no navegador ainda não feito fica "em revisão".

## 4. Escopo e mudanças
- Escopo mora no plano mestre; cada item tem ID (`FE-`, `BE-`, `TR-`), critério de aceite verificável, tamanho e agente sugerido.
- **Mudança de escopo, prazo ou design = solicitação de mudança** (PMBOK e ISO 21502: avaliar o impacto em escopo, prazo, risco e custo **antes** de aprovar). Fluxo: pedido → impacto (1 parágrafo) → decisão do Eric → só então plano e ClickUp são atualizados.
- Regra de capacidade: ao entrar algo, perguntar "o que sai ou atrasa?".
- Ideias novas vão para o backlog (`docs/ideias/`), não para o plano ativo.

## 5. Riscos
Matriz probabilidade × impacto (Baixa/Média/Alta), nível Baixo, Médio, Alto ou Crítico, com resposta (evitar, reduzir, aceitar, transferir), dono e situação. O PMBOK 8 trata Risco como domínio próprio. Revisão do registro a cada relatório. Registro em [04-riscos-e-decisoes.md](04-riscos-e-decisoes.md).

## 6. Comunicação com o Eric
- Português claro, sem jargão; começa pela decisão necessária.
- Todo relatório termina com: resumo (3 linhas), arquivos gravados, ClickUp, pendências e decisões.
- Decisões ficam numeradas (`D-01`...) e saem da lista quando respondidas, com data e resposta registradas.
- Não decidir por conta própria escopo, prazo ou prioridade: propor e perguntar.

## 7. Como um projeto pequeno adapta tudo isto
1. **Um patrocinador, vários agentes:** o Eric é gargalo de decisão e de teste manual; o plano reserva tempo dele (testes, aprovações) e agrupa perguntas.
2. **Sem sprints fixos:** fluxo contínuo (Kanban) com metas por entrega.
3. **Governança mínima:** dois documentos (plano + riscos) e o ClickUp; nada de atas longas.
4. **Qualidade embutida:** o agente de QA revisa cada módulo antes do Eric.
5. **Duas fontes de verdade:** plano (o quê e por quê) e ClickUp (quem, quando, situação); divergência é defeito.

## 7b. Aprendizados da rodada 2 (01/10/2026)
- **Datas provisórias e folgadas:** quando o patrocinador prefere ritmo próprio, o PMO define datas largas, marca "provisória" e acompanha o desvio contra a data vigente, sem cobrar.
- **Design por tela:** ciclo de 4 etapas (revisão, Figma, implantação, verificação) como checklist em cada tarefa; função nova vira subtarefa com solicitação de mudança.
- **Limite das ferramentas:** o PMO não cria Espaço no ClickUp; quando falta uma permissão, para, registra e pede a ação ao Eric em vez de improvisar em outra área.

## 8. Fontes consultadas (01/10/2026)
- [Scrum Guide 2020](https://scrumguides.org/scrum-guide.html): Definição de Pronto, meta da Sprint, Product Backlog, Review e Retrospectiva.
- [The Kanban Guide (maio de 2025)](https://kanbanguides.org/english/): definição do fluxo, limite de WIP, métricas de fluxo.
- [ISO 21502:2020, visão geral (ISO)](https://www.iso.org/news/ref2645.html) e resumos secundários (ex.: [Umbrex](https://umbrex.com/resources/frameworks/project-management-frameworks/iso-21502/)): governança, ciclo de vida, controle de mudanças. A norma completa é paga e não foi lida; usamos só o resumo público.
- PMBOK Guide 8ª edição (PMI): princípios e domínios de desempenho (governança, escopo, cronograma, finanças, partes interessadas, recursos, risco), conhecidos por resumos de terceiros (ex.: [BrainBOK](https://www.brainbok.com/blog/pmp/pmbok-guide-7th-vs-8th-edition-what-has-changed)); o guia oficial é pago e não foi lido.

## 9. Skills de gestão usadas
- `operations:risk-assessment`: formato e matriz do registro de riscos.
- `product-management:roadmap-update`: formato Agora/Próximo/Depois, dependências e regra de capacidade ("o que sai?").
- Skills `operations:status-report`, `operations:change-request`, `operations:capacity-plan` e `engineering:deploy-checklist` existem no ambiente e serão usadas nos relatórios, mudanças e deploys das próximas rodadas.
