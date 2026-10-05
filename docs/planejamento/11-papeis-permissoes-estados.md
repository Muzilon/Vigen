# Papéis, permissões e estados da Fase 1

**Estado:** rascunho de 05/10/2026. Tudo é **[Proposta]** do Claude até o Eric validar. Base: docs 08, 09 e 10.
**Para que serve:** é a regra que o código segue. O que não estiver aqui, o agente que escrever o código não pode inventar: pergunta ao Eric.

## 1. Papéis (fixos na Fase 1)

Uma pessoa pode ter mais de um papel. O administrador atribui os papéis. Papéis personalizados ficam para depois da Fase 1.

| Papel | Para quem | Resumo |
|---|---|---|
| Administrador | TI ou responsável pelo sistema na empresa | Configura: usuários, papéis, áreas, unidades, listas, feriados, parâmetros, glossário. **Não vê conteúdo confidencial só por ser administrador** |
| Gestor da Qualidade | Coordenação ou gerência do SGI | Aprova, define tratador, vê tudo do SGI, inclusive confidencial |
| Qualidade | Analistas do SGI | Elabora documentos, trata RNC, acompanha ações |
| Gestor de área | Gestores das áreas | Aprova o que é da sua área, recebe avisos da área, vê as ações da área |
| Usuário | Todos | Executa as próprias ações, consulta documentos, dá ciência e faz o micro-quiz |

**Regras dos papéis:**
- A empresa precisa ter pelo menos um Gestor da Qualidade. O sistema bloqueia remover o último.
- Gestor de área vale para a área (ou áreas) que o administrador indicar, não para a empresa toda.
- **Permissão extra «Pode registrar RNC»:** o administrador liga por pessoa. Vem ligada para Qualidade, Gestor da Qualidade e Gestor de área.

## 2. Confidencialidade

| Nível | Quem vê | Exemplo |
|---|---|---|
| Interno (padrão) | Todos da empresa | Ação de melhoria comum |
| Restrito | Envolvidos (responsável, participantes, gestor da área), Qualidade e Gestor da Qualidade | RNC de reclamação de cliente |
| Confidencial | Só as pessoas nomeadas no registro e o Gestor da Qualidade | Compliance, assédio, incidente com dado de saúde |

- Ações herdam o nível da origem. O nível só pode subir na ação, nunca baixar.
- Quem pode mudar o nível: Gestor da Qualidade. Fica no histórico.
- Busca, listas, contadores, notificações e exportações respeitam o nível. Um registro confidencial não aparece nem como contagem para quem não pode vê-lo.

## 3. Matriz de permissões

Legenda: ✓ pode; **área** = só da própria área; **próprio** = só o que é dele; **env.** = só se for envolvido; — não pode.

### 3.1 Plano de Ação

| Ação | Adm. | Gestor Qual. | Qualidade | Gestor área | Usuário |
|---|---|---|---|---|---|
| Ver «Minhas ações» | próprio | ✓ | ✓ | ✓ | ✓ |
| Ver «Todas» (respeitando confidencialidade) | — | ✓ | ✓ | área | — |
| Criar ação manual | — | ✓ | ✓ | área | — |
| Trocar responsável | — | ✓ | ✓ | — | — |
| Atualizar andamento e anexar evidência | — | ✓ | ✓ | próprio | próprio |
| Pedir reprogramação | — | ✓ | ✓ | área | próprio |
| Aprovar reprogramação | — | ✓ (nunca a própria se houver outro) | — | — | — |
| Concluir (com ou sem evidência) | — | ✓ | ✓ | próprio | próprio |
| Verificar eficácia da ação | — | ✓ | ✓ | — | — |
| Cancelar (com justificativa) | — | ✓ | — | — | — |

### 3.2 RNC

| Ação | Adm. | Gestor Qual. | Qualidade | Gestor área | Usuário |
|---|---|---|---|---|---|
| Registrar | — | ✓ | ✓ | ✓ | se tiver a permissão extra |
| Ver | — | ✓ | ✓ | env. ou área | env. |
| Definir tratador | — | ✓ | — | — | — |
| Assumir tratamento (sem tratador definido) | — | ✓ | ✓ | — | — |
| Análise crítica (elaborar e decidir) | — | ✓ | tratador | — | — |
| Incluir participantes da análise | — | ✓ | tratador | — | — |
| Causa raiz e plano de ações | — | ✓ | tratador | — | — |
| Programar avaliação de eficácia | — | ✓ | tratador | — | — |
| Avaliar eficácia da RNC | — | ✓ | ✓ (com permissão de tratar) | — | — |
| Cancelar (com justificativa) | — | ✓ | — | — | — |

### 3.3 Documentos

| Ação | Adm. | Gestor Qual. | Qualidade | Gestor área | Usuário |
|---|---|---|---|---|---|
| Ver lista mestra (só ativos e externos) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver «Em elaboração» e «Em tramitação» | — | ✓ | ✓ | — | — |
| Criar documento e iniciar revisão | — | ✓ | ✓ | — | — |
| Escolher revisores e aprovadores (até 4 níveis) | — | ✓ | ✓ | — | — |
| Aprovar (nível escolhido) | — | se escolhido | se escolhido | se escolhido | se escolhido |
| Aprovar último nível (fixo) | — | ✓ | — | ✓ (da área do documento) | — |
| Publicar | — | ✓ | ✓ | — | — |
| Escrever perguntas do micro-quiz | — | ✓ | ✓ | — | — |
| Dar ciência e responder o quiz | — | ✓ | ✓ | ✓ | ✓ (se do público) |
| Pedir obsolescência ou cancelamento | — | ✓ | ✓ | — | — |
| Cadastrar documento externo | — | ✓ | ✓ | — | — |
| Imprimir (marca «cópia não controlada», registrado) | ✓ | ✓ | ✓ | ✓ | ✓ |

## 4. Estados

### 4.1 Plano de Ação

| Estado | Quem vê | Sai para |
|---|---|---|
| Pendente | conforme §3.1 | Em andamento, Cancelada |
| Em andamento | conforme §3.1 | Concluída, Cancelada |
| Concluída | conforme §3.1 | (fim; ou Em andamento, se a eficácia da ação reprovar) |
| Cancelada | conforme §3.1 | (fim) |

Marcadores que não são estado: «Vencida» (calculado), «Reprogramação em aprovação», «Concluída sem evidência», «Eficácia pendente».

### 4.2 RNC

| Estado | Sai para |
|---|---|
| Registrada | Em análise crítica, Cancelada |
| Em análise crítica | Improcedente; Encerrada com correção; Em tratamento |
| Em tratamento (causa raiz e plano) | Ações em andamento |
| Ações em andamento | Aguardando eficácia (quando a última ação conclui e a data é programada) |
| Aguardando eficácia | Encerrada eficaz; Em tratamento (não eficaz: novo ciclo, histórico guarda o anterior) |
| Improcedente, Encerrada com correção, Encerrada eficaz, Cancelada | (fim) |

### 4.3 Documentos

| Estado | Quem vê | Sai para |
|---|---|---|
| Em elaboração (documento novo) | Qualidade e Gestor da Qualidade | Em tramitação, Cancelado |
| Em tramitação | Qualidade e Gestor da Qualidade | Ativo (aprovado e publicado); Em elaboração (reprovado, volta com motivo) |
| Ativo | Todos | Obsoleto (pela tramitação) |
| Ativo + revisão em tramitação | Todos veem «Ativo» e a versão vigente; Qualidade vê também a revisão | A revisão aprovada vira a nova versão ativa; a anterior vira Obsoleta |
| Obsoleto | Qualidade (todos, se a empresa quiser consulta histórica) | (fim) |
| Cancelado (nunca publicado) | Qualidade | (fim) |
| Externo | Todos | Externo com verificação vencida (marcador), Obsoleto |

Regra: a versão em revisão nunca substitui a vigente antes da aprovação final.

## 5. Casos de borda

1. **Pessoa desativada** (saiu da empresa): as ações dela ficam «sem responsável» e a Qualidade é avisada. As aprovações pendentes dela vão para outro Gestor da Qualidade (ou para o administrador reatribuir, se não houver). O histórico mantém o nome.
2. **Gestor da Qualidade único pede reprogramação:** aprova o próprio pedido; o histórico marca «sem segregação».
3. **Gestor de área do documento não existe** (área sem gestor): o último nível fica só com o Gestor da Qualidade, e o histórico registra o motivo.
4. **Mudança de área de uma pessoa:** as ações abertas continuam com ela; a visão «área» do novo gestor passa a incluí-las.
5. **Administrador também é Gestor da Qualidade:** vale a soma dos papéis; o bloqueio de confidencial do §1 é só para quem é apenas administrador.

## 6. Perguntas ao Eric

1. O administrador não ver conteúdo confidencial está certo? (Comum em sistemas sérios; protege contra o TI curioso.)
2. Gestor de área pode criar ação manual na sua área, ou só a Qualidade?
3. Obsoletos: só a Qualidade consulta, ou todos podem ver o histórico?
