# Inventário de telas, fluxo de design e lote do ClickUp

**Criado em:** 01/10/2026 (rodada 2) · Plano: [01-plano-mestre.md](01-plano-mestre.md) · Decisões: [04-riscos-e-decisoes.md](04-riscos-e-decisoes.md)
**Situação do ClickUp: NADA FOI CRIADO.** O Eric precisa criar o espaço "Vigen" à mão (ver seção 5). Este documento deixa tudo pronto para o PMO executar na chamada seguinte.

## 1. Fluxo de design (regra do Eric, 01/10/2026)
O Eric revisa o design **no sistema, tela por tela**, e anota o que precisa mudar. Se precisar alterar, mexe no Figma, exporta e pede a implantação da tela. Pode haver **funções novas** junto com o visual; tudo fica registrado na tarefa.

**Regra: uma tarefa por tela, agrupada por módulo** (tarefa-mãe por módulo; subtarefa por tela; lista "01 Front-end (novo design)"; tag do módulo).

Checklist de 4 etapas, igual em toda tarefa de tela:
- [ ] 1. Revisão do Eric no sistema (anotações na própria tarefa)
- [ ] 2. Ajustes no Figma e exportação (se necessário; marcar "não precisa" se aprovar como está)
- [ ] 3. Implantação (agente-ux-ui e os demais; cada função nova vira subtarefa)
- [ ] 4. Verificação do Eric: visual + funcionalidades + 390, 768 e 1440 px

Regras que seguem valendo (doc. 07 §7): só tokens do `base.css`, um commit por módulo, comentários em português, nenhuma regra de negócio alterada sem decisão do Eric. Função nova = solicitação de mudança (impacto registrado na subtarefa; só implanta com o "sim" do Eric).
Ordem: **sidebar/navegação primeiro** (FE-014, prioridade alta), depois casca, depois os módulos.
As telas abertas em janela flutuante (`@modal`) são a mesma tela do detalhe; ficam na tarefa do detalhe (checar nos dois modos: janela e página inteira).

## 2. Inventário de telas (fonte: árvore `src/app`, 01/10/2026)
Total: **58 telas** em 16 módulos, mais 3 itens de casca (sidebar, cabeçalho, avisos). Tag = tag do módulo no ClickUp.

| Mãe | Módulo (tag) | Telas (rota; subtarefa `.n`) |
|---|---|---|
| FE-020 | Base (`base`) | .1 Início `/`; .2 Dashboard `/dashboard`; .3 Notificações `/notificacoes`; .4 Mensagens `/mensagens`; .5 Aprovações lista `/aprovacoes`; .6 Aprovação detalhe `/aprovacoes/[id]` |
| FE-021 | RNC (`rnc`) | .1 Lista `/rncs`; .2 Nova `/rncs/nova`; .3 Detalhe `/rncs/[id]` |
| FE-022 | Plano de Ação (`plano-acao`) | .1 Lista `/plano-acao`; .2 Novo `/plano-acao/novo`; .3 Detalhe `/plano-acao/[id]`; .4 Plano `/plano-acao/planos/[id]` |
| FE-023 | Mapa de Processos (`processos`) | .1 Lista `/processos`; .2 Detalhe `/processos/[id]` |
| FE-024 | Ameaças e Oportunidades (`riscos`) | .1 Lista `/riscos`; .2 Novo `/riscos/novo`; .3 Detalhe `/riscos/[id]`; .4 Revisão geral `/riscos/revisao-geral` |
| FE-025 | SWOT (`swot`) | .1 Lista `/swot`; .2 Detalhe `/swot/[id]` |
| FE-026 | Perigos e Riscos, rota hira (`hira`) | .1 Lista `/hira`; .2 Novo `/hira/novo`; .3 Detalhe `/hira/[id]`; .4 Revisão geral `/hira/revisao-geral` |
| FE-027 | Aspectos e Impactos, LAIA (`laia`) | .1 Lista `/laia`; .2 Novo `/laia/novo`; .3 Detalhe `/laia/[id]`; .4 Revisão geral `/laia/revisao-geral` |
| FE-028 | Inspeções (`inspecoes`) | .1 Lista `/inspecoes`; .2 Nova `/inspecoes/nova`; .3 Detalhe `/inspecoes/[id]`; .4 Modelos `/inspecoes/modelos`; .5 Modelo detalhe `/inspecoes/modelos/[id]` |
| FE-029 | Auditoria (`auditorias`) | .1 Lista `/auditorias`; .2 Nova `/auditorias/nova`; .3 Detalhe `/auditorias/[id]`; .4 Programa `/auditorias/programa` |
| FE-030 | Documentos (`documentos`) | .1 Lista `/documentos`; .2 Meus `/documentos/meus`; .3 Novo `/documentos/novo`; .4 Detalhe `/documentos/[id]` |
| FE-031 | Acidentes e Incidentes (`incidentes`) | .1 Lista `/incidentes`; .2 Novo `/incidentes/novo`; .3 Detalhe `/incidentes/[id]` |
| FE-032 | Indicadores (`indicadores`) | .1 Lista `/indicadores`; .2 Meus `/indicadores/meus`; .3 Novo `/indicadores/novo`; .4 Detalhe `/indicadores/[id]` |
| FE-033 | Treinamentos (`treinamentos`) | .1 Lista `/treinamentos`; .2 Meus `/treinamentos/meus`; .3 Novo `/treinamentos/novo`; .4 Detalhe `/treinamentos/[id]`; .5 Matriz `/treinamentos/matriz`; .6 Auditoria `/treinamentos/auditoria` |
| FE-034 | Configurações (`configuracoes`) | .1 Configurações `/configuracoes` (10 abas: o Eric revisa aba por aba dentro da tarefa) |
| FE-035 | Público (`publico`) | .1 Login `/login`; .2 Validar documento `/validar-doc/[id]` |

Casca (fora dos módulos): **FE-014 Sidebar/navegação (primeira da lista, prioridade alta)**, FE-001 Cabeçalho, FE-003 Avisos, confirmações e estados.
As ondas FE-006 a FE-011 do plano mestre ficam **substituídas** por FE-020 a FE-035 (mesmo conteúdo, agora por módulo e tela). Ordem sugerida das mães: FE-020, FE-021, FE-022, depois qualidade (023, 028, 029, 030), gestão (024, 025, 032, 033), segurança e ambiente (026, 027, 031), por fim FE-034 e FE-035. O Eric pode reordenar.
Agentes por módulo: os do plano mestre (seção 7.2), sempre com `agente-ux-ui`; `agente-responsivo` e `agente-feedback-acessibilidade` na etapa 3.

## 3. Prazos provisórios, com folga (D-12)
**Todas as datas são PROVISÓRIAS e folgadas.** O Eric as ajusta conforme avança; o PMO confere no acompanhamento e só reporta desvio em relação à data que estiver no ClickUp naquele momento. Datas valem para a **tarefa-mãe/marco**; subtarefas de tela ficam sem data até o Eric iniciar a revisão do módulo.

| Marco / item | Data-alvo provisória | Folga |
|---|---|---|
| M1 Estabilizar (TR, BE-001 a BE-004, 3 correções de 01/10) | 31/12/2026 | cerca de 3 meses |
| FE-014 Sidebar (prioridade) | 31/01/2027 | cerca de 4 meses |
| M2 Casca (FE-001, FE-002, FE-003, FE-004, FE-005) | 28/02/2027 | |
| FE-020 Base, FE-021 RNC, FE-022 Plano de Ação | 30/04/2027 | |
| Qualidade (FE-023, 028, 029, 030) | 31/07/2027 | |
| Gestão (FE-024, 025, 032, 033) | 30/09/2027 | |
| Segurança e ambiente (FE-026, 027, 031) | 30/11/2027 | |
| FE-034, FE-035, FE-012 (varredura), M5 | 31/12/2027 | |
| M6 Produção endurecida (BE-005 a BE-012) | 31/03/2027, em paralelo | depende de D-06 a D-09 |

## 4. Lote do ClickUp pronto para criar
**Estrutura (Opção A, aprovada em D-03):** espaço **Vigen** > pasta **Projeto Vigen 2026** > listas `01 Front-end (novo design)`, `02 Back-end e produção`, `03 Transversal e testes`, `04 Backlog de ideias`; lista solta `Decisões do Eric`.
**Status:** Backlog, Pronto para fazer, Em andamento, Em revisão, Bloqueado, Concluído (se a ferramenta não permitir definir, registrar a limitação e usar os padrões do ClickUp).
**Tags:** `frontend`, `backend`, `transversal`, `teste-manual`, `bloqueado`, `sem-evidencia`, `decisao-do-eric`, `design`, `funcao-nova`, `provisoria`, `m1` a `m6`, e as tags de módulo da seção 2.

### 4.1 Lista 03 Transversal e testes
| ID | Tarefa | Prioridade | Situação ao criar |
|---|---|---|---|
| TR-001 | Registrar falhas de 01/10 (parcial: 3 falhas já informadas, ver TR-013, TR-014 e BE-013; falta o restante da rodada) | Urgente | Em andamento |
| TR-002 a TR-004 | Testes 1.1 a 1.11, 2.1 a 2.5, 3.1 a 3.12 | Urgente | Pronto para fazer |
| TR-005 | Corrigir defeitos (tarefa-mãe; filhas TR-013, TR-014 e BE-013) | Urgente | Em andamento |
| TR-013 | Falha: etiqueta "Sem evidência" e aviso à qualidade não funcionaram ao concluir ação sem evidência | Urgente | Em revisão (correção em curso pelo agente principal; depende de reteste do Eric) |
| TR-014 | **Função nova:** status "Concluído fora do prazo" (cor laranja) além da justificativa de data, que funcionou | Alta | Em revisão (idem) |
| TR-006, TR-008, TR-009, TR-010 | Confirmação ao fechar janela (D-07); eslint; tokens novos; créditos de ícones | Normal | Backlog / Pronto para fazer |
| TR-016 | Eric: trocar `vigen123` dos usuários de teste direto no banco do Neon (só rastreio; D-02) | Normal | Pronto para fazer, responsável Eric |

Critérios de aceite:
- **TR-013:** (1) concluir ação pela qualidade sem evidência grava a etiqueta "Sem evidência" visível na ação e na lista; (2) a pessoa da qualidade recebe o aviso (notificação) no mesmo momento; (3) `semEvidencia` coberto em script de integração (BE-003); (4) Eric repete os testes 3.x correspondentes e marca ok. Nunca "Concluído" antes do item 4.
- **TR-014:** (1) existe o status "Concluído fora do prazo", em laranja, nos tokens (sem cor solta) e legível (contraste AA); (2) ao concluir com data vencida e justificativa, a ação assume esse status; (3) lista, detalhe, kanban/filtros e indicadores tratam o novo status; (4) regra decidida pelo Eric: conta como concluída para indicadores? (pergunta aberta, ver D-17); (5) testes unitários e de integração; (6) Eric verifica no navegador.
- A terceira falha é **BE-013** (lista 02, seção 4.2).

### 4.2 Lista 02 Back-end e produção
| ID | Tarefa | Prioridade | Situação |
|---|---|---|---|
| BE-001 | Armazenamento Blob em produção | Urgente | Pronto para fazer (Eric configura) |
| BE-002 | Segurança operacional (senha do banco **já trocada** em D-02; resta conferir a variável na Vercel e TR-016) | Normal | Em revisão |
| BE-003, BE-004 | Scripts de integração; Documentos com envio real | Alta | Backlog |
| BE-013 (= falha 3) | **Falha:** na janela flutuante de Documento, baixar a revisão leva a tela toda preta (texto do servidor) e, ao voltar, retorna ao detalhe. Critério: (1) baixar revisão a partir da janela não sai da janela (download em nova aba ou fetch com `download`); (2) voltar não leva ao detalhe; (3) erro de arquivo ausente mostra aviso amigável, nunca texto cru; (4) teste 1.6 e 1.7 ok em 390/768/1440; (5) depende de BE-001 para o arquivo existir em produção | Urgente | Em revisão (correção em curso) |
| BE-005 a BE-012 | Backlog de produção (e-mail, backup, expurgo, cron, rate limit, observabilidade, checklist, criptografia) | Normal | Backlog |

### 4.3 Lista 01 Front-end (novo design)
Ordem: **FE-014 Sidebar** (Alta, Pronto para fazer, 1ª tarefa; reabre P4 do doc. 07 §9; entrega: novo desenho do Eric, no Figma, implantado e verificado), FE-001, FE-002, FE-003, FE-004, FE-005 (Backlog), depois mães FE-020 a FE-035 e suas 58 subtarefas (Backlog; descrição com o checklist da seção 1, a rota, os documentos [06](../06-desenho-modulos.md), [07](../07-plano-implantacao-design.md), [05](../05-guia-paginas-css.md), agente sugerido e a nota "datas provisórias"). FE-012, FE-013 (opcional) em Backlog.

### 4.4 Lista 04 Backlog de ideias
Itens de D-13 (exportar CSV, filtro "somente atrasadas", saudação, seletor de período, evoluções do doc. 06) e ideias de `docs/ideias/`: criar só como lembrete, sem prioridade.

### 4.5 Lista Decisões do Eric (tag `decisao-do-eric`, prioridade Alta)
Abertas: D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-13 e as novas D-16 (desenho do sidebar, ligada a FE-014) e D-17 (regra do novo status "Concluído fora do prazo" nos indicadores). As respondidas (D-01, D-02, D-03, D-11, D-12, D-14, D-15) ficam só no documento 04.

## 5. Ação do Eric para destravar o ClickUp
As ferramentas do PMO não têm operador para criar Espaço (`clickup_get_operators` retornou "Enabled operators: none"; só há criação de pasta, lista e tarefa). Estado em 01/10/2026: existem só "Indicadores do SGI" (pasta Projetos) e "Sharepoint SGI". Para seguir:
1. O Eric cria, no ClickUp, o espaço **Vigen** (vazio; pode manter os status padrão, o PMO tenta ajustá-los depois).
2. Avisa o PMO. Na chamada seguinte o PMO cria a pasta, as listas, as tags e as tarefas acima, e grava a tabela de mapeamento (seção 6).
O PMO não improvisou em outro espaço.

## 6. Mapeamento ID do plano para tarefa do ClickUp
Preenchido após a criação.

| ID | Tarefa no ClickUp |
|---|---|
| (vazio) | Nenhuma tarefa criada ainda |
