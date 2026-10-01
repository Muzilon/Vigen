# Inventário de telas, fluxo de design e lote do ClickUp

**Criado em:** 01/10/2026 (rodada 2) · Plano: [01-plano-mestre.md](01-plano-mestre.md) · Decisões: [04-riscos-e-decisoes.md](04-riscos-e-decisoes.md)
**Situação do ClickUp (rodada 4, 01/10/2026): DESBLOQUEADO, criação PARCIAL.** Espaço "Vigen" (id 901314639679, workspace 9013448793) visível. Pasta, listas, decisões, TR, BE, FE-014, casca e 4 das 16 mães de módulo foram criados. O conector tem **limite de 100 chamadas por dia** e esgotou; o que falta e como continuar sem duplicar está na seção 4.7. Mapeamento de IDs na seção 6.

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
| TR-014 | **Função nova:** etiqueta laranja "Concluído fora do prazo" além da justificativa de data, que funcionou (decisão D-17 em 01/10: conta como concluída; status do item segue CONCLUIDO; fora do prazo = data de conclusão maior que o prazo; sem notificação, mas catalogado) | Alta | Em revisão (idem) |
| TR-006, TR-008, TR-009, TR-010 | Confirmação ao fechar janela (D-07); eslint; tokens novos; créditos de ícones | Normal | Backlog / Pronto para fazer |
| TR-016 | Eric: trocar `vigen123` dos usuários de teste direto no banco do Neon (só rastreio; D-02) | Normal | Pronto para fazer, responsável Eric |

Critérios de aceite:
- **TR-013:** (1) concluir ação pela qualidade sem evidência grava a etiqueta "Sem evidência" visível na ação e na lista; (2) a pessoa da qualidade recebe o aviso (notificação) no mesmo momento; (3) `semEvidencia` coberto em script de integração (BE-003); (4) Eric repete os testes 3.x correspondentes e marca ok. Nunca "Concluído" antes do item 4.
- **TR-014 (atualizado pela D-17):** (1) existe a etiqueta "Concluído fora do prazo", em laranja, nos tokens (sem cor solta) e legível (contraste AA); (2) ao concluir com data de conclusão maior que o prazo, a ação mostra a etiqueta e o status continua CONCLUIDO; (3) lista, detalhe, kanban/filtros tratam a etiqueta; (4) **resolvido (D-17):** conta como concluída; **não gera notificação**; fica catalogada (registrada e consultável); (5) testes unitários e de integração; (6) Eric verifica no navegador; (7) a medição agregada é a tarefa BE-014.
- **BE-014 (nova, D-17):** indicador de **atendimento ao prazo** (percentual de ações concluídas no prazo × fora do prazo), ligado ao módulo Indicadores/Dashboard. Critério: (1) agente principal confirma se a medição já existe; se existir, a tarefa vira só verificação; (2) cálculo = concluídas com conclusão menor ou igual ao prazo ÷ total de concluídas, por período; (3) aparece no Dashboard/Indicadores com tokens e textos em português; (4) coberto por teste unitário; (5) Eric verifica. Agente: `agente-indicadores-sgi` + `agente-nao-conformidades`. Depende de TR-014. Lista 02, prioridade Normal, Backlog, tag `indicadores`.
- A terceira falha é **BE-013** (lista 02, seção 4.2).

### 4.2 Lista 02 Back-end e produção
| ID | Tarefa | Prioridade | Situação |
|---|---|---|---|
| BE-001 | **ATIVIDADE PRIORITÁRIA (01/10):** armazenamento Blob em produção. Dono: Eric; o projeto segue em paralelo. Passo a passo: (1) na Vercel, abrir o projeto e a aba Storage; criar um Blob store; (2) ligar o store ao projeto Vigen (a Vercel cria o `BLOB_READ_WRITE_TOKEN`); (3) em Environment Variables, conferir `BLOB_READ_WRITE_TOKEN` e definir `ARMAZENAMENTO=blob` para Production; (4) fazer novo deploy (redeploy); (5) em produção, enviar um documento e baixar a revisão (testes 1.6 e 1.7), conferindo que abre sem "Não encontrado". Nunca colar o token em documento ou comentário. | Urgente | Pronto para fazer, dono Eric |
| BE-014 | Indicador de atendimento ao prazo (concluídas no prazo × fora do prazo), ver critério na seção 4.1 | Normal | Backlog (depende de TR-014) |
| BE-002 | Segurança operacional (senha do banco **já trocada** em D-02; resta conferir a variável na Vercel e TR-016) | Normal | Em revisão |
| BE-003, BE-004 | Scripts de integração; Documentos com envio real | Alta | Backlog |
| BE-013 (= falha 3) | **Falha:** na janela flutuante de Documento, baixar a revisão leva a tela toda preta (texto do servidor) e, ao voltar, retorna ao detalhe. Critério: (1) baixar revisão a partir da janela não sai da janela (download em nova aba ou fetch com `download`); (2) voltar não leva ao detalhe; (3) erro de arquivo ausente mostra aviso amigável, nunca texto cru; (4) teste 1.6 e 1.7 ok em 390/768/1440; (5) **depende de BE-001** (dependência a registrar no ClickUp: BE-013 aguarda BE-001) para o arquivo existir em produção | Urgente | Em revisão (correção em curso) |
| BE-005 a BE-012 | Backlog de produção (e-mail, backup, expurgo, cron, rate limit, observabilidade, checklist, criptografia) | Normal | Backlog |

### 4.3 Lista 01 Front-end (novo design)
Ordem: **FE-014 Sidebar** (Alta, Pronto para fazer, 1ª tarefa; reabre P4 do doc. 07 §9; entrega: novo desenho do Eric, no Figma, implantado e verificado), FE-001, FE-002, FE-003, FE-004, FE-005 (Backlog), depois mães FE-020 a FE-035 e suas 58 subtarefas (Backlog; descrição com o checklist da seção 1, a rota, os documentos [06](../06-desenho-modulos.md), [07](../07-plano-implantacao-design.md), [05](../05-guia-paginas-css.md), agente sugerido e a nota "datas provisórias"). FE-012, FE-013 (opcional) em Backlog.

### 4.4 Lista 04 Backlog de ideias
Itens de D-13 (exportar CSV, filtro "somente atrasadas", saudação, seletor de período, evoluções do doc. 06) e ideias de `docs/ideias/`: criar só como lembrete, sem prioridade.

### 4.5 Lista Decisões do Eric (tag `decisao-do-eric`, prioridade Alta)
Abertas: D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-13 e D-16 (desenho do sidebar, ligada a FE-014). As respondidas (D-01, D-02, D-03, D-11, D-12, D-14, D-15 e **D-17**, esta em 01/10 rodada 3) ficam só no documento 04.

### 4.6 Observações de criação (para quando o espaço estiver visível)
- Status: tentar ajustar para Backlog, Pronto para fazer, Em andamento, Em revisão, Bloqueado, Concluído. Se a ferramenta não permitir (as ferramentas do PMO só definem status ao criar lista; operadores avançados estão desativados), usar os padrões da lista e registrar aqui o mapeamento nome sugerido para nome existente. Também depende de as tags existirem no espaço (as ferramentas só aplicam tag já existente; se não for possível criá-las, registrar a limitação e usar prefixo no nome ou na descrição).
- Datas: só nas mães e marcos (seção 3); subtarefas de tela sem data; nenhuma tarefa nasce Concluída; TR-013, TR-014 e BE-013 nascem Em revisão.
- Dependências a registrar: BE-013 aguarda BE-001; BE-014 aguarda TR-014; FE-002 aguarda TR-009; FE-003 aguarda FE-002; FE-004 aguarda TR-005 e FE-003; BE-004 e BE-008 aguardam BE-001; TR-002 aguarda TR-001 e BE-001 (testes 1.6 e 1.7).

## 4.7 Execução da rodada 4 (01/10/2026): o que foi criado, mapeamentos e o que falta
**Estrutura criada** (espaço Vigen, id 901314639679): pasta "Projeto Vigen 2026" (id 901319555693) com as listas 01 Front-end (novo design) id 901329199268, 02 Back-end e produção id 901329199269, 03 Transversal e testes id 901329199270, 04 Backlog de ideias id 901329199271; lista solta "Decisões do Eric" id 901329199272. O espaço já tinha uma lista vazia chamada "List" (id 901329199190), criada pelo ClickUp; não foi tocada. O espaço "Team Space" (pasta "Projeto Recipe") não é do Vigen e não foi tocado.

**Status (limitação registrada):** as listas herdam os status do espaço e as ferramentas do PMO não os personalizam (operadores avançados desativados). Status existentes: to do, planning, in progress, at risk, update required, on hold, complete, cancelled. **Mapeamento adotado:**

| Nome sugerido | Status usado no ClickUp |
|---|---|
| Backlog | planning |
| Pronto para fazer | to do |
| Em andamento | in progress |
| Em revisão | update required |
| Bloqueado | on hold (ou at risk, se houver risco sem bloqueio) |
| Concluído | complete |

**Tags:** a ferramenta cria a tag automaticamente ao criar a tarefa com `tags` (testado e confirmado). Sem limitação. Já existem: frontend, backend, transversal, teste-manual, sem-evidencia, decisao-do-eric, design, funcao-nova, provisoria, m1, m2, m5, m6 e tags de módulo (base, rnc, plano-acao, processos, riscos, swot, hira, laia, inspecoes, auditorias, documentos, incidentes, indicadores, treinamentos, configuracoes, publico) conforme cada tarefa for criada. Ainda não aplicadas: `bloqueado`, `m3`, `m4`.

**Datas e responsável:** datas só nas mães e marcos (seção 3), todas descritas como provisórias. BE-001 tem o Eric como responsável; TR-016 também deveria ter (falta atribuir, ver abaixo). Nenhuma tarefa foi criada como concluída; TR-013, TR-014, BE-013 e BE-002 estão em "update required" (Em revisão).

**Dependências já registradas (10):** BE-013 aguarda BE-001; BE-014 aguarda TR-014; FE-002 aguarda TR-009; FE-003 aguarda FE-002; FE-004 aguarda TR-005 e FE-003; BE-004 aguarda BE-001; BE-005 a BE-012 (agregada, vale para BE-008) aguarda BE-001; TR-002 aguarda TR-001 e BE-001.

### O que FALTA criar (continuar na próxima chamada, após o limite diário do conector zerar; conferir antes pela busca por nome para não duplicar)
1. **Mães de módulo** (lista 01, status planning, tags `frontend`, `design`, `provisoria` + tag do módulo, data da seção 3, mesmo modelo de descrição das mães já criadas): FE-024, FE-025, FE-026, FE-027, FE-028, FE-029, FE-030, FE-031, FE-032, FE-033, FE-034, FE-035. Houve 12 tentativas de criação na hora do limite; todas falharam com erro de limite e **nenhuma foi criada**.
2. **58 subtarefas de tela** (parent = mãe; nome `[FE-0xx.n] Tela: Nome`; sem data; descrição com o checklist de 4 etapas, a rota, os documentos 06, 07 e 05 e o agente; tags `frontend`, `design`, tag do módulo), conforme seção 2. Incluem as das mães já criadas (FE-020 a FE-023).
3. **Dependências que faltam:** FE-001 aguarda FE-014; mães FE-020 a FE-035 aguardam FE-014 (opcional; já escrito na descrição); FE-022 aguarda TR-013 e TR-014 (opcional).
4. **Ajustes:** atribuir TR-016 ao Eric; avaliar abrir BE-005 a BE-012 como tarefas filhas da agregada (hoje é uma só, ver mapeamento); lista 04 Backlog de ideias (itens de D-13 e de `docs/ideias/`, sem prioridade); comentários de "criada em 01/10/2026" nas tarefas, se o Eric quiser.
5. Aviso: TR-007 e TR-011 do plano mestre não estavam no lote do doc. 06 e não foram criados; decidir com o Eric se entram.

## 5. Destravamento do ClickUp (RESOLVIDO em 01/10/2026, rodada 4)
O Eric reautorizou o conector; o espaço "Vigen" ficou visível no workspace 9013448793. R-19 encerrado em [04](04-riscos-e-decisoes.md). Novo risco R-21: limite diário de 100 chamadas do conector (a criação do lote precisa de pelo menos mais um dia).

## 6. Mapeamento ID do plano para tarefa do ClickUp
Atualizado em 01/10/2026 (rodada 4). Parcial; ver seção 4.7 para o que falta.

| ID | Tarefa no ClickUp | Lista | Status |
|---|---|---|---|
| D-04 | [D-04 Tokens novos do base.css](https://app.clickup.com/t/86akrnxnb) | Decisões | to do |
| D-05 | [D-05 Ícones Flaticon](https://app.clickup.com/t/86akrnxnm) | Decisões | to do |
| D-06 | [D-06 Documentos: envio](https://app.clickup.com/t/86akrnxnr) | Decisões | to do |
| D-07 | [D-07 Confirmar ao fechar janela](https://app.clickup.com/t/86akrnxpd) | Decisões | to do |
| D-08 | [D-08 E-mail real](https://app.clickup.com/t/86akrnxpw) | Decisões | to do |
| D-09 | [D-09 LGPD, backup e criptografia](https://app.clickup.com/t/86akrnxq4) | Decisões | to do |
| D-10 | [D-10 Extras opcionais](https://app.clickup.com/t/86akrnxqd) | Decisões | to do |
| D-13 | [D-13 Itens sem lastro e evoluções](https://app.clickup.com/t/86akrnxqm) | Decisões | to do |
| D-16 | [D-16 Novo desenho do sidebar](https://app.clickup.com/t/86akrnxgt) | Decisões | to do |
| TR-001 | [TR-001 Registrar falhas de 01/10](https://app.clickup.com/t/86akrnxvz) | 03 | in progress |
| TR-002 | [TR-002 Testes 1.1 a 1.11](https://app.clickup.com/t/86akrnxw2) | 03 | to do |
| TR-003 | [TR-003 Testes 2.1 a 2.5](https://app.clickup.com/t/86akrnxw7) | 03 | to do |
| TR-004 | [TR-004 Testes 3.1 a 3.12](https://app.clickup.com/t/86akrnxwj) | 03 | to do |
| TR-005 | [TR-005 Corrigir defeitos](https://app.clickup.com/t/86akrnxx2) | 03 | in progress |
| TR-013 | [TR-013 Sem evidência e aviso à qualidade](https://app.clickup.com/t/86akrnxx8) | 03 | update required (Em revisão) |
| TR-014 | [TR-014 Concluído fora do prazo](https://app.clickup.com/t/86akrnxxc) | 03 | update required (Em revisão) |
| TR-006 | [TR-006 Confirmação ao fechar janela](https://app.clickup.com/t/86akrnxzg) | 03 | planning |
| TR-008 | [TR-008 eslint](https://app.clickup.com/t/86akrnxzv) | 03 | to do |
| TR-009 | [TR-009 Tokens novos](https://app.clickup.com/t/86akrny06) | 03 | planning |
| TR-010 | [TR-010 Créditos dos ícones](https://app.clickup.com/t/86akrny0r) | 03 | planning |
| TR-016 | [TR-016 Trocar senha dos usuários de teste](https://app.clickup.com/t/86akrny10) | 03 | to do |
| BE-001 | [BE-001 Blob em produção (prioritário)](https://app.clickup.com/t/86akrny4g) | 02 | to do, Urgente, dono Eric |
| BE-013 | [BE-013 Download na janela de Documento](https://app.clickup.com/t/86akrny4r) | 02 | update required (Em revisão) |
| BE-014 | [BE-014 Indicador de atendimento ao prazo](https://app.clickup.com/t/86akrny55) | 02 | planning |
| BE-002 | [BE-002 Segurança operacional](https://app.clickup.com/t/86akrny5b) | 02 | update required (Em revisão) |
| BE-003 | [BE-003 Scripts de integração](https://app.clickup.com/t/86akrny5p) | 02 | planning |
| BE-004 | [BE-004 Documentos com envio real](https://app.clickup.com/t/86akrny5r) | 02 | planning |
| BE-005 a BE-012 | [BE-005 a BE-012 Backlog de produção (agregada)](https://app.clickup.com/t/86akrny61) | 02 | planning |
| FE-014 | [FE-014 Sidebar/navegação](https://app.clickup.com/t/86akrnyc4) | 01 | to do, Alta, 31/01/2027 provisória |
| FE-001 | [FE-001 Cabeçalho](https://app.clickup.com/t/86akrnyd4) | 01 | planning |
| FE-002 | [FE-002 Componentes compartilhados](https://app.clickup.com/t/86akrnydd) | 01 | planning |
| FE-003 | [FE-003 Padrões de aviso e estados](https://app.clickup.com/t/86akrnydj) | 01 | planning |
| FE-004 | [FE-004 Janela flutuante](https://app.clickup.com/t/86akrnydq) | 01 | planning |
| FE-005 | [FE-005 Textos e renomes](https://app.clickup.com/t/86akrnyef) | 01 | planning |
| FE-012 | [FE-012 Varredura final](https://app.clickup.com/t/86akrnyet) | 01 | planning |
| FE-013 | [FE-013 Busca global e trilho (opcional)](https://app.clickup.com/t/86akrnyey) | 01 | planning |
| FE-020 | [FE-020 Design: Base](https://app.clickup.com/t/86akrnyw6) | 01 | planning, 30/04/2027 provisória |
| FE-021 | [FE-021 Design: RNC](https://app.clickup.com/t/86akrnywd) | 01 | planning, 30/04/2027 provisória |
| FE-022 | [FE-022 Design: Plano de Ação](https://app.clickup.com/t/86akrnywm) | 01 | planning, 30/04/2027 provisória |
| FE-023 | [FE-023 Design: Mapa de Processos](https://app.clickup.com/t/86akrnyx0) | 01 | planning, 31/07/2027 provisória |
| FE-024 a FE-035 | **NÃO CRIADAS** (limite diário do conector) | 01 | ver seção 4.7 |
| Subtarefas de tela (58) | **NÃO CRIADAS** | 01 | ver seção 4.7 |
