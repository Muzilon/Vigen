# Informações por tela: Plano de Ação e RNC (rascunho)

**Estado:** rascunho de 05/10/2026, montado pelo Claude a partir de uma planilha de plano de ação usada hoje por uma empresa (só as colunas; nenhum nome ou dado foi levado a este documento) e da ISO 9001, item 10.2. O Eric decide. **[Decidido]** o que o Eric aceitar; **[Proposta]** o restante.
**Motivo:** a tela flutuante atual mostra informação demais. Cada campo precisa ter um lugar: lista (para decidir) ou detalhe (para trabalhar).

## 1. Plano de Ação

Colunas da planilha usada hoje: Origem; Área/Departamento; O que deve ser feito; Como; Item; Por quê; Quem; Local; Partes envolvidas; Quando (previsto); Quando (reprogramado); Status; Ano; Observação; Justificativa; Data de conclusão.

| Campo | No protótipo atual | Proposta | Onde aparece |
|---|---|---|---|
| Origem | Existe (RNC, inspeção, auditoria, risco, incidente, manual) | Mantém | Lista, como etiqueta |
| O que deve ser feito | Existe («o quê») | Mantém | Lista |
| Quem | Existe (uma pessoa) | Mantém | Lista |
| Quando (previsto) | Existe | Mantém | Lista |
| Quando (reprogramado) | Não existe como campo; há justificativa em alguns casos de data | **Novo**: nova data com justificativa obrigatória; o prazo original fica guardado | Lista (mostra o reprogramado e marca que houve) e detalhe |
| Status | Existe (pendente, em andamento, concluído, cancelado; «atrasado» é calculado) | Mantém; mostra «Vencido» em texto | Lista |
| Por quê | Existe | Mantém | Detalhe |
| Como | Existe (texto) | **Proposta:** lista de passos, para a ação poder ter itens numerados | Detalhe |
| Item | Não existe | **Novo, opcional:** número do passo dentro da ação | Detalhe |
| Local («onde») | Existe | Mantém | Detalhe |
| Partes envolvidas | Não existe (só «quem») | **Novo, opcional:** outras pessoas ou áreas envolvidas | Detalhe |
| Área/Departamento | A conferir no código | **Proposta:** vem da origem ou do responsável, sem digitar de novo | Detalhe e filtro |
| Quanto | Existe | **Opcional** (a planilha usada hoje não tem) | Detalhe |
| Ano | Não existe | Calculado a partir do prazo; serve de filtro | Filtro |
| Observação | Existe como conversa na ação | Mantém | Detalhe |
| Justificativa | Existe em alguns casos de data | Passa a ser a justificativa da reprogramação | Detalhe |
| Data de conclusão | A conferir | Preenchida automaticamente ao concluir | Detalhe |

**Lista principal [Proposta]:** Origem, O que deve ser feito, Quem, Quando e Status. Tudo o mais fica no detalhe.
**Perguntas ao Eric:** (1) «Partes envolvidas» são pessoas, áreas ou os dois? (2) «Item» numera passos dentro de uma ação, ou ações dentro de uma origem? (3) A reprogramação precisa de aprovação de alguém, ou só da justificativa? (4) Quem pode reprogramar?

## 2. RNC: análise crítica (passo anterior à causa raiz)

Base: a ISO 9001, item 10.2, pede reagir à não conformidade, corrigi-la e avaliar a necessidade de ação para eliminar a causa, antes de implementar e verificar a eficácia.

| Campo | Essencial ou opcional |
|---|---|
| Resumo do desvio (o que, onde, quando, quem identificou) | Essencial |
| Evidências anexas | Essencial |
| Requisito afetado (norma, procedimento, exigência do cliente ou legal) | Essencial |
| Correção imediata ou contenção, quando houver (o que, quem, até quando) | Essencial |
| Decisão: improcedente; procedente resolvida só com a correção; procedente com ação corretiva | Essencial |
| Justificativa (obrigatória quando improcedente) | Essencial |
| Área e responsável pelo tratamento; prazo da próxima etapa | Essencial |
| Data e participantes da análise | Essencial |
| Abrangência: outros processos, produtos ou unidades afetados | Opcional |
| Casos semelhantes (já ocorreu antes?) | Opcional |
| Impacto (cliente, segurança, meio ambiente, legal) | Opcional |
| Efeito em riscos e oportunidades | Opcional |
| Ata ou anexo da reunião | Opcional |

**Nota:** a decisão tem três saídas, e não duas: nem toda não conformidade precisa de causa raiz. Quem pode ser avisado e o que é registrado em cada saída são perguntas em aberto no artefato «Fluxos do Vigen».
