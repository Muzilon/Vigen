# Vigen — Desenho técnico dos novos módulos (proposta, 2026-09-26)

Status: **aguardando validação**. Todos seguem os padrões do projeto (empresa_id + FKs compostas, soft delete, histórico append-only, permissões configuráveis, escopo por obra, Anexo/Interacao/Notificacao genéricos, motor de Plano de Ação).

## Base comum
- `ConfiguracaoEscala` por empresa e por tipo (RISCO_OPORTUNIDADE, HIRA, ASPECTO_IMPACTO): tamanho 3x3/5x5, rótulos e pesos dos eixos, faixas de nível (BAIXO/MÉDIO/ALTO/CRÍTICO com cor), critérios extras de significância.
- Cálculo sempre em função pura testável; nível gravado no registro para filtro/heatmap.
- Componente **heatmap** genérico reutilizado por Riscos, HIRA, LAIA (e partes interessadas).
- Reavaliação periódica: `proximaReavaliacaoEm` + alerta pelo cron existente.

## 1. Mapa de Processos (ISO 9001 4.4)
`Processo` (código, nome, tipo Gestão/Finalístico/Apoio, dono, objetivo, entradas, saídas, SIPOC, recursos, versão), `IndicadorProcesso`, `InteracaoProcesso` (setas entre processos), `VersaoProcesso` (snapshot append-only). Mapa visual em 3 raias gerado automaticamente. Permissão PROCESSO_GERENCIAR.

## 2. Matriz de Riscos e Oportunidades (ISO 9001 6.1)
`RiscoOportunidade` (processo, tipo, causa, consequência, P×I → nível/faixa, tratamento Aceitar/Mitigar/Transferir/Evitar/Explorar, residual, status, responsável, plano de ação, reavaliação) + `HistoricoRiscoOportunidade` (cada reavaliação). Mitigar/Evitar com nível Alto/Crítico exige plano de ação. Heatmap clicável. Permissões RISCO_GERENCIAR, RISCO_TRATAR.

## 3. Matriz SWOT (ISO 9001 4.1/4.2)
`CicloSwot` (por ano), `ItemSwot` (quadrante, relevância 1–5, vínculo a risco/oportunidade), `ParteInteressada` (necessidade, influência × interesse). Quadro 2×2; botão "gerar risco/oportunidade". Permissão SWOT_GERENCIAR.

## 4. Perigos e Riscos — HIRA (ISO 45001)
`PlanilhaHira` (obra, setor, processo, atividade rotineira/não, perigo, risco, condição Normal/Anormal/Emergência, controles e hierarquia de controle, P×S inicial e residual, requisito legal, plano de ação, reavaliação). Escopo por obra. Heatmap inicial × residual. Permissão HIRA_GERENCIAR.

## 5. Aspectos e Impactos — LAIA (ISO 14001)
`PlanilhaLaia` (obra, processo, atividade, aspecto, impacto, situação N/A/E, temporalidade, incidência direta/indireta, severidade, frequência, abrangência, requisito legal, partes interessadas → pontuação e significativo), controles, plano de ação. Filtro "somente significativos". Permissão LAIA_GERENCIAR.

## 6. Tramitação de Documentos (ISO 9001 7.5)
`Documento` (tipo, código automático por tipo, título, processo, periodicidade de revisão, status), `VersaoDocumento` (append-only: versão, motivo da alteração, elaborado/revisado/aprovado por, próxima revisão, obsoleto em; arquivo via Anexo), `DistribuicaoDocumento` (ciência/leitura confirmada por usuário). Ciclo Elaboração → Revisão → Aprovação → Publicado → Obsoleto; nova versão obsoleta a anterior. Lista mestra, "Minhas leituras pendentes", alerta de revisão vencida. Permissões DOCUMENTO_ELABORAR, DOCUMENTO_APROVAR, DOCUMENTO_GERENCIAR.

## Integrações
Plano de Ação ganha origens RISCO_OPORTUNIDADE, HIRA, LAIA; Anexo/Interações/Notificações ganham os novos tipos; Empresa.modulosAtivos liga/desliga cada módulo; indicadores de cada módulo no dashboard.

## Ordem sugerida
1. Base comum + Mapa de Processos · 2. Riscos e Oportunidades · 3. HIRA · 4. LAIA · 5. Documentos (pode ir em paralelo) · 6. SWOT.

## Pontos em aberto
1. Escala 3x3 ou 5x5 — uma por módulo (proposto) ou única por empresa?
2. Aprovação de documento: um aprovador ou vários (comitê)?
3. Distribuição de documento: todos os usuários ou escolher setor/obra/perfil na publicação?
4. Prazo de reavaliação: padrão da empresa (ex. 12 meses) calculado automaticamente, ou manual por item?
5. HIRA e LAIA precisam de aprovação registrada (rascunho → aprovado, com revisão) ou basta cadastro com histórico?
6. Mapa de processos: automático por tipo (proposto) ou editável arrastando?

---
## Decisões do dono (2026-09-26)
1. **Módulos contratados por empresa** (liga/desliga em `modulosAtivos`). Escala configurada por módulo e por empresa, com **sobrescrita opcional por local/obra**.
2. **Aprovação com vários aprovadores, estilo DocuSign**: lista de signatários em ordem (sequencial) ou simultânea, cada um assina/rejeita com comentário, trilha registrada.
3. **Publicação de documento**: quem publica escolhe o público (setor, obra, perfil, usuários) e se envia notificação.
4. **Reavaliação**: o usuário escolhe se reavalia item a item ou a planilha inteira (revisão geral).
5. **HIRA e LAIA com fluxo de aprovação** para inclusão, alteração e exclusão. Se a empresa tem o módulo de Documentos, a aprovação usa a tramitação; senão, o fluxo interno do próprio módulo (mesmo motor de aprovação).
6. **Mapa de processos em formato de planilha/grade**, montado automaticamente e editável (reordenar/mover).
7. Incluir também: Inspeções/Checklists, Auditorias, Requisitos Legais, Incidentes/Acidentes, Indicadores, Treinamentos.

## Pacotes de entrega
| Pacote | Conteúdo |
|---|---|
| P1 | Fundação: gating por módulo contratado, ConfiguracaoEscala (empresa + obra), heatmap, **motor de aprovação multi-assinante**, reavaliação; **Mapa de Processos** |
| P2 | **Riscos e Oportunidades** + **SWOT** + Partes interessadas |
| P3 | **HIRA** + **LAIA** com fluxo de aprovação |
| P4 | **Tramitação de Documentos** (assinaturas, versões, distribuição/ciência) + integração com aprovação de HIRA/LAIA |
| P5 | **Inspeções/Checklists** + **Auditorias internas** |
| P6 | **Requisitos Legais** + **Incidentes e Acidentes** |
| P7 | **Indicadores** + **Treinamentos e competências** |

## P1 — entregue (2026-09-26)

Escopo entregue neste sub-pacote (gating de módulos, escalas configuráveis, heatmap
genérico). **Não** entregue aqui: motor de aprovação multi-assinante e Mapa de Processos
(ficam para uma próxima etapa do P1).

- **`Modulo` (schema.prisma)**: estendido com `MAPA_PROCESSOS`, `RISCOS_OPORTUNIDADES`,
  `SWOT`, `HIRA`, `LAIA`, `REQUISITOS_LEGAIS`, `INCIDENTES`, `INDICADORES`, `TREINAMENTOS`.
  **Decisão**: `INSPECAO`/`AUDITORIA` foram **renomeados** (não reaproveitados) para
  `INSPECOES`/`AUDITORIAS` — eram placeholders sem nenhum modelo usando o valor (só
  apareciam no enum e no default de `Empresa.modulosAtivos`, que não os incluía), então
  o rename manteve o plural consistente com os módulos novos sem custo de migração de dados.
- **Gating**: `src/lib/modulos.ts` (`temModulo`, `exigirModulo`, `ROTULO_MODULO`,
  `GRUPO_POR_MODULO`). `Contexto.modulosAtivos` (src/lib/tenant.ts) carregado a partir de
  `Empresa.modulosAtivos` em `carregarDadosSessao` (src/lib/usuario-sessao.ts) — mesmo
  padrão de "lido do banco a cada requisição" já usado para permissões.
- **Menu**: `src/lib/menu-registro.ts` é o registro de itens por módulo (`href`, `label`,
  `grupo`, `implementado`, `permissao?`). Um item só aparece quando `implementado: true` **e**
  o módulo está ativo **e** a permissão (se houver) está presente. Hoje todos os itens do
  registro têm `implementado: false` (nenhuma página dos módulos novos existe ainda) — a
  lista fica vazia de propósito até os pacotes P2+ entregarem as páginas. RNC, Plano de
  Ação e Configurações continuam fixos em `src/app/(app)/layout.tsx` (base do sistema, fora
  do gating por módulo contratado).
- **Aba "Módulos"** em Configurações (`ADMIN_CONFIG`): liga/desliga módulos por empresa
  (`salvarModulosAtivos` em `src/lib/admin/servico.ts`); RNC/PLANO_ACAO sempre ativos.
- **Seed**: Monto com todos os módulos ativos (para testar o gating fim a fim); Demo
  mantém só RNC + PLANO_ACAO (default do schema) — reforça o teste de isolamento
  multi-tenant já existente (`scripts/teste-isolamento.ts`).
- **`ConfiguracaoEscala`** (novo modelo, migração
  `20260926120000_modulos_escala_heatmap`): por `empresaId` + `tipo` (`TipoEscala`:
  `RISCO_OPORTUNIDADE`, `HIRA`, `ASPECTO_IMPACTO`) + `obraId` opcional. Resolução em
  código, não em SQL: obra (override) → empresa (`obraId` nulo) → padrão do sistema
  embutido em `src/lib/escala/padrao.ts`. Um índice único parcial
  (`WHERE obra_id IS NULL`) garante no máximo uma configuração "padrão da empresa" por
  tipo — a unicidade comum `[empresaId, tipo, obraId]` não bastava porque o Postgres trata
  `NULL` como distinto em `UNIQUE`.
- **Funções puras** em `src/lib/escala/` (sem banco, testadas em `*.test.ts` com vitest):
  `calcularScore`/`faixaParaScore`/`calcularNivel` (P×S e faixa), `resolverConfiguracaoEscala`
  (obra → empresa → padrão), `nivelComCriteriosExtras`/`ehSignificativo` (significância do
  LAIA: nível final ALTO ou CRITICO após aplicar critérios extras que podem elevar o nível,
  nunca rebaixar).
- **Aba "Escalas"** em Configurações: cria/edita configurações (tipo, obra opcional,
  tamanho 3/5, eixos/faixas/critérios extras como JSON) e lista as cadastradas com opção de
  excluir (volta a usar o padrão do sistema). Editor de JSON cru é uma solução mínima para
  este pacote — um editor guiado (campo por eixo/faixa) fica para quando um módulo
  consumidor (Riscos, HIRA ou LAIA) precisar de UX mais refinada.
- **Heatmap genérico**: `src/paginas/html/componentes/heatmap.tsx` +
  `src/paginas/css/componentes/heatmap.module.css` — ver docs/05-guia-paginas-css.md,
  seção 6, para a documentação de uso.

## P1 — Mapa de Processos entregue (2026-09-26)

Com o motor de aprovação (commit anterior) e este módulo, o **P1 está completo**.

- **Schema** (migração `20260926160000_mapa_processos`): `Processo` (código único por
  empresa, nome, `TipoProcesso` GESTAO/FINALISTICO/APOIO, `ordem` dentro da raia, objetivo,
  dono, entradas, saídas, fornecedores, clientes, recursos, `versao` = última publicada,
  `revisao` = trava otimista, `ativo` = exclusão lógica), `IndicadorProcesso`,
  `InteracaoProcesso` (única por par origem→destino, `CHECK origem <> destino`),
  `VersaoProcesso` (snapshot JSON **append-only**: trigger bloqueia UPDATE/DELETE). Todas as
  FKs compostas `(empresa_id, id)`. Permissão `PROCESSO_GERENCIAR` (perfil Qualidade do seed;
  ADMIN tem todas). `TipoEntidadeAnexo`, `TipoEntidadeInteracao` e `TipoEntidadeNotificacao`
  ganharam `PROCESSO` (anexos, comentários e notificação de mensagem no detalhe).
- **Serviço** `src/lib/processos/`: `regras.ts` (puro: normalização, diff de indicadores,
  reordenação, snapshot, layout do SVG) e `servico.ts` (CRUD, ↑↓ na raia, mover de tipo,
  inativar/reativar, indicadores, interações, publicar). Leitura exige o módulo contratado;
  escrita exige módulo + `PROCESSO_GERENCIAR` (o `Ator` não carrega módulos, então o serviço
  lê `Empresa.modulosAtivos` — vale para scripts/testes também).
- **Publicação**: direta (`publicarVersao`: snapshot + `versao++` na mesma transação) **ou**
  via motor de aprovação (`solicitarPublicacao` → fluxo `PROCESSO`/`PUBLICACAO`; o handler em
  `src/lib/processos/aprovacao.ts` publica em nome do solicitante na transação da última
  assinatura). **Decisão**: a escolha é por publicação (os dois botões no detalhe); não há
  ainda uma configuração da empresa que obrigue o fluxo. O handler é registrado por import
  com efeito colateral — todo ponto de entrada que chama `decidir()` precisa de
  `import "@/lib/processos/aprovacao"` (as actions de `/processos` e o teste já importam; as
  actions de `/aprovacoes` devem importar também).
- **Telas** (padrão `paginas/`): `/processos` com aba **Planilha** (grade por raia, edição
  inline por linha com Salvar/Cancelar, "+ Adicionar linha", ↑↓, tipo = mover de raia,
  indicadores um por linha — meta/unidade/periodicidade no detalhe; "Mostrar inativos") e aba
  **Mapa** (SVG em 3 raias gerado da ordem; Cliente → finalísticos → Cliente; interações como
  curvas tracejadas; caixas clicáveis). `/processos/[id]`: dados/SIPOC (editar), indicadores,
  interações (adicionar/remover), versões publicadas (conteúdo congelado), anexos, comentários
  e placeholders "Riscos / HIRA / LAIA / Documentos vinculados (em breve)".
- **Menu**: `MAPA_PROCESSOS` implementado (`/processos`, grupo Qualidade). **Seed**: 8
  processos da Monto (2 gestão, 4 finalísticos, 2 apoio) com indicadores e 9 interações.
- **Testes**: `tests/processos.test.ts` (regras) e `npm run test:processos` (CRUD, código
  único, reordenação, interações, permissão, gating Demo, isolamento, versão/snapshot
  imutável, publicação via aprovação, inativar).

## P2 — Riscos e Oportunidades + SWOT entregue (2026-09-26)

- **Correção (item 0)**: handlers de aprovação só se registravam quando o arquivo do módulo era
  importado — aprovar pela tela `/aprovacoes` concluía o fluxo **sem aplicar** a alteração se o
  processo do servidor nunca tivesse carregado o módulo. Agora `src/lib/aprovacao/handlers.ts`
  importa todos os handlers (PROCESSO, RISCO_OPORTUNIDADE) e é importado pelas actions de
  `/aprovacoes` (único ponto que chama `decidir()`), de `/processos` e de `/riscos`. **Regra**:
  módulo novo com handler → acrescente o import em `handlers.ts` e em `TIPOS_COM_HANDLER`.
  Testado em `test:riscos` (processo filho que carrega só as actions de `/aprovacoes` e aprova).
- **Schema** (migração `20260926180000_riscos_swot`): `RiscoOportunidade` (número sequencial por
  empresa → código `R-001`/`O-001`; processo e obra opcionais; P, I, score e faixa gravados;
  tratamento, residual P/I/score/faixa, status, responsável, `planoAcaoId` único, modo de
  reavaliação ITEM/GERAL, periodicidade em meses, `proximaReavaliacaoEm`, `versao` = trava
  otimista, `ativo` = exclusão lógica), `HistoricoRiscoOportunidade` (**append-only**, trigger),
  `CicloSwot` (ano único por empresa, encerrado), `ItemSwot` (quadrante, relevância 1–5,
  vínculo opcional ao risco), `ParteInteressada` (influência/interesse 1–5). CHECKs de faixa de
  valores. Permissões `RISCO_GERENCIAR`, `RISCO_TRATAR`, `SWOT_GERENCIAR` (perfil Qualidade tem as
  três; Segurança tem `RISCO_TRATAR`). `OrigemPlanoAcao` += `RISCO_OPORTUNIDADE`; Anexo, Interação e
  Notificação ganharam `RISCO_OPORTUNIDADE`.
- **Cálculo**: `src/lib/riscos/regras.ts` (puro) — P×I pela `ConfiguracaoEscala`
  RISCO_OPORTUNIDADE resolvida obra → empresa → padrão; eixo 1 = probabilidade, eixo 2 =
  impacto (pela posição, não pela chave). **Regra**: MITIGAR/EVITAR com faixa ALTO/CRÍTICO exige
  plano de ação — ao definir o tratamento (ou cadastrar já com ele) sem plano, é preciso informar
  a primeira ação (o plano é criado com origem RISCO_OPORTUNIDADE e vinculado na mesma
  transação) ou gerar o plano antes; edição/reavaliação que eleve a faixa também respeita a regra.
  Tratamento coerente com o tipo (EXPLORAR só oportunidade; MITIGAR/EVITAR/TRANSFERIR só risco).
- **Acesso** (`src/lib/riscos/servico.ts`): leitura com o módulo contratado e escopo de obras
  (registro sem obra = empresa toda). Cadastro/edição/exclusão/revisão geral: `RISCO_GERENCIAR`.
  Tratamento, plano, status e reavaliação do item: `RISCO_TRATAR`, `RISCO_GERENCIAR` **ou o
  responsável** do registro. Toda mudança grava histórico.
- **Reavaliação**: "Reavaliar" (item: nova avaliação, histórico REAVALIACAO, próxima data =
  hoje + periodicidade) e "Revisão geral" (`/riscos/revisao-geral`, escopo processo / sem
  processo / empresa: todos os registros abertos do escopo numa transação, histórico
  REVISAO_GERAL em cada um). Fonte de alerta registrada em `src/lib/riscos/reavaliacao.ts`
  (importada pelo cron): modo ITEM = um alerta por registro; GERAL = um por processo, com a data
  mais próxima.
- **Aprovação (opcional)**: "Solicitar alteração via aprovação" no detalhe → fluxo
  `RISCO_OPORTUNIDADE`/`ALTERACAO` com payload `{ antes, depois, dados, versao }`; o handler
  (`src/lib/riscos/aprovacao.ts`) aplica em nome do solicitante na transação da última
  assinatura, conferindo a versão lida (se o registro mudou no meio tempo, a aprovação falha com
  conflito). EXCLUSAO também é tratada pelo handler (sem botão na tela por ora). **Decisão**:
  edição direta continua disponível para `RISCO_GERENCIAR`; a empresa escolhe caso a caso.
- **Telas**: `/riscos` (filtros processo/tipo/nível/status/obra/encerrados, heatmaps P×I inicial
  e residual clicáveis — `?p=&i=&res=1` filtra a lista —, lista com badge da faixa),
  `/riscos/novo` (nível calculado ao vivo pela escala da obra escolhida; tratamento inicial e
  primeira ação quando exigida), `/riscos/[id]` (dados, avaliação inicial/residual, reavaliar,
  tratamento/residual, status, plano vinculado ou gerar plano 5W2H, histórico, aprovações,
  anexos, comentários), `/riscos/revisao-geral`. Detalhe do processo: o placeholder foi trocado
  pela lista de riscos vinculados (+ "Novo" com o processo pré-selecionado). Plano de ação mostra
  a origem "Risco/oportunidade". Dashboard: painel "Riscos e oportunidades abertos por nível"
  (só com o módulo). `BadgeFaixa` em `componentes/badge.tsx`.
- **SWOT** (`src/lib/swot/`): `/swot` (ciclos; novo ciclo com opção de copiar itens e partes do
  ciclo anterior mais recente, sem os vínculos com riscos) e `/swot/[id]` (quadro 2×2 com itens
  por relevância, adicionar/editar/remover, "Gerar risco/oportunidade" — fraqueza/ameaça → RISCO,
  força/oportunidade → OPORTUNIDADE, descrição pré-preenchida, vínculo gravado; só aparece com o
  módulo RISCOS_OPORTUNIDADES e `RISCO_GERENCIAR` —; aba Partes interessadas com heatmap
  influência × interesse e estratégia sugerida). Ciclo encerrado é somente leitura.
- **Menu**: RISCOS_OPORTUNIDADES e SWOT implementados. **Seed**: 10 riscos/oportunidades da
  Monto ligados aos processos (3 com plano de ação gerado), ciclo SWOT 2026 com 11 itens (6
  vinculados a riscos) e 6 partes interessadas.
- **Testes**: `tests/riscos.test.ts`, `tests/swot.test.ts` (vitest) e `npm run test:riscos` /
  `npm run test:swot`.

## P3 — HIRA entregue (2026-09-26)

- **Schema** (migração `20260926200000_hira`): `LinhaHira` (número sequencial por empresa → `H-001`;
  **obra obrigatória** = escopo; setor texto, processo opcional, atividade, rotineira, perigo, risco/dano,
  `CondicaoOperacional` NORMAL/ANORMAL/EMERGENCIA, controles existentes, `HierarquiaControle`
  (eliminação → EPI) + controles propostos, P×S inicial e residual com score/faixa gravados, requisito
  legal (texto), responsável, `planoAcaoId` único, reavaliação ITEM/GERAL, `StatusLinhaSgi`
  PENDENTE_APROVACAO/VIGENTE/REJEITADA/INATIVA, `versao` = trava otimista) e `HistoricoLinhaHira`
  (**append-only** por trigger; snapshot JSON + ação `AcaoHistoricoSgi`). CHECKs de P/S, residual completo,
  periodicidade e textos. Permissões `HIRA_GERENCIAR` e `LAIA_GERENCIAR` (perfis Segurança/Meio Ambiente do
  seed; usuários `seguranca@` e `meioambiente@monto.com.br`). `OrigemPlanoAcao`, Anexo, Interação e
  Notificação += `HIRA`.
- **Escopo por obra**: `filtroObras` foi movido para `src/lib/escopo-obras.ts` (puro; `tenant.ts` reexporta)
  e é usado em toda leitura/escrita do HIRA; incluir/alterar para obra fora do escopo é negado.
- **Cálculo**: `src/lib/hira/regras.ts` — eixo 1 = probabilidade, eixo 2 = severidade da
  `ConfiguracaoEscala` HIRA resolvida obra → empresa → padrão. Sempre recalculado no servidor (também ao
  aplicar uma aprovação).
- **Fluxo de aprovação (decisão 5)**: `Empresa.config.aprovacao.hira = { exigir, aprovadorIds, modo }`
  (`src/lib/aprovacao/config-modulo.ts`, aba **Configurações → Aprovações**). Com `exigir`: INCLUSÃO cria a
  linha PENDENTE_APROVACAO e o fluxo na mesma transação (`criarFluxoNaTransacao`, novo no motor); ALTERAÇÃO
  guarda `{ antes, depois, dados, versao, motivo }` (só os campos que mudam em antes/depois) e a linha
  vigente não muda até a última assinatura; EXCLUSÃO = inativação. O handler (`src/lib/hira/aprovacao.ts`,
  registrado em `handlers.ts`) aplica em nome do solicitante conferindo a versão (conflito se a linha mudou).
  Rejeição **ou cancelamento** (novo hook `aoCancelar` no registry) de inclusão → REJEITADA; de
  alteração/exclusão → só histórico REJEICAO. Aprovadores efetivos = padrões menos o solicitante. Sem
  `exigir`, aplica direto com histórico. Reavaliação/revisão geral/plano não passam por aprovação.
  **Ponto de extensão P4**: `canalAprovacao(modulosAtivos)` (hoje sempre "MOTOR") — com DOCUMENTOS ativo,
  passará a encaminhar para a Tramitação de Documentos com o mesmo payload.
- **Reavaliação**: item (histórico REAVALIACAO) e **revisão geral por obra** (`/hira/revisao-geral?obra=`);
  fonte de alerta `src/lib/hira/reavaliacao.ts` (ITEM por linha, GERAL por obra).
- **Telas**: `/hira` — planilha densa (quadro com rolagem própria, cabeçalho e coluna Nº fixos), filtros
  obra/setor/processo/nível/status, heatmaps P×S inicial e residual clicáveis, badge "N pendentes de
  aprovação" e marca "Alteração/Exclusão pendente" por linha; `/hira/novo` (nível inicial e residual ao
  vivo, aviso de aprovação); `/hira/[id]` (dados, alterar/solicitar alteração, excluir, reavaliar, plano 5W2H,
  histórico com snapshot, aprovações, anexos, comentários); `/hira/revisao-geral`. Processo: cartão com as
  linhas HIRA vinculadas. Dashboard: painel HIRA por nível. Menu: HIRA implementado (grupo Segurança).
- **Seed**: 12 linhas HIRA da Monto (Obra Alfa/Beta, processo PF-03), 1 com plano, 1 inclusão pendente;
  aprovação exigida com aprovador = admin.
- **Testes**: `tests/hira.test.ts` e `npm run test:hira` (16 casos).

## P3 — LAIA entregue (2026-09-26) — P3 completo

- **Schema** (migração `20260926220000_laia`): `LinhaLaia` (`A-001`; obra obrigatória, processo opcional,
  atividade, aspecto, impacto, situação N/A/E (`CondicaoOperacional`), `Temporalidade` passada/atual/futura,
  `Incidencia` direta/indireta, severidade, frequência, abrangência, requisito legal e partes interessadas
  (bool), score/faixa/`significativo` gravados, controles, responsável, plano, reavaliação, status/versão como
  no HIRA) e `HistoricoLinhaLaia` (append-only por trigger). `OrigemPlanoAcao`, Anexo, Interação e Notificação
  += `LAIA`.
- **Pontuação** (`src/lib/laia/regras.ts`): produto dos eixos da `ConfiguracaoEscala` ASPECTO_IMPACTO
  localizados **pela chave** (`severidade`, `frequencia`, `abrangencia`; eixo ausente na configuração fica fora
  do score, eixo com outra chave é erro). Critérios extras `requisitoLegal`/`partesInteressadas` elevam a faixa
  (`nivelComCriteriosExtras`); **significativo = ALTO/CRÍTICO** (`ehSignificativo`). **Decisão**: o padrão do
  sistema ASPECTO_IMPACTO passou a ter 3 eixos 1–3 (score 1–27; faixas ≤4 baixo, ≤12 médio, ≤18 alto,
  ≤27 crítico) — antes eram 2 eixos 3×3 sem abrangência.
- **Aprovação**: igual ao HIRA, com `Empresa.config.aprovacao.laia` (mesma aba de Configurações). Handler
  `src/lib/laia/aprovacao.ts` registrado em `handlers.ts`.
- **Telas**: `/laia` (planilha densa, filtros obra/processo/nível/status/**somente significativos**, heatmap
  severidade × frequência clicável + contador de significativos), `/laia/novo` (pontuação e significância ao
  vivo), `/laia/[id]`, `/laia/revisao-geral`. Processo: cartão LAIA. Dashboard: painel LAIA por nível com
  total de significativos. Menu: "Aspectos ambientais" (grupo Meio Ambiente).
- **Seed**: 10 linhas LAIA da Monto (Obra Alfa/Beta), 5 significativas, 1 com plano; aprovação exigida.
- **Testes**: `tests/laia.test.ts` e `npm run test:laia` (16 casos).

## P4 — Tramitação de Documentos entregue (2026-09-26)

- **Schema** (migração `20260927000000_documentos`): `TipoDocumentoEmpresa` (sigla única, periodicidade padrão),
  `Documento` (código `SIGLA-NNN` via `ContadorSequencial` DOCUMENTO com novo campo **`subtipo`** = id do tipo — a PK
  do contador virou `(empresa, tipo, ano, subtipo)`; status ELABORACAO/EM_REVISAO/EM_APROVACAO/APROVADO/PUBLICADO/
  OBSOLETO/CANCELADO, `versaoVigenteId`, `proximaRevisaoEm`, `versao` = trava otimista, `chavePlanilha`),
  `VersaoDocumento` (Rev. 00, 01…; motivo; arquivo = Anexo `DOCUMENTO_VERSAO`; fluxo; **imutável após publicada** por
  trigger — só PUBLICADA → OBSOLETA), `PublicacaoDocumento` (público todos ou listas setores/obras/perfis/usuários —
  união —, notificar, exigir ciência), `CienciaDocumento` e `HistoricoDocumento` (append-only por trigger).
  Permissões `DOCUMENTO_ELABORAR`/`DOCUMENTO_GERENCIAR` (perfil Qualidade; Segurança elabora). Notificações
  `DOCUMENTO_PUBLICADO`, `CIENCIA_PENDENTE`, `REVISAO_DOCUMENTO_PROXIMA`; Interação/Notificação `DOCUMENTO`.
- **Fluxo** (`src/lib/documentos/`): elaborar (arquivo validado por magic bytes + motivo) → enviar: **um fluxo** do
  motor com revisores (primeiro) e aprovadores, sequencial/paralelo → EM_REVISAO; novo hook `aoAvancar` no registry
  passa a EM_APROVACAO quando todos os revisores assinam → última assinatura: APROVADO → publicar (GERENCIAR, público,
  notifica, exige ciência) — a vigente anterior vira OBSOLETA na mesma transação. Rejeição/cancelamento devolvem a
  revisão a rascunho. Nova revisão parte da vigente (que continua valendo). Cancelar (sem vigente → CANCELADO; com
  vigente cancela só a revisão) e tornar obsoleto. Regras puras em `regras.ts` (máquina de status, público, ciências).
- **Acesso**: lista mestra para ELABORAR/GERENCIAR; demais veem só o que foi publicado para eles (visão reduzida:
  vigente + ciência), além de responsável e signatários. Download pela rota autenticada `/api/anexos/[id]`
  (público só baixa a vigente); arquivo de revisão nunca é excluído pela tela de anexos. **Decisão**: sem filtro por
  obra na lista mestra (controle documental é corporativo); a obra entra no público da publicação.
- **Integração HIRA/LAIA (decisão 5)**: opção "Usar tramitação de documentos" em Configurações → Aprovações
  (`Empresa.config.aprovacao.<m>.usarTramitacao`); `canalAprovacao(modulos, config)` = TRAMITACAO com DOCUMENTOS ativo.
  As assinaturas continuam no motor; ao aprovar, o handler registra nova revisão do **documento-planilha da obra**
  (`chavePlanilha` `HIRA:<obra>`, tipo PL criado sob demanda) já publicada, com `conteudo` = snapshot JSON das linhas
  vigentes (download em `/documentos/[id]/versoes/[versaoId]/conteudo`). **Não feito**: roteamento das próprias
  solicitações pela tela de documentos e exibição do código/revisão da planilha nas telas do HIRA/LAIA.
- **Revisão periódica**: fonte `src/lib/documentos/reavaliacao.ts` (cron) com `tipoNotificacao` novo em `FonteReavaliacao`.
- **Telas**: `/documentos` (lista mestra, filtros, alerta de vencidas), `/documentos/novo`, `/documentos/[id]`,
  `/documentos/meus` ("Li e estou ciente"), Configurações → Tipos de documento, cartão no processo e no dashboard; menu
  (grupo Qualidade).
- **Seed**: tipos PR/IT/FO/POL/MAN, 8 documentos (publicados, em revisão, em aprovação, aprovado, rascunho, obsoleto)
  com PDFs reais; POL-001 exige ciência com ciências parciais. **Testes**: `tests/documentos.test.ts` e
  `npm run test:documentos` (16 casos).

## Evolução Arquitetural de UX/UI e Integrações (Sessão de Produto)

### 1. Integração Processos ↔ Procedimentos (O "Método")
- **Banco de Dados (Prisma):** Adição de uma tabela pivô `ProcessoDocumento` para vincular múltiplos documentos (Procedimentos/POPs) a um Processo. Inclui flag `isMetodoPrincipal` (Boolean) para destacar o "Como fazer" (Método do SIPOC). Adição do campo `macroprocesso` para agrupamento lógico.
- **Interface/UX (React Flow):** O mapa de processos passará a agrupar caixas por `macroprocesso` (ex: "Gestão Contratual") dentro das 3 grandes raias. 
- **Side-sheet (Visão Dividida):** Clicar em um processo no mapa abre um painel lateral (*split-view*). Os documentos vinculados ganham badges de status vivos (ex: 🔴 Obsoleto) e podem ser lidos inline (PDF) sem sair da tela do mapa.

### 2. RNC e Plano de Ação (Adoção Operacional)
- **Mobile-First (RNC Quick Report):** Para inspetores em campo via navegador, o foco é um formulário de 10 segundos: Foto (com metadados de GPS/Timestamp) + Áudio/Texto curto + Classificação rápida.
- **Tratativa Expressa:** Criação da flag `isCorrecaoImediata` (Boolean) na RNC. Permite pular a análise de causa raiz (Ishikawa) para falhas simples que exigem apenas correção pontual.
- **Estruturação da Causa Raiz:** O diagrama de Ishikawa (6M) passará a ser fortemente tipado no banco (Máquina, Método, Mão de Obra, Materiais, Meio Ambiente, Medição) para extração de métricas de gargalo.
- **Plano de Ação 5W2H (Kanban):** A tela do Gestor SGI ganha uma visão Kanban drag-and-drop (Pendente, Em Andamento, Concluído), substituindo as atuais tabelas textuais.
- **Evidência Robusta:** No `ItemAcao`, a conclusão de um item exigirá o vínculo obrigatório com `AnexoId`. Mover um card para "Concluído" dispara o modal para anexar a foto ou comprovante da ação.

## P5 — Inspeções entregue (2026-09-26)

- **Schema** (migração `20260927100000_inspecoes_auditorias`, compartilhada com Auditorias): `ModeloChecklist` (nome único,
  `TipoChecklist`, `notaMinima`, ativo, versão), `ItemModeloChecklist` (ordem, pergunta, `TipoRespostaChecklist`
  C/NC/NA · SIM/NÃO · NOTA 1–5 · TEXTO, `obrigatorioFoto`, ajuda; remoção = inativação), `Inspecao` (código
  `INSP-NNN-AA` via `proximaSequencia` com novo `TipoSequencia.INSPECAO`, obra obrigatória = escopo, setor/processo
  opcionais, inspetor, data, status EM_ANDAMENTO/CONCLUIDA/CANCELADA, `percentualConformidade` gravado ao concluir,
  `planoAcaoId`), `RespostaInspecao` (criada vazia ao iniciar com **snapshot** da pergunta — editar o modelo não altera
  inspeções já iniciadas; `geradaRncId`/`geradoItemAcaoId` únicos). Permissões `INSPECAO_GERENCIAR` (modelos, qualquer
  inspeção) e `INSPECAO_REALIZAR` (papel INSPETOR passou a ter por padrão). Anexo `RESPOSTA_INSPECAO`; Interação/Notificação
  `INSPECAO`.
- **Regras** (`src/lib/inspecoes/regras.ts`, puro): SIM = conforme / NÃO = não conforme (pergunta no positivo); nota abaixo
  de `notaMinima` = NC; TEXTO é informativo. % conformidade = C/(C+NC), N/A e texto fora. Concluir exige todas respondidas
  (texto opcional) e foto em cada **NC** de item com `obrigatorioFoto` (decisão: foto obrigatória só como evidência da NC).
- **Valor central**: resposta NC → "Abrir RNC" (`abrirRncDaResposta`: `criarRncNaTransacao` — extraído de `criarRnc` —
  com origem INSPECAO, obra/setor/processo da inspeção, título/descrição da pergunta + comentário, e as fotos copiadas como
  anexos RNC apontando o mesmo arquivo; vínculo gravado na mesma transação) ou "Criar apenas item de ação" (um plano
  origem INSPECAO por inspeção, criado no 1º item via `criarPlanoNaTransacao`; seguintes via novo
  `adicionarItemNaTransacao`). Resposta que gerou RNC/item não pode deixar de ser NC. Pode gerar após concluída.
- **Acesso**: leitura = módulo + obra no escopo; executar/cancelar = inspetor (com REALIZAR) ou GERENCIAR. Fotos imutáveis
  após conclusão.
- **Telas**: `/inspecoes` (cartões, filtros obra/modelo/status/data, indicadores), `/inspecoes/nova`,
  `/inspecoes/[id]` (**decisão**: lista com resposta inline, um cartão por pergunta com segmentado de toque ≥44px, comentário
  e fotos, salvar por pergunta — mais rápido no celular que "uma por vez"; resumo final com % e RNCs/itens gerados),
  `/inspecoes/modelos` e `/inspecoes/modelos/[id]` (perguntas ↑↓, editar, remover). Menu (Qualidade), card no dashboard
  (conformidade média 12 meses, em andamento/abertas há >7 dias, RNCs/itens gerados, média por modelo). Periodicidade de
  inspeções não implementada (opcional).
- **Seed**: 3 modelos (Segurança de Obra 8 itens, 5S 7, Ambiental 6) e 5 inspeções via serviço (2 geram RNC real com foto,
  1 gera item de ação, 1 em andamento pelo inspetor de campo).
- **Testes**: `tests/inspecoes.test.ts` e `npm run test:inspecoes` (6 casos).

## P5 — Auditorias entregue (2026-09-26) — P5 completo

- **Schema**: `ProgramaAuditoria` (ano único, objetivo), `Auditoria` (`AUD-NNN-AA`, `TipoSequencia.AUDITORIA`; programa,
  tipo INTERNA/EXTERNA_CERTIFICACAO, norma, escopo, processo e obra opcionais — sem obra = empresa toda —, auditor líder,
  equipe, período, status PLANEJADA/EM_EXECUCAO/CONCLUIDA/CANCELADA, conclusão, versão), `ItemAuditoria` (requisito,
  pergunta, ordem), `Constatacao` (item opcional, tipo NC/OBS/OM/PF, descrição, evidência, `geradaRncId` — CHECK só NC).
  Permissões `AUDITORIA_GERENCIAR` (planejar/editar/cancelar/programa) e `AUDITORIA_REALIZAR` (auditor líder executa).
  Anexo `CONSTATACAO_AUDITORIA`, Interação/Notificação `AUDITORIA`, notificação `AUDITORIA_ATRIBUIDA` ao auditor líder.
- **Regras**: máquina de status em `src/lib/auditorias/regras.ts`; plano editável planejada/execução; constatações só em
  execução; RNC em execução ou concluída; cancelar bloqueado se já gerou RNC. RNC da NC: origem AUDITORIA_INTERNA ou
  AUDITORIA_EXTERNA (enum existente), tipo sugerido pela norma (45001→SSO, 14001→MA), descrição com requisito + evidência,
  anexos da constatação viram evidências; auditoria sem obra exige escolher a obra.
- **Telas**: `/auditorias` (filtros status/tipo/ano/obra, NC·Obs·OM·PF e RNCs), `/auditorias/nova` (itens iniciais "requisito |
  pergunta" por linha), `/auditorias/[id]` (plano ↑↓, constatações com evidências, abrir RNC, concluir/cancelar,
  comentários), `/auditorias/programa`. Menu e card no dashboard (NC por auditoria).
- **Seed**: programa 2026, AUD-001 interna concluída (5 itens, 4 constatações, NC → RNC real com evidência) e AUD-002
  externa planejada.
- **Testes**: `tests/auditorias.test.ts` e `npm run test:auditorias` (7 casos).

## P6 — Requisitos Legais entregue (2026-09-26) — ⚠ DESCONTINUADO em 2026-09-30

> **Módulo removido do produto** por decisão do Eric (complexidade). Esta seção fica só como histórico. Código, telas, seed, testes e
> integrações foram apagados; a migração `20260930100000_remove_requisitos_legais` apaga as tabelas. Os valores de enum `REQUISITOS_LEGAIS` /
> `REQUISITO_LEGAL*` permanecem no banco (legado). Não reimplementar sem ordem.

- **Schema** (migração `20260927200000_requisitos_legais`): `RequisitoLegal` (código `LEG-NNN-AA` via `proximaSequencia` com novo
  `TipoSequencia.REQUISITO_LEGAL`; `TipoRequisitoLegal` LEI/NORMA/PORTARIA/RESOLUCAO/OUTRO, número, título, `EsferaRequisito`,
  `TemaRequisito` QUALIDADE/SSO/MEIO_AMBIENTE, órgão emissor, resumo, aplicabilidade, data de publicação, processo e obra opcionais
  — sem obra = empresa toda —, `StatusRequisitoLegal` ATENDE/ATENDE_PARCIAL/NAO_ATENDE/NAO_APLICAVEL/EM_ANALISE, responsável,
  periodicidade em meses, última/próxima verificação, `planoAcaoId` único, `versao` = trava otimista, `ativo` = exclusão lógica) e
  `HistoricoRequisitoLegal` (**append-only** por trigger: ação, status anterior → novo, data da verificação, observação). CHECKs de
  sequência, textos e periodicidade 1–60. Permissão `REQUISITO_LEGAL_GERENCIAR` (perfis Qualidade, Segurança e Meio Ambiente do seed).
  `OrigemPlanoAcao`, Anexo (evidência de atendimento), Interação e Notificação += `REQUISITO_LEGAL`. `proximaSequencia` passou a
  aceitar qualquer `TipoSequencia` e `criarPlanoNaTransacao` qualquer origem ≠ RNC (tipos derivados do Prisma).
- **Regras** (`src/lib/requisitos-legais/regras.ts`, puro): **NAO_ATENDE/ATENDE_PARCIAL exigem plano de ação** (no cadastro ou na
  verificação sem plano, informa-se a primeira ação e o plano origem REQUISITO_LEGAL é criado na mesma transação — mesmo padrão do
  tratamento de riscos); verificação vencida = próxima < hoje (não aplicável nunca vence); **% de atendimento = atende ÷ (atende +
  parcial + não atende)** — não aplicável e em análise ficam fora.
- **Acesso** (`acesso.ts`): leitura = módulo + escopo (sem obra = todos). Cadastro/edição/exclusão/revisão geral =
  `REQUISITO_LEGAL_GERENCIAR`; registrar verificação, gerar plano e anexar evidência = GERENCIAR **ou o responsável**.
- **Verificação** (`registrarVerificacao`): status + data (não futura) + observação; grava histórico VERIFICACAO (evidência de
  atendimento ao longo do tempo) e recalcula a próxima pela periodicidade (`calcularProximaReavaliacao`). **Decisão**: o status só
  muda por verificação (a edição dos dados não altera status), para que toda mudança de atendimento fique no histórico.
  **Revisão geral** (`/requisitos-legais/revisao-geral`, filtro por tema): marca um lote (checkboxes) como revisado numa data,
  mantém o status, histórico REVISAO_GERAL em cada um, tudo numa transação. Fonte de reavaliação `src/lib/requisitos-legais/reavaliacao.ts`
  (importada pelo cron): alerta REAVALIACAO_PROXIMA por requisito ao responsável (ou quem cadastrou).
- **Telas**: `/requisitos-legais` (planilha densa com cabeçalho fixo e rolagem própria; filtros tema/esfera/status/obra/processo/"só
  vencidas"; badge de status colorido — `BadgeStatusRequisito` em `componentes/badge.tsx`; marca "vencida" e barra lateral na linha;
  resumo com % de atendimento e nº de vencidas), `/requisitos-legais/novo` (dados + avaliação inicial + primeira ação;
  `?processo=` pré-seleciona), `/requisitos-legais/[id]` (dados/editar, verificação, plano 5W2H, histórico, evidências, comentários),
  `/requisitos-legais/revisao-geral`. Detalhe do processo: cartão "Requisitos legais" (+ Novo). Dashboard: painel com % de
  atendimento, não atende/parcial e verificação vencida. Menu: grupo **Gestão** (`GRUPO_POR_MODULO` atualizado).
- **Seed** (`prisma/seed-requisitos-legais.ts`, via serviço): 13 requisitos da Monto (NR-18, NR-35, NR-06, NR-07, NR-01, NR-10, NR-22,
  Lei 12.305/2010, CONAMA 307/2002, licença de instalação estadual, CLT 157/158, NBR 15575, Código Civil 618): NR-35 atende
  parcialmente e CONAMA 307 **não atende**, ambos com plano de ação real; NR-22 não aplicável; 2 em análise; NR-07 e a licença com
  verificação vencida; NR-06 com verificação posterior no histórico.
- **Testes**: `tests/requisitos-legais.test.ts` (regras) e `npm run test:requisitos-legais` (10 casos: gating, permissão/responsável,
  escopo por obra, plano obrigatório e gerado, histórico e revisão geral, trigger de imutabilidade, evidência por anexo, isolamento,
  código sequencial em paralelo, resumo do dashboard).

## P6 — Incidentes e Acidentes entregue (2026-09-26) — P6 completo

- **Schema** (migração `20260927300000_incidentes`): `Incidente` (código `INC-NNN-AA`, `TipoSequencia.INCIDENTE`; `TipoIncidente`
  ACIDENTE_TIPICO/ACIDENTE_TRAJETO/QUASE_ACIDENTE/DOENCA_OCUPACIONAL, `GravidadeIncidente` SEM_AFASTAMENTO/COM_AFASTAMENTO/FATALIDADE,
  data/hora, obra obrigatória = escopo, setor e local opcionais, descrição dos fatos, envolvido usuário **ou** terceiro (CHECK),
  testemunhas, status ABERTO/EM_INVESTIGACAO/CONCLUIDO, responsável pela investigação, `causaRaiz` + `metodoCausaRaiz` +
  `analiseCausa` (mesmo formato validado da RNC), conclusão, `planoAcaoId` único, `restrita`, `contemDadosPessoais` (CHECK: dados
  pessoais ⇒ restrita), dias perdidos, `geraCat` + nº da CAT (só registro, sem integração), versão), `IncidenteDadosSensiveis` (1:1,
  mesmo padrão de `RncDadosSensiveis` + relato das testemunhas) e `HistoricoIncidente` (**append-only** por trigger). Permissões
  `INCIDENTE_GERENCIAR` (Qualidade e Segurança) e `INCIDENTE_VER_RESTRITOS` (Segurança). `OrigemPlanoAcao`, Interação, Notificação
  += `INCIDENTE`; Anexo += `INCIDENTE` e `INCIDENTE_DADOS_SENSIVEIS`; notificações `INCIDENTE_REGISTRADO` e `INCIDENTE_ATRIBUIDO`.
- **LGPD** (mesma lógica da RNC restrita): envolvido, terceiro, testemunhas ou dados sensíveis ⇒ restrito automaticamente.
  Restrito só aparece para `INCIDENTE_VER_RESTRITOS`, quem registrou e o responsável (que precisa da permissão). Envolvido,
  testemunhas, dados sensíveis e anexos sensíveis só com `INCIDENTE_VER_RESTRITOS`: sem ela o serviço devolve esses campos como null
  e `contemDadosPessoais=false` — o usuário não sabe que existem. Anexo sensível passou a ser checado pela permissão do tipo
  (`podeVerSensivel` em `anexos/servico.ts`). Notificações e título do plano (neutro "Investigação do incidente INC-…" quando
  restrito) nunca levam dados pessoais.
- **Decisões**: registrar é aberto a qualquer usuário com o módulo e a obra no escopo (participação dos trabalhadores, ISO 45001
  5.4); investigar/editar/plano/concluir = `INCIDENTE_GERENCIAR` ou responsável; concluir exige causa raiz; concluído é imutável;
  dias perdidos não se aplicam a "sem afastamento". A análise de causa reaproveita o componente `CausaForm` da RNC (nova prop `acao`).
  Planos de origem INCIDENTE seguem a visibilidade de planos sem RNC (PLANO_GERENCIAR + obra) — por isso o título neutro.
- **Telas**: `/incidentes` (filtros obra/tipo/gravidade/status, cadeado nos restritos, badges `BadgeGravidadeIncidente`/
  `BadgeStatusIncidente`), `/incidentes/novo` (celular primeiro: segmentado de envolvido ≥44px, toggle de dados sensíveis, fotos de
  evidência e anexos sensíveis para quem pode ver), `/incidentes/[id]` (registro/editar, cartão restrito de envolvidos e dados
  sensíveis, investigação com responsável e causa raiz, concluir, plano 5W2H, evidências, comentários, histórico). Menu (Segurança).
  Dashboard: taxa de frequência simples (incidentes/mês em 12 meses), quase-acidentes, com afastamento e barras por gravidade — só o
  que o usuário pode ver.
- **Seed** (`prisma/seed-incidentes.ts`): 6 incidentes (3 quase-acidentes, 2 típicos — 1 com afastamento e CAT —, 1 de trajeto; sem
  fatalidade); INC-003 restrito com dados sensíveis reais; INC-004 com plano de ação de investigação; 2 concluídos com causa raiz.
- **Testes**: `tests/incidentes.test.ts` e `npm run test:incidentes` (9 casos: gating, escopo, permissão, LGPD — inclusive
  anexos, comentários, notificações e responsável —, ciclo com plano, trigger, isolamento, sequência em paralelo, dashboard).

## P7 — Indicadores entregue (2026-09-26)

- **Schema** (migração `20260927400000_indicadores`): `Indicador` (nome único por empresa, descrição, processo opcional, unidade texto,
  `DirecaoIndicador` MAIOR_MELHOR/MENOR_MELHOR, meta `Decimal(14,4)`, `PeriodicidadeIndicador` MENSAL/TRIMESTRAL/SEMESTRAL/ANUAL,
  `FonteIndicador` MANUAL/RNC_EFICACIA_PRIMEIRA_VERIFICACAO/PLANO_ITENS_ATRASADOS, fórmula/fonte texto, responsável, `ativo` = exclusão
  lógica, `versao` = trava otimista) e `ResultadoIndicador` (período texto `2026-01`/`2026-T1`/`2026-S1`/`2026` — CHECK de formato —, valor,
  **cópia da meta e da direção no lançamento**, `automatico`, observação, registrado por, criado em). Permissão `INDICADOR_GERENCIAR`
  (perfil Qualidade do seed). Interação/Notificação += `INDICADOR`; notificação `INDICADOR_SEM_LANCAMENTO`. Não é o `IndicadorProcesso`
  do P1 (texto livre no SIPOC), que continua no detalhe do processo.
- **Decisão — trilha**: `ResultadoIndicador` é **append-only** (trigger bloqueia UPDATE/DELETE) e serve de histórico; não há
  `HistoricoIndicador`. Correção = novo lançamento do mesmo período com observação obrigatória; o mais recente vale (`vigentesPorPeriodo`)
  e o anterior aparece como "substituído por correção". Como cada resultado guarda a meta vigente, mudar a meta não reescreve o passado.
- **Regras** (`src/lib/indicadores/periodos.ts`, puro): período por data/periodicidade, aritmética de períodos, limites (dia inicial/final),
  último período fechado, rótulos (`mar/26`, `1º tri/26`), **atingido** = valor ≥ meta (maior melhor) ou ≤ meta (menor melhor),
  situação no período de referência (último fechado): ATINGIDO / NAO_ATINGIDO / SEM_LANCAMENTO. Lançamento de período futuro é negado.
- **Automáticos** (`src/lib/indicadores/automaticos.ts`, estende o dashboard reaproveitando `diaNoFuso` de `calculos.ts`): "% de RNCs eficazes
  na 1ª verificação" (mesma definição do KPI do dashboard, recortada pelo período) e "% de itens de ação atrasados" (itens com prazo no
  período, sem cancelados: concluído depois do prazo ou aberto com prazo vencido). O detalhe mostra o valor calculado do último período
  fechado e do corrente (parcial); "Registrar valor calculado" grava o resultado (`automatico = true`); lançamento manual é negado.
  **Decisão**: o valor é agregado da empresa inteira (independe do escopo de quem consulta), para todos verem o mesmo número; só a
  porcentagem sai, sem dados de RNC restrita. Unidade dos automáticos é sempre `%`.
- **Acesso** (`acesso.ts` / `gestao.ts`): leitura = módulo (indicador é corporativo, sem obra). Cadastrar/editar/inativar =
  `INDICADOR_GERENCIAR`; lançar = `INDICADOR_GERENCIAR` **ou o responsável**.
- **Alerta** (`src/lib/indicadores/reavaliacao.ts`, importado pelo cron): indicador ativo sem resultado no último período fechado →
  `INDICADOR_SEM_LANCAMENTO` ao responsável (ou quem cadastrou), um por período (chave idempotente com o prazo = fim do período + 15 dias).
  Para isso `FonteReavaliacao` ganhou `tipoNotificacao` livre, `diasAntecedencia` e `mensagem` próprios (padrões mantidos para as fontes antigas).
- **Telas**: `/indicadores` (filtro processo/situação/inativos, resumo atingidos/não atingidos/sem lançamento, badge `BadgeSituacaoIndicador`,
  últimos 4 resultados em chips verde/vermelho, "Lançar" nas pendentes), `/indicadores/meus` (mesma tela, só os do responsável — menu
  "Meus indicadores"), `/indicadores/novo` (`?processo=`), `/indicadores/[id]` (gráfico de linha SVG resultado × meta tracejada com pontos
  verde/vermelho e períodos sem lançamento vazios — `componentes/grafico-indicador.tsx` —, lançar/registrar calculado, dados/editar,
  inativar, lançamentos com correções, comentários). Processo: cartão "Indicadores com meta e resultados" (+ Novo). Dashboard: painel
  "Indicadores — metas" (% atingidas, não atingidas, sem lançamento). Menu: grupo Gestão.
- **Seed** (`prisma/seed-indicadores.ts`, via serviço, períodos relativos a hoje): 6 manuais (satisfação do cliente trimestral, prazo de
  entrega de materiais, perda de concreto com uma correção, taxa de frequência de acidentes **sem lançamento no último mês**, horas de
  treinamento, resíduos semestral) com 3–4 períodos e 2 automáticos registrados a partir dos dados reais (períodos sem dados ficam sem
  lançamento).
- **Testes**: `tests/indicadores-metas.test.ts` (atingido, períodos, correção, cálculo automático puro) e `npm run test:indicadores`
  (9 casos: gating, permissão/responsável, período inválido/futuro, correção, trigger, automático do plano de ação conferido com os itens
  reais, automático de RNC, alerta idempotente, isolamento, listas e dashboard).

## P7 — Treinamentos e competências entregue (2026-09-26) — P7 completo

- **Schema** (migração `20260927500000_treinamentos`): `Treinamento` (nome único, `TipoTreinamento` INTEGRACAO/NR/RECICLAGEM/TECNICO/OUTRO,
  descrição, carga horária, `validadeMeses` — null = não vence —, obrigatoriedade, `ativo`, `versao`), `SessaoTreinamento` (data de
  realização — não futura —, instrutor texto, obra opcional, carga, observação) e `ParticipacaoTreinamento` (única por sessão+usuário;
  presente, aproveitamento texto, `certificadoAnexoId` → Anexo `CERTIFICADO_TREINAMENTO`, `dataValidade` calculada; CHECK: ausente não tem
  validade). Permissão `TREINAMENTO_GERENCIAR` (perfis Qualidade e Segurança). Anexo += `CERTIFICADO_TREINAMENTO`; Interação/Notificação +=
  `TREINAMENTO`; notificação `TREINAMENTO_VENCENDO`.
- **Decisão — obrigatoriedade**: simples, por **todos os usuários ativos** (`obrigatorioTodos`) **ou por setores** (`obrigatorioSetorIds`,
  comparado com `Usuario.setorId`). Não há cargo no cadastro de usuário, então não se usa cargo texto; sem marcação = opcional (aparece na
  matriz só para quem fez).
- **Regras** (`src/lib/treinamentos/regras.ts`, puro): validade = data da sessão + meses (`calcularProximaReavaliacao`, fim de mês
  ajustado); status pela **última realização presente** (reciclagem resolve o vencido; ausência não conta): NAO_REALIZADO / EM_DIA (sem
  validade ou > 30 dias) / A_VENCER (até hoje + 30, vence hoje ainda vale) / VENCIDO. Matriz = usuários × treinamentos; célula vazia =
  não obrigatório e não realizado. **% em dia** = obrigatórias EM_DIA ou A_VENCER ÷ obrigatórias. A validade fica gravada na participação;
  mudar `validadeMeses` do treinamento recalcula todas as participações presentes na mesma transação.
- **Acesso**: catálogo (lista, detalhe, sessões) aberto a quem tem o módulo; cadastrar treinamento/sessão, lançar presença, anexar
  certificado e ver a matriz/participantes = `TREINAMENTO_GERENCIAR`. Cada pessoa vê a própria situação e os próprios certificados
  (anexo: participante lê, só o gestor envia/exclui). Filtro de obra da matriz = pessoas com acesso explícito à obra.
- **Alerta** (`src/lib/treinamentos/reavaliacao.ts`, cron): última realização de cada pessoa/treinamento ativo com validade até hoje + 30
  dias (ou vencida) → `TREINAMENTO_VENCENDO` ao participante e a quem cadastrou o treinamento (fonte com `diasAntecedencia = 30`, chave
  idempotente por participação + data).
- **Telas**: `/treinamentos` (catálogo com validade, obrigatoriedade, nº de sessões e última; sessões recentes), `/treinamentos/novo`,
  `/treinamentos/[id]` (registrar sessão; por sessão, **presença em lote**: uma linha por usuário ativo com —/Presente/Ausente,
  aproveitamento e upload do certificado — PDF/imagem validado por magic bytes —; situação da equipe com pendentes; dados/editar;
  comentários; quem não gerencia vê só a própria participação), `/treinamentos/matriz` (cabeçalho e 1ª coluna fixos, badges
  `BadgeStatusCompetencia`, filtros obra/pessoa/treinamento, resumo), `/treinamentos/meus` (vencidos e a vencer primeiro, certificado,
  histórico). Dashboard: painel com % em dia, vencendo em 30 dias e vencidos/não realizados (empresa para quem gerencia; própria situação
  para os demais). Menu (grupo Gestão): Treinamentos, Matriz de competências (com a permissão), Meus treinamentos.
- **Seed** (`prisma/seed-treinamentos.ts`, via serviço, datas relativas a hoje): Integração (obrigatória para todos, 12 meses), NR-35
  (Segurança, 24 meses, com reciclagem que resolve um vencido), NR-18 (Segurança e Meio Ambiente, 12 meses), Brigada de incêndio
  (opcional) e Gestão de resíduos (Meio Ambiente, não vence) — 11 sessões, participações com vencidos, a vencer, em dia e ausências, e 6
  certificados PDF.
- **Testes**: `tests/treinamentos.test.ts` (validade, status, obrigatoriedade, matriz e resumo) e `npm run test:treinamentos` (8 casos:
  gating, permissão, matriz refletindo presença/validade e reciclagem, alerta idempotente, recálculo da validade, certificado,
  isolamento, seed/dashboard).

## P7+ — Treinamentos: MVP do dossiê docs/ideias/06 entregue (2026-09-27)

- **Schema** (migração `20260927700000_treinamentos_mvp`): `Treinamento` += `critico` e `diasAvaliacaoEficacia` (CHECK 1–365);
  `SessaoTreinamento` += `ModalidadeTreinamento` (PRESENCIAL/EAD/SEMIPRESENCIAL), `conteudoProgramatico`, `qualificacaoInstrutor`;
  `ParticipacaoTreinamento` += eficácia (`ResultadoEficacia` EFICAZ/NAO_EFICAZ, observação, avaliador, data — CHECK: só presente e campos
  juntos); nova `GatilhoReciclagem` (pessoa, treinamento, `MotivoGatilhoReciclagem`, data do evento, descrição).
- **Decisão — gatilho sem "resolvido"**: a pendência é calculada. Evento com data **posterior** à última realização presente →
  `RECICLAGEM_PENDENTE` (vencido prevalece); sessão no próprio dia do evento resolve. Gatilho lançado por engano é excluído.
- **Aptidão calculada** (`calcularAptidao`): inapto se algum treinamento **crítico e obrigatório** estiver vencido, não realizado ou com
  reciclagem pendente. Coluna "Aptidão" na matriz (motivos no tooltip), cartão em "Meus treinamentos", `resumo.inaptos`.
- **Eficácia** (`situacaoEficacia`): AGUARDANDO até data da sessão + dias; depois PENDENTE; "Não eficaz" exige a ação. Marcar ausente
  limpa a avaliação. Formulário por participante no detalhe da sessão.
- **NR-1** (`pendenciasNr1`, tipos NR/RECICLAGEM): conteúdo programático, qualificação do instrutor e carga horária ≥ a do catálogo.
  **Decisão**: é aviso/evidência, não invalida a validade (evita derrubar a matriz por dado histórico incompleto).
- **Modo auditoria** (`/treinamentos/auditoria`, menu "Evidências p/ auditoria", TREINAMENTO_GERENCIAR): indicadores e, por
  treinamento, sessões com presença, certificados/presentes, eficácia e NR-1; impressão/PDF só do relatório.
- **Fora deste pacote**: ASO/LGPD, alertas escalados (60/30/0), crachá digital, itens v2/v3+ do dossiê.
- **Testes**: `tests/treinamentos.test.ts` (+ gatilho, aptidão, eficácia, NR-1) e `npm run test:treinamentos` (+2 casos).

## P7+ — Treinamentos: função, alertas escalados e conscientização (2026-09-27)

- **Schema** (migração `20260927800000_treinamentos_funcao_conscientizacao`): nova `Funcao` (nome único por empresa, ativo) e
  `Usuario.funcaoId`; `Treinamento` += `obrigatorioFuncaoIds` e `documentoId` (→ Documento); `TipoTreinamento` += `CONSCIENTIZACAO`.
- **Obrigatoriedade** = todos OU setor OU função (união). Administração ganhou a aba "Funções" e o campo Função no usuário;
  a matriz mostra setor · função.
- **Alertas escalados** (três fontes de reavaliação, chaves idempotentes distintas por sufixo no entidadeId): 60 dias → colaborador;
  30 dias → quem cadastrou + todos com TREINAMENTO_GERENCIAR; vencido → colaborador + gestores ("INAPTA" se crítico).
- **Conscientização (ISO 7.3)** — **decisão**: reaproveita a ciência de documentos em vez de registro novo. Treinamento vinculado a
  documento: cada ciência vira realização (data da confirmação no fuso) e a publicação da revisão vigente vira gatilho — quem só deu
  ciência de revisão anterior fica em "Reciclagem pendente". Sessões presenciais também contam.
- **Seed**: funções Encarregado de obra / Montador de andaime / Eletricista; NR-35 obrigatória também para Montador; treinamento
  "Política do SGI — conscientização" ligado ao POL-001.
- **Testes**: `npm run test:treinamentos` (12 casos: + alertas escalados, função, conscientização).

---

## TODOS OS PACOTES P1-P7 ENTREGUES

| Módulo (`Modulo`) | Resumo |
|---|---|
| RNC | Não conformidades com análise de causa, plano 5W2H, verificação de eficácia, cancelamento aprovado e restrição LGPD (base). |
| PLANO_ACAO | Planos 5W2H avulsos ou de qualquer origem (RNC, riscos, HIRA, LAIA, inspeções, requisitos, incidentes), prazos e alertas (base). |
| MAPA_PROCESSOS | Processos em planilha/mapa de 3 raias com SIPOC, interações, versões publicadas e publicação via aprovação (P1). |
| RISCOS_OPORTUNIDADES | Matriz P×I com heatmap, tratamento com plano obrigatório para alto/crítico, reavaliação item/geral e aprovação opcional (P2). |
| SWOT | Ciclos anuais com quadro 2×2, partes interessadas (influência × interesse) e geração de risco/oportunidade (P2). |
| HIRA | Perigos e riscos por obra com P×S inicial/residual, hierarquia de controle e fluxo de aprovação (motor ou tramitação) (P3). |
| LAIA | Aspectos e impactos com pontuação por eixos, significância por critérios extras e fluxo de aprovação (P3). |
| DOCUMENTOS | Tramitação com revisores/aprovadores, revisões imutáveis, publicação com público e ciência, lista mestra e revisão periódica (P4). |
| INSPECOES | Modelos de checklist, execução em campo com fotos, % de conformidade e RNC/item de ação a partir da resposta NC (P5). |
| AUDITORIAS | Programa anual, plano de auditoria, constatações NC/OBS/OM/PF com evidências e RNC a partir da NC (P5). |
| INCIDENTES | Incidentes e acidentes com dados sensíveis protegidos, investigação com causa raiz, plano e taxa de frequência (P6). |
| INDICADORES | Indicadores com meta e periodicidade, resultados append-only, 2 automáticos (RNC/Plano de Ação), gráfico e alerta sem lançamento (P7). |
| TREINAMENTOS | Catálogo com validade/obrigatoriedade, sessões, presença em lote com certificado, matriz de competências e alerta de vencimento (P7). |

**Módulos ativos por empresa no seed**:
- **Monto** (`00000000000100`): todos — RNC, PLANO_ACAO, MAPA_PROCESSOS, RISCOS_OPORTUNIDADES, SWOT, HIRA, LAIA, INSPECOES, AUDITORIAS,
  DOCUMENTOS, INCIDENTES, INDICADORES, TREINAMENTOS.
- **Demo** (`00000000000200`): só o padrão do schema — RNC e PLANO_ACAO (usada nos testes de gating e isolamento multi-tenant).
