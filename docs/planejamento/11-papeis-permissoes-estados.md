# Papéis, permissões e estados da Fase 1

**Estado:** validado pelo Eric em 05/10/2026, salvo o que estiver marcado **[Proposta]**. Base: docs 08, 09 e 10.
**Para que serve:** é a regra que o código segue. O que não estiver aqui, o agente que escrever o código não pode inventar: pergunta ao Eric.

## 1. Papéis (fixos na Fase 1)

Uma pessoa pode ter mais de um papel. O administrador atribui os papéis. Papéis personalizados ficam para depois da Fase 1.

| Papel | Para quem | Resumo |
|---|---|---|
| Administrador | TI ou responsável pelo sistema na empresa | Configura: usuários, papéis, áreas, unidades, listas, feriados, parâmetros, glossário. **Não vê conteúdo confidencial só por ser administrador** |
| Diretoria | CEO, COO, CFO e demais diretores | Vê todas as áreas; edita com as mesmas permissões da Qualidade; não configura o sistema |
| Gestor da Qualidade | Coordenação ou gerência do SGI | Aprova, define tratador, vê tudo do SGI, inclusive confidencial |
| Qualidade | Analistas do SGI | Elabora documentos, trata RNC, acompanha ações |
| Gestor de área | Gestores das áreas | Aprova o que é da sua área, recebe avisos da área, vê as ações da área |
| Usuário | Todos | Executa as próprias ações, consulta documentos, dá ciência e faz o micro-quiz |

**Regras dos papéis:**
- **Diretoria [Decidido]:** nas matrizes do §3, tem as permissões da coluna Qualidade e a visão de todas as áreas. **[Proposta do Claude]** Não vê o nível Confidencial, salvo se nomeada no registro: uma denúncia que envolve um diretor não pode ficar visível a ele.
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
| Criar ação manual | — | ✓ | ✓ | — | — |
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
| Obsoleto | Qualidade (padrão); a empresa pode liberar a consulta para todos | (fim) |
| Cancelado (nunca publicado) | Qualidade | (fim) |
| Externo | Todos | Externo com verificação vencida (marcador), Obsoleto |

Regra: a versão em revisão nunca substitui a vigente antes da aprovação final.

## 5. Casos de borda

1. **Pessoa que sai da empresa [Decidido]:**
   - Ao inativar, o sistema avisa se ela tem ações pendentes e mostra um link para a lista dessas ações, já filtrada.
   - Na confirmação, o sistema avisa que as ações pendentes passam para o gestor da área dela.
   - Se a pessoa é o próprio gestor da área, o sistema não reatribui: só inativa o login, e a Qualidade é avisada para redistribuir.
   - As aprovações pendentes dela vão para outro Gestor da Qualidade (ou o administrador reatribui, se não houver).
   - **[Proposta do Claude] Usuário nunca é apagado do banco:** «excluir» na tela significa inativar. Apagar quebraria o histórico, que é só de inclusão e é evidência de auditoria. Pedido de exclusão pela LGPD é atendido anonimizando nome e e-mail, sem apagar os registros.
2. **Gestor da Qualidade único pede reprogramação [Decidido]:** aprova o próprio pedido; o sistema registra «sem segregação».
3. **Gestor de área do documento não existe** (área sem gestor): o último nível fica só com o Gestor da Qualidade, e o histórico registra o motivo.
4. **Mudança de área de uma pessoa:** as ações abertas continuam com ela; a visão «área» do novo gestor passa a incluí-las.
5. **Administrador também é Gestor da Qualidade:** vale a soma dos papéis; o bloqueio de confidencial do §1 é só para quem é apenas administrador.

## 6. Respostas do Eric (05/10/2026) [Decidido]

1. O administrador não vê conteúdo confidencial.
2. Só a Qualidade cria ação manual (e a Diretoria, que edita como a Qualidade).
3. Documentos obsoletos: só a Qualidade consulta por padrão; a empresa pode liberar.
