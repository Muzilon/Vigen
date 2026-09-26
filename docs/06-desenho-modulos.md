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
