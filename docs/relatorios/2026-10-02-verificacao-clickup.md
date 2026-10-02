# Verificação do ClickUp contra o plano (02/10/2026)

**Resultado: VERIFICAÇÃO INCOMPLETA.** O conector do ClickUp respondeu `RATE_LIMIT_EXCEEDED` (100 de 100 chamadas diárias já usadas, nova tentativa só em cerca de 9 h). Nenhuma leitura do ClickUp foi possível. Este relatório entrega apenas o lado ESPERADO (extraído dos documentos) e o que os documentos AFIRMAM estar criado; a coluna "Confirmado no ClickUp" está toda como **não verificado**. Nada foi criado, alterado ou comentado no ClickUp.

**Chamadas de API ao ClickUp:** 1 (filtro das 5 listas, com subtarefas e fechadas), que falhou por limite. Nenhuma outra tentada.

**Documentos usados (mais recentes):** `06-inventario-telas-e-lote-clickup.md` (rodada 4, 01/10/2026, seções 4.7 e 6) e `01-plano-mestre.md` v0.2 (rodadas 2 a 4), `04-riscos-e-decisoes.md`, `docs/conversa-contexto-01.10.2026.md`. Não existe `docs/planejamento/05-acompanhamento/` nem `02-plano-frontend.md` / `03-plano-backend.md`. Os documentos concordam entre si sobre o que foi criado.

## 1. Totais (esperado x criado segundo os documentos)

| Grupo | Esperado | Criado (segundo 06 seção 6) | Faltando (segundo 06) | Confirmado no ClickUp |
|---|---|---|---|---|
| Estrutura (espaço, pasta, 4 listas, lista Decisões) | 1 + 1 + 5 | todos | 0 | não verificado |
| Decisões abertas (D-04 a D-10, D-13, D-16) | 9 | 9 | 0 | não verificado |
| Decisões respondidas (D-01, 02, 03, 11, 12, 14, 15, 17) | 8, só no documento 04 (não viram tarefa, por desenho) | n/a | n/a | n/a |
| TR (001 a 006, 008, 009, 010, 013, 014, 016) | 12 | 12 | 0 | não verificado |
| BE (001 a 004, 013, 014 e agregada 005 a 012) | 7 tarefas (14 itens do plano) | 7 | 0 (ver nota 3) | não verificado |
| FE casca e opcionais (014, 001 a 005, 012, 013) | 8 | 8 | 0 | não verificado |
| FE mães de módulo (020 a 035) | 16 | 4 (020 a 023) | 12 (024 a 035) | não verificado |
| Subtarefas de tela | 58 | 0 | 58 | não verificado |
| Backlog de ideias (lista 04) | itens de D-13 e `docs/ideias/` | 0 | indefinido | não verificado |
| Dependências | 10 registradas + 3 a registrar | 10 | 3 | não verificado |

**Total de tarefas esperadas:** 9 + 12 + 7 + 8 + 16 + 58 = **110** (mais backlog de ideias). **Cadastradas segundo os documentos:** 40. **Faltando segundo os documentos:** 70 (12 mães + 58 subtarefas). **Divergentes, duplicadas, extras fora do plano:** não verificável (limite). Risco de duplicata é baixo: os documentos registram que as 12 tentativas de criar mães falharam todas por limite, sem criação parcial.

## 2. Tabela por item (situação esperada, segundo o doc. 06)

Legenda: "Doc." = o que o documento diz existir; "ClickUp" = confirmação real (não verificado em todos).

### Decisões (lista Decisões do Eric, id 901329199272)
| ID | Doc. | ClickUp |
|---|---|---|
| D-04 | criada, to do | não verificado |
| D-05 | criada, to do | não verificado |
| D-06 | criada, to do | não verificado |
| D-07 | criada, to do | não verificado |
| D-08 | criada, to do | não verificado |
| D-09 | criada, to do | não verificado |
| D-10 | criada, to do | não verificado |
| D-13 | criada, to do | não verificado |
| D-16 | criada, to do | não verificado |
| D-01, D-02, D-03, D-11, D-12, D-14, D-15, D-17 | respondidas; só no doc. 04 | n/a |

Obs.: o plano mestre (seção 11) falava em "D-01 a D-15" como tarefas; o doc. 06 (mais recente) substitui por "somente as 9 abertas". Usado o doc. 06.

### Lista 03 Transversal e testes (id 901329199270)
| ID | Status esperado | Observação |
|---|---|---|
| TR-001 | in progress | |
| TR-002 | to do | depende de TR-001 e BE-001 |
| TR-003 | to do | |
| TR-004 | to do | |
| TR-005 | in progress | mãe de TR-013, TR-014, BE-013 |
| TR-006 | planning | |
| TR-008 | to do | |
| TR-009 | planning | |
| TR-010 | planning | |
| TR-013 | update required | |
| TR-014 | update required | |
| TR-016 | to do | **responsável Eric ainda não atribuído** (pendência dos docs) |
| TR-007 | não consta | ausente do plano mestre §7.1 e do lote; decidir |
| TR-011 | não está no lote | existe no plano mestre (M5); decidir |
| TR-012 | não está no lote | existe no plano mestre (checklist de QA por onda); decidir (lacuna não citada nos docs) |

### Lista 02 Back-end e produção (id 901329199269)
| ID | Status esperado | Observação |
|---|---|---|
| BE-001 | to do, Urgente, dono Eric | |
| BE-013 | update required | depende de BE-001 |
| BE-014 | planning | depende de TR-014 |
| BE-002 | update required | |
| BE-003 | planning | |
| BE-004 | planning | depende de BE-001 |
| BE-005 a BE-012 | planning, **uma tarefa agregada** | o plano mestre tem 8 itens separados (e-mail, backup, expurgo, cron, rate limit, observabilidade, checklist, criptografia) com dependências próprias (D-08, D-09, BE-001); decidir se desmembra |

### Lista 01 Front-end (id 901329199268)
| ID | Status esperado | Observação |
|---|---|---|
| FE-014 | to do, Alta, 31/01/2027 | primeira da lista |
| FE-001 | planning | **dependência FE-001 -> FE-014 falta** |
| FE-002 | planning | aguarda TR-009 |
| FE-003 | planning | aguarda FE-002 |
| FE-004 | planning | aguarda TR-005 e FE-003 |
| FE-005 | planning | |
| FE-012 | planning | |
| FE-013 | planning | opcional |
| FE-006 a FE-011 | substituídas por FE-020 a FE-035 (não devem existir como tarefa) | conferir que não existem |

### Mães e subtarefas de tela
| Mãe | Módulo (tag) | Mãe no ClickUp (doc.) | Subtarefas esperadas | Criadas (doc.) |
|---|---|---|---|---|
| FE-020 | Base (`base`) | criada, 30/04/2027 | 6 | 0 |
| FE-021 | RNC (`rnc`) | criada, 30/04/2027 | 3 | 0 |
| FE-022 | Plano de Ação (`plano-acao`) | criada, 30/04/2027 | 4 | 0 |
| FE-023 | Mapa de Processos (`processos`) | criada, 31/07/2027 | 2 | 0 |
| FE-024 | Ameaças e Oportunidades (`riscos`) | **FALTANDO** | 4 | 0 |
| FE-025 | SWOT (`swot`) | **FALTANDO** | 2 | 0 |
| FE-026 | Perigos e Riscos (`hira`) | **FALTANDO** | 4 | 0 |
| FE-027 | Aspectos e Impactos (`laia`) | **FALTANDO** | 4 | 0 |
| FE-028 | Inspeções (`inspecoes`) | **FALTANDO** | 5 | 0 |
| FE-029 | Auditoria (`auditorias`) | **FALTANDO** | 4 | 0 |
| FE-030 | Documentos (`documentos`) | **FALTANDO** | 4 | 0 |
| FE-031 | Acidentes e Incidentes (`incidentes`) | **FALTANDO** | 3 | 0 |
| FE-032 | Indicadores (`indicadores`) | **FALTANDO** | 4 | 0 |
| FE-033 | Treinamentos (`treinamentos`) | **FALTANDO** | 6 | 0 |
| FE-034 | Configurações (`configuracoes`) | **FALTANDO** | 1 | 0 |
| FE-035 | Público (`publico`) | **FALTANDO** | 2 | 0 |
| **Total** | | 4 de 16 | **58** | **0 de 58** |

Subtarefas esperadas, por rota (nome `[FE-0xx.n] Tela: Nome`, sem data): FE-020 .1 Início, .2 Dashboard, .3 Notificações, .4 Mensagens, .5 Aprovações lista, .6 Aprovação detalhe; FE-021 .1 Lista, .2 Nova, .3 Detalhe; FE-022 .1 Lista, .2 Novo, .3 Detalhe, .4 Plano; FE-023 .1 Lista, .2 Detalhe; FE-024 .1 Lista, .2 Novo, .3 Detalhe, .4 Revisão geral; FE-025 .1 Lista, .2 Detalhe; FE-026 .1 a .4 (Lista, Novo, Detalhe, Revisão geral); FE-027 .1 a .4 (idem); FE-028 .1 Lista, .2 Nova, .3 Detalhe, .4 Modelos, .5 Modelo detalhe; FE-029 .1 Lista, .2 Nova, .3 Detalhe, .4 Programa; FE-030 .1 Lista, .2 Meus, .3 Novo, .4 Detalhe; FE-031 .1 Lista, .2 Novo, .3 Detalhe; FE-032 .1 Lista, .2 Meus, .3 Novo, .4 Detalhe; FE-033 .1 Lista, .2 Meus, .3 Novo, .4 Detalhe, .5 Matriz, .6 Auditoria; FE-034 .1 Configurações (10 abas); FE-035 .1 Login, .2 Validar documento. Soma conferida: 58.

### Itens pendentes citados pelo contexto
| Item | Situação segundo os docs | ClickUp |
|---|---|---|
| FE-001 -> FE-014 (dependência) | falta | não verificado |
| Mães FE-020..035 aguardam FE-014 | opcional; escrito na descrição | não verificado |
| FE-022 aguarda TR-013 e TR-014 | opcional | não verificado |
| TR-016 atribuída ao Eric | falta | não verificado |
| Tags `bloqueado`, `m3`, `m4` | ainda não aplicadas (nenhuma tarefa as usa; `m3` e `m4` só fariam sentido nas mães, `bloqueado` em tarefa bloqueada) | não verificado |
| TR-007 e TR-011 | decisão do Eric pendente | não verificado |
| 10 dependências registradas | listadas em 06 §4.7 (8 pares: BE-013<-BE-001, BE-014<-TR-014, FE-002<-TR-009, FE-003<-FE-002, FE-004<-TR-005 e FE-003, BE-004<-BE-001, agregada<-BE-001, TR-002<-TR-001 e BE-001) | não verificado |
| Lista 04 Backlog de ideias | vazia | não verificado |
| Lista solta "List" (id 901329199190) | criada pelo ClickUp, intocada, no espaço Vigen; é item extra fora do plano | não verificado |

### Divergências internas entre documentos
1. Plano mestre §11: "D-01 a D-15 como tarefas de decisão" x doc. 06: só 9 abertas. Seguido o doc. 06.
2. Plano mestre diz FE-006 a FE-011 como ondas; doc. 06 as substitui por FE-020 a FE-035. Seguido o doc. 06.
3. Contagem de dependências: doc. 06 diz "10"; a lista nominal tem 8 pares (alguns com duas origens, ex. FE-004 e TR-002, totalizando 10 vínculos). Consistente se contar vínculos.
4. TR-012 está no plano mestre (checklist de QA por módulo) e em lugar nenhum do lote nem da lista de decisões sobre TR-007/TR-011. É lacuna silenciosa.
5. Planos 02 e 03 prometidos e não escritos: os critérios de aceite por item ainda estão só no plano mestre e no doc. 06.

## 3. Para criar/corrigir (ordem de prioridade, com custo estimado em chamadas)

Primeiro, **repetir esta verificação** quando o limite zerar (em cerca de 9 h): 1 a 2 chamadas de `clickup_filter_tasks` nas 5 listas (cerca de 110 tarefas cabem em 2 páginas de 100).

| Prioridade | Ação | Custo estimado |
|---|---|---|
| 1 | Reexecutar a verificação (filtro das 5 listas, páginas 0 e 1) e confrontar com este relatório | 2 chamadas |
| 2 | Atribuir TR-016 ao Eric (corrige responsável) | 1 |
| 3 | Dependência FE-001 aguarda FE-014 | 1 |
| 4 | Criar as 12 mães FE-024 a FE-035 (status planning, tags `frontend`, `design`, `provisoria` + módulo; datas do doc. 06 §3) | 12 |
| 5 | Criar as 58 subtarefas de tela (parent = mãe; sem data; checklist de 4 etapas), em ordem: FE-020, FE-021, FE-022, depois qualidade (023, 028, 029, 030), gestão (024, 025, 032, 033), segurança e ambiente (026, 027, 031), FE-034, FE-035 | 58 (ou 1 chamada com `clickup_execute_operator` em lote, após `clickup_get_operators`; operadores avançados estavam desativados) |
| 6 | Decidir com o Eric TR-007, TR-011 e TR-012; se entrarem, criar na lista 03 | 3 |
| 7 | Dependências opcionais: mães aguardam FE-014 (16), FE-022 aguarda TR-013 e TR-014 (2) | até 18 |
| 8 | Desmembrar BE-005 a BE-012 em 8 filhas (se o Eric quiser) | 8 |
| 9 | Popular lista 04 Backlog de ideias (D-13, `docs/ideias/`), sem prioridade | cerca de 5 a 10 |
| 10 | Aplicar tags `bloqueado` (quando houver bloqueio), `m3`, `m4` (mães) | 1 a 20 |

**Estimativa total do que falta (itens 2 a 9):** cerca de 110 a 130 chamadas individuais, ou seja, mais de um dia do limite atual. Recomendação: lotes diários (dia 1: itens 1 a 4 e subtarefas de FE-020 a FE-022, cerca de 30 chamadas; dias seguintes: demais módulos), ou o Eric avaliar plano com limite maior, ou testar o `clickup_execute_operator` em lote para reduzir drasticamente as chamadas.

## 4. Pendências para o Eric
- Entram TR-007, TR-011 e TR-012 no ClickUp?
- Desmembrar BE-005 a BE-012 em tarefas separadas?
- Subir o plano do conector ou aceitar criação em lotes diários?
