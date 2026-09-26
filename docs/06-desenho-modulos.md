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
