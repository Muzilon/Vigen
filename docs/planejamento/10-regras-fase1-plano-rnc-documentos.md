# Regras da Fase 1: Plano de Ação, RNC e Documentos

**Estado:** respostas do Eric de 05/10/2026 às perguntas do artefato «Fluxos do Vigen». **[Decidido]** é do Eric; **[Proposta]** é do Claude, a confirmar. Complementa o doc 09 (campos).

## 0. Público-alvo [Decidido]

O Vigen é para a **gestão** do SGI (corporativo: Qualidade, SSMA, gestores), não para o **controle** operacional de campo (obra, chão de fábrica). Se a empresa quiser registrar algo do campo, pode, por configuração. Consequência: Inspeções e Incidentes perdem prioridade; o produto é medido pela rotina da Qualidade.

## 0.1 Regra de prazos [Proposta]

Hoje há as duas contagens: Mapa de Processos e atividades em **dias úteis** (já implementado com feriados); reprogramação, eficácia e revisão periódica em **dias corridos**. Regra proposta: prazos longos (meses, ano, intervalos) em dias corridos; prazos operacionais curtos (etapas, assumir atividade) em dias úteis. Cada prazo diz na tela qual contagem usa.

## 1. Plano de Ação

| # | Regra [Decidido] |
|---|---|
| 1 | Reprogramação: com mais de um gestor da Qualidade, o pedido de um vai para outro; sendo o único, aprova o próprio pedido e o histórico registra |
| 2 | Partes externas: termos gerais pré-cadastrados (cliente, órgão público, fornecedor); a empresa cadastra os demais |
| 3 | Troca de responsável: a Qualidade pode trocar; avisa o anterior e o novo; fica no histórico |
| 4 | Vencimento: avisa a Qualidade, o responsável e o gestor da área |
| 5 | Concluir sem evidência: permitido, com confirmação explícita («concluir sem evidência»); a ação fica com etiqueta de alerta (pode ser questionada em auditoria); o dado vira indicador |
| 6 | Eficácia por ação: opcional, marcada por padrão no cadastro |
| 7 | Visões: lista e quadro (kanban, colunas = status) |

**Visão e acesso [Proposta]:** abrir em «Minhas ações»; aba «Todas» mostra o que a permissão deixa ver. «Todos veem tudo» como padrão contraria a premissa de confidencialidade: uma ação nascida de RNC confidencial (por exemplo, compliance ou assédio) herda a confidencialidade da origem. No quadro, «Vencida» é etiqueta, não coluna; arrastar para «Concluída» abre a mesma confirmação da conclusão (evidência), sem atalho.

## 2. RNC

| # | Regra [Decidido] |
|---|---|
| 1 | Participantes incluídos na análise crítica só ficam registrados e visualizam; quem elabora é a Qualidade |
| 2 | Abrir RNC: só quem tem permissão |
| 3 | Tratador: o gestor da Qualidade define; quem da Qualidade tem permissão de tratar pode assumir proativamente |
| 4 | Causa raiz: 5 Porquês, Ishikawa, texto livre |
| 5 | Eficácia da RNC: obrigatória, mesmo que as ações não tenham verificação própria. Ao concluir a última ação, o tratador usa «Programar avaliação de eficácia»: data mínima 30 dias após a última ação; máximo configurável, padrão 1 ano |
| 6 | Origem: Auditoria interna, Auditoria externa, Reclamação de cliente, Inspeção, Indicador, Autoidentificada. Gravidade: Baixa, Média, Alta, Crítica. Tipo: Qualidade, Segurança, Meio Ambiente, Compliance |

**[Proposta]**
- Item 3: assumir proativamente só quando a RNC ainda não tem tratador; depois disso, troca só pelo gestor.
- Item 4: outras ferramentas existentes: 8D (comum em reclamação de cliente, setor automotivo), Árvore de causas (acidentes de trabalho), Análise de barreiras, FMEA (preventiva, não reativa). Na Fase 1 ficam as três do Eric; Árvore de causas entra com Incidentes; 8D se um cliente pedir.
- Item 5: justificativa do padrão de 1 ano: cobre um ciclo completo de auditoria interna e de análise crítica pela direção.
- Item 6, origem: faltam Fornecedor, Incidente/acidente e Análise crítica pela direção (a confirmar).
- Item 6, gravidade: cada nível precisa de critério escrito na tela, senão cada um escolhe à sua maneira.
- Item 6, tipo «Compliance»: ver §4.

**Parâmetros numéricos por empresa [Proposta]:** valores como o máximo da eficácia (1 ano) e o intervalo entre reprogramações são uma configuração barata (uma tabela de parâmetros com padrão), diferente de configurar fluxos ou aprovadores, que segue fixo na Fase 1.

## 3. Documentos

| # | Regra [Decidido] |
|---|---|
| 1 | Aprovação: até 4 níveis, definidos por quem trata o documento a cada envio |
| 2 | Revisores e aprovadores escolhidos a cada envio; se a área tem padrão, aparece como sugestão destacada, sem preencher sozinho |
| 3 | Código do documento configurável (pesquisar padrões de mercado) |
| 4 | Lista mestra visível a todos. Revisão em curso: todos veem «Ativo»; a Qualidade vê «Ativo» e «Em tramitação». Documento novo: só a Qualidade vê, «Em elaboração» |
| 5 | Documentos externos entram na lista mestra, marcados como externos |
| 6 | Distribuição: a empresa define. Recomendação: visualização como cópia não controlada; impressão e distribuição a pedido, feitas pela Qualidade com GRD (guia de remessa de documento) |
| 8 | Cancelar ou tornar obsoleto: a Qualidade inicia, o gestor aprova, pela tramitação |
| 9 | Prazos da tramitação em dias corridos, com aviso de atraso; indicador e meta opcionais por empresa |

**[Proposta]**
- Item 1: quem trata escolhe os próprios aprovadores; para não escolher só quem aprova fácil, o último nível é sempre do dono da área ou da Qualidade (a decidir).
- Item 5: «não controlado pelo SGI» não serve. A ISO 9001 (7.5.3.2) pede que documentos externos necessários ao SGI sejam identificados e controlados. Proposta: rótulo «Documento externo», com origem, versão ou data e data da próxima verificação de atualização (normas e legislação mudam).
- Item 6: GRD fica para depois da Fase 1; na Fase 1, impressão com marca «cópia não controlada» e registro de quem imprimiu.
- Item 7, micro-quiz: depois da publicação, quem é do público do documento confirma a leitura (ciência). O micro-quiz são uma a três perguntas de múltipla escolha sobre o que mudou, escritas por quem publica; errar mostra o trecho certo e deixa tentar de novo; o resultado vira evidência de conscientização (ISO 9001 7.3). Proposta: Fase 1 só com «Li e entendi»; quiz depois.

## 4. Tipo «Compliance» na RNC

[Provável] Faz sentido só se a empresa tem gestão de compliance (ética, anticorrupção, ISO 37301 ou 37001). O descumprimento de lei ambiental ou de segurança já é Meio Ambiente ou Segurança nas normas 14001 e 45001, e com «Compliance» como tipo vai haver dúvida em qual classificar. Proposta: manter Qualidade, Segurança e Meio Ambiente; marcar à parte «envolve requisito legal» (sim/não); «Compliance» como tipo extra que a empresa liga se quiser (é lista configurável).

## 5. Fechamento (05/10/2026) [Decidido]

O Eric validou todas as propostas deste documento, com estas definições:

- **Prazos:** dias úteis para etapas curtas; dias corridos para prazos longos (reprogramação, eficácia, revisão periódica, intervalos). Cada tela mostra a contagem.
- **Plano de Ação:** abre em «Minhas ações»; «Todas» respeita a permissão; a ação herda a confidencialidade da origem. Kanban com «Vencida» como etiqueta e conclusão com a mesma confirmação de evidência.
- **Documentos:**
  - O último nível de aprovação é fixo: gestor da Qualidade e gestor da área.
  - Documento externo é controlado: origem, versão ou data, data da próxima verificação.
  - **O micro-quiz entra na Fase 1.**
  - GRD depois da Fase 1; na Fase 1, impressão com marca «cópia não controlada» e registro de quem imprimiu.
- **RNC:**
  - Tipos: Qualidade, Segurança, Meio Ambiente, mais a marcação «envolve requisito legal»; «Compliance» é tipo opcional que a empresa liga.
  - Causa raiz: só 5 Porquês, Ishikawa e texto livre; outra ferramenta vai como anexo e resumo no texto livre.
  - Origens: as seis do Eric mais **Fornecedor** e **Incidente**. «Análise crítica pela direção» não entrou.
  - Gravidade com critério escrito (proposta abaixo).

**Risco do micro-quiz na Fase 1 [Chutando]:** acrescenta cadastro de perguntas, tentativas, resultado e relatório, algo como 20 a 30 h no método híbrido, no último módulo da fila. Se a revisão de 15/11 mostrar atraso, é o primeiro item a sair, ficando só a ciência «Li e entendi».

## 6. Critério de gravidade da RNC [Proposta, a validar pelo Eric]

| Nível | Critério (basta um) |
|---|---|
| Baixa | Desvio pontual, sem efeito no cliente, na segurança, no meio ambiente ou em requisito legal; corrigido no próprio processo |
| Média | Desvio repetido, ou que afeta produto ou serviço internamente sem chegar ao cliente; sem lesão nem dano ambiental |
| Alta | Chega ao cliente; ou descumpre requisito legal; ou tem potencial de lesão ou de dano ambiental; ou é constatação de auditoria externa |
| Crítica | Lesão grave ou fatalidade (real ou potencial); dano ambiental significativo; risco de multa, interdição ou perda da certificação; produto inseguro no cliente |

A empresa pode reescrever os critérios (é texto configurável); estes são o padrão.
