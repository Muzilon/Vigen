# Quadro Kanban do Vigen (02/10/2026)

**URL (privada, só o dono abre):** https://claude.ai/artifact/6w1VvSy32EMMmmELxuwSAL
**Para quê:** acompanhar o projeto sem depender do limite de 100 chamadas por dia do conector do ClickUp. Os dados ficam no banco do próprio artefato (coleção `tarefas`, um documento por item, `doc_id` = ID, por exemplo `TR-013`, `FE-020`, `FE-020-03`).

## Como usar
- **Quadro:** 6 colunas (Backlog, Pronto para fazer, Em andamento, Em revisão, Bloqueado, Concluído) com contador. Mover por arrastar (computador) ou pelo menu "Mover para…" no cartão (celular).
- **Telas no quadro:** as 58 subtarefas de tela ficam escondidas por padrão; a mãe do módulo mostra a barra de progresso (telas concluídas). Marque "Mostrar telas no quadro" para vê-las. Na tabela e no cartão da mãe elas sempre aparecem.
- **Filtros:** lista, módulo, marco, responsável, "Só do Eric", "Só atrasadas", "Falta cadastrar no ClickUp" e busca por texto.
- **Tabela:** ordenável por qualquer coluna. **Decisões abertas:** lista as decisões sem resposta, com o que cada uma bloqueia e o botão "Registrar resposta do Eric".
- **Abrir cartão:** edita todos os campos; mostra dependências, quem aguarda a tarefa, a mãe e as telas do módulo com progresso.
- **Regra do projeto (DoD):** tarefa nova nunca nasce Concluída; para ir a Concluído (por arrastar, menu ou edição) é obrigatório escrever a evidência, senão a tela avisa e não grava.
- **Falta cadastrar no ClickUp:** selo laranja nos itens com `noClickUp = nao`. "Exportar JSON" e "Exportar CSV" geram o quadro inteiro para carga em lote no ClickUp.
- Nenhuma senha, URL de banco, e-mail ou dado de cliente foi carregado.

## Novidades (versão 2, mesma URL)
- **Nova coluna "Para avaliar (Claude)"**, a primeira do quadro (status `avaliar`). Ao criar tarefa com responsável Claude ou `agente-xxx`, a página sugere `avaliar`; as demais ficam em Backlog. Os 127 documentos existentes não foram alterados.
- **Campos novos e opcionais** (ausência vale vazio): `avaliacao` (texto), `viavel` (sim | parcial | nao), `esforco` (P | M | G), `precisaDe` (nada | decisao do Eric | teste do Eric | dependencia | outro), `avaliadoEm` (ISO), `autorizado` (verdadeiro/falso, "Claude pode executar"). No cartão aberto há a seção "Avaliação do Claude" (editável pelo Eric) com a caixa "Claude pode executar".
- **Aba "Fila do Claude":** quatro blocos (Para avaliar, Avaliadas, Em andamento, Em revisão) com contagem; cada cartão mostra ID, título, esforço, "precisa de" e se está autorizado. Cartão autorizado e sem dependência pendente tem borda dupla e o selo "Claude pode executar agora". Entram na fila itens com responsável Claude ou agente, ou já avaliados.
- **Aba "Indicadores":** KPIs, distribuição por situação, lista, marco e responsável, progresso dos módulos FE-020 a FE-035 (telas concluídas / total), itens críticos (bloqueadas, atrasadas, decisões D-04, D-06, D-07, D-16 com quantas tarefas dependem de cada uma), resumo da fila do Claude e concluídas por semana (mostra mensagem de poucos dados enquanto houver menos de 3 conclusões em 2 semanas). Usa só os filtros Lista e Marco. Tudo calculado no navegador. A contagem de dependentes é direta, como gravada no banco (ex.: FE-001 não consta como dependente de D-16).
- A regra de Concluído exigir evidência continua valendo.

## Como pedir ao Claude: "avalie as tarefas para avaliar"
1. O Eric cria a tarefa na página com responsável Claude (ou agente) e ela cai em "Para avaliar".
2. Na conversa principal, o Claude lê a coleção `tarefas` (status `avaliar`), grava `avaliacao`, `viavel`, `esforco`, `precisaDe` e `avaliadoEm`, e move para Pronto para fazer, Bloqueado ou Em revisão.
3. O Eric marca "Claude pode executar" nas que aprova; a aba Fila do Claude destaca as autorizadas sem dependência pendente.

## Totais carregados (127 documentos, conferidos por leitura do banco)
| Coluna | Itens |
|---|---|
| Backlog | 97 |
| Pronto para fazer | 16 |
| Em andamento | 2 (TR-001, TR-005) |
| Em revisão | 4 (TR-013, TR-014, BE-013, BE-002) |
| Bloqueado | 0 |
| Concluído | 8 (decisões já respondidas, com a resposta como evidência) |

| Lista | Itens |
|---|---|
| Front-end | 82 (8 de casca e opcionais, 16 mães FE-020 a FE-035, 58 subtarefas de tela) |
| Back-end e produção | 14 (BE-001 a BE-014, com BE-005 a BE-012 separados) |
| Transversal e testes | 14 |
| Decisões | 17 (D-01 a D-17; 9 abertas, 8 respondidas) |
| Backlog (ideias) | 0 |

No ClickUp (segundo os documentos): `sim` 39, `nao` 80, `desconhecido` 8.

## Divergências encontradas entre os documentos (e o que foi adotado)
1. Plano mestre §11 fala em D-01 a D-15 como tarefas; doc. 06 só cria as 9 abertas. Adotado: as 17 decisões entram no quadro; as 8 respondidas ficam `concluido` com a resposta em `evidencia` e `noClickUp = nao` (por desenho só existem no doc. 04).
2. Prioridade das decisões: doc. 04 dá Normal/Baixa a D-04 a D-10 e D-13; doc. 06 manda tag de prioridade Alta na lista Decisões. Adotado o doc. 06 (mais recente): Alta.
3. FE-006 a FE-011 do plano mestre foram substituídas por FE-020 a FE-035 no doc. 06. Adotado o doc. 06; as antigas não entram.
4. BE-005 a BE-012: o plano mestre tem 8 itens com dependências próprias; o ClickUp tem uma tarefa agregada. No quadro estão separados, como pedido.
5. Dependência de BE-005, BE-006 e BE-007 em BE-001: o doc. 06 diz que a agregada aguarda BE-001; o plano mestre cita só as decisões D-08 e D-09. Mantidas as duas.
6. TR-012 (checklist de QA por módulo) e TR-011 existem no plano mestre e em nenhum lote. TR-007 não existe em lugar nenhum. Entraram TR-011 e TR-012 como `nao`; TR-007 não foi criada.
7. TR-009 e TR-010 aparecem sem marco no plano; usei M2 com prazo 28/02/2027 por serem pré-requisito de FE-002.
8. O doc. 06 cita "10 dependências" mas lista 8 pares (10 vínculos). Não afeta o quadro.
9. O doc. 06 não dá data a FE-013 e BE-014; ficaram sem prazo (BE-014 com marco M6 por suposição minha).
10. A verificação de 02/10 contra o ClickUp falhou por limite de chamadas: **nada foi conferido no ClickUp**; o campo `noClickUp` reflete só o que os documentos afirmam.

## O que ficou como "desconhecido"
- BE-005 a BE-012 (8 itens): só a tarefa agregada existe no ClickUp; as separadas não foram criadas, mas a agregada cobre o assunto.
- Todas as marcações `sim` não foram confirmadas no ClickUp (ver divergência 10).

## Pendências que precisam de decisão do Eric
- Entram TR-011 e TR-012 no ClickUp? (TR-007 não existe.)
- Desmembrar BE-005 a BE-012 em tarefas separadas no ClickUp?
- Prazos seguem provisórios (D-12); responsáveis foram sugeridos pelos agentes do plano e podem ser ajustados no cartão.

## Observação técnica
Os campos seguem o modelo pedido (id, titulo, tipo, lista, modulo, marco, status, responsavel, prazo, prioridade, depende_de, mae, evidencia, notas, noClickUp, criadoEm, atualizadoEm). Itens criados no ClickUp em 01/10/2026 têm `criadoEm` 2026-10-01; os demais 2026-10-02. Novas tarefas criadas pela página recebem ID `NV-001`, `NV-002`…
