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
| Quando (reprogramado) | Não existe como campo; há justificativa em alguns casos de data | **[Decidido] Novo**: nova data com justificativa obrigatória, sujeita a aprovação (ver regra abaixo); o prazo original fica guardado | Lista (mostra o reprogramado e marca que houve) e detalhe |
| Status | Existe (pendente, em andamento, concluído, cancelado; «atrasado» é calculado) | Mantém; mostra «Vencido» em texto | Lista |
| Por quê | Existe | Mantém | Detalhe |
| Como | Existe (texto) | **Proposta:** texto livre (o «Item» passou a ser o ID da ação, não um passo) | Detalhe |
| Item | Não existe | **[Decidido] Novo:** código único da ação (ID), gerado pelo sistema, sem digitação | Lista e detalhe |
| Local («onde») | Existe | Mantém | Detalhe |
| Partes envolvidas | Não existe (só «quem») | **[Decidido] Novo, opcional:** áreas da empresa e partes externas (cliente, órgão público, fornecedor etc.) | Detalhe |
| Área/Departamento | A conferir no código | **Proposta:** vem da origem ou do responsável, sem digitar de novo | Detalhe e filtro |
| Quanto | Existe | **Opcional** (a planilha usada hoje não tem) | Detalhe |
| Ano | Não existe | Calculado a partir do prazo; serve de filtro | Filtro |
| Observação | Existe como conversa na ação | Mantém | Detalhe |
| Justificativa | Existe em alguns casos de data | Passa a ser a justificativa da reprogramação | Detalhe |
| Data de conclusão | A conferir | Preenchida automaticamente ao concluir | Detalhe |

**Lista principal [Proposta]:** Origem, O que deve ser feito, Quem, Quando e Status. Tudo o mais fica no detalhe.
**Respostas do Eric (05/10/2026) [Decidido]:**
1. Partes envolvidas: áreas, mas também partes externas (cliente, órgão público, fornecedor etc.).
2. Item: é o ID da ação.
3. Reprogramação: passa por aprovação; se quem pede é o próprio aprovador, não precisa de aprovação.
4. Quem pode pedir: o responsável pela ação e quem gerencia o plano.

**Regra da reprogramação [Decidido]:**
- O pedido leva nova data e justificativa obrigatória.
- Se quem pede é o aprovador, a aprovação é automática e fica registrada no histórico (quem, quando, motivo «autoaprovação»).
- Nos demais casos, o aprovador aprova ou recusa. Recusa mantém o prazo original e avisa quem pediu.
- Enquanto o pedido está em aprovação, vale o prazo original (a ação pode ficar vencida nesse meio tempo).
- O prazo original nunca é apagado; cada reprogramação fica no histórico.

**Atenção:** a autoaprovação contraria a regra do motor de aprovação atual («quem solicita nunca aprova o próprio pedido»). Precisa ser uma exceção explícita, só para reprogramação, e visível em auditoria.

**Respostas do Eric (05/10/2026, segunda rodada) [Decidido]:**
- (a) Aprovador: o gestor da Qualidade, definido pelo administrador de cada empresa.
- (b) Partes externas: cadastro próprio, escolhido em lista suspensa.
- (c) Limite: sem limite por padrão. Limite possível: intervalo mínimo de X dias desde a última reprogramação, configurável por empresa.

**Como entra na Fase 1 [Proposta do Claude]:**
- Aprovador: um papel «Gestor da Qualidade», que o administrador atribui a uma ou mais pessoas. É configuração de permissão (já prevista), e não de fluxo. O fluxo continua fixo, como diz o registro de decisões do doc 08.
- Intervalo mínimo: fica para a fase seguinte. Como o padrão é «sem limite», nada se perde em fevereiro.
- Cadastro de partes externas: lista mantida pela Qualidade ou pelo administrador (nível 2 de configurabilidade). Só nome da organização e tipo; nenhum dado pessoal de contato na Fase 1 (LGPD).

**Respostas do Eric (05/10/2026, terceira rodada) [Decidido]:**
- (d) Sem autoaprovação: o pedido sempre sobe para aprovação, mesmo quando quem pede é o próprio gestor da Qualidade; o clique dele vira evidência. Isso substitui a «aprovação automática» anterior.
- (e) Intervalo mínimo em dias corridos; o gestor da Qualidade pode liberar o bloqueio, com justificativa. Fica para a fase seguinte.
- (f) Partes externas: só nome e tipo; o sistema já vem com registros pré-cadastrados.

**[Proposta do Claude]** Se mais de uma pessoa tiver o papel «Gestor da Qualidade», o pedido de uma vai para a outra; a aprovação pela mesma pessoa fica só para quando ela é a única, e o histórico marca «sem segregação». Aprovar o próprio pedido registra quem decidiu, mas não prova uma segunda opinião.

**Em aberto:** «pré-cadastrados» quer dizer só os tipos (cliente, órgão público, fornecedor) ou também organizações (por exemplo, órgãos ambientais)? Órgãos mudam por estado.

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

**Participantes da análise [Decidido 05/10]:** a Qualidade e a área afetada; quem preenche a RNC pode incluir outras pessoas. **[Decidido 05/10]** Os incluídos só ficam registrados e podem visualizar; quem elabora e edita a análise é a Qualidade.

**Nota:** a decisão tem três saídas, e não duas: nem toda não conformidade precisa de causa raiz. Quem pode ser avisado e o que é registrado em cada saída são perguntas em aberto no artefato «Fluxos do Vigen».
