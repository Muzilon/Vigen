# Avisos e ligações entre módulos da Fase 1

**Estado:** validado pelo Eric em 05/10/2026. Base: docs 09, 10 e 11.

## 1. Regras gerais dos avisos

- **Canais:** S = sino no sistema; E = e-mail. Tudo vai para o sino; e-mail só quando pede ação ou tem prazo.
- **E-mail sem conteúdo:** traz só tipo, código, prazo e link. Nunca a descrição (protege confidencial e dados pessoais). **Etapa futura:** desenhar o modelo visual do e-mail informativo (junto com o design do Figma).
- **Preferências:** a pessoa pode desligar avisos só de sino; os de e-mail com prazo não podem ser desligados.
- **Sem repetição diária:** atraso avisa no dia; depois entra num resumo semanal por e-mail.
- **Confidencialidade:** quem não vê o registro não recebe aviso dele, nem como contagem.

## 2. Catálogo de avisos

### Plano de Ação

| Quando | Quem recebe | Canal |
|---|---|---|
| Ação atribuída | Responsável | S+E |
| Responsável trocado | Anterior e novo | S+E |
| Faltam 5 dias úteis para o prazo | Responsável | S+E |
| Ação vencida | Responsável, Qualidade, gestor da área | S+E |
| Pedido de reprogramação | Aprovador | S+E |
| Reprogramação aprovada ou recusada | Quem pediu | S+E |
| Concluída sem evidência | Qualidade | S |
| Ação de uma RNC concluída ou reprogramada | Tratador da RNC | S |

### RNC

| Quando | Quem recebe | Canal |
|---|---|---|
| RNC registrada | Gestor da Qualidade | S+E |
| Tratador definido ou assumido | Tratador (e Gestor da Qualidade, se assumida) | S+E |
| Incluído como participante | Participante | S |
| Decidida improcedente | Quem registrou | S+E |
| Última ação encerrada | Tratador: programar eficácia | S+E |
| Faltam 7 dias para a avaliação de eficácia | Tratador | S+E |
| Avaliação de eficácia vencida | Tratador e Gestor da Qualidade | S+E |
| RNC encerrada | Quem registrou e gestor da área | S |

### Documentos

| Quando | Quem recebe | Canal |
|---|---|---|
| Solicitação de documento recebida | Qualidade | S+E |
| Solicitação aceita ou recusada | Quem pediu | S+E |
| Enviado para revisão ou aprovação | Revisor ou aprovador do nível | S+E |
| Reprovado | Quem elaborou | S+E |
| Etapa da tramitação atrasada | Responsável da etapa e Qualidade | S+E |
| Publicado | Público do documento (ciência e micro-quiz) | S+E |
| Ciência pendente há 7 dias | Pessoa (S); Qualidade no resumo semanal | S |
| Revisão periódica vence em 30 dias | Qualidade | S+E |
| Documento externo com verificação vencida | Qualidade | S |
| Documento tornado obsoleto | Público do documento | S |

### Usuários

| Quando | Quem recebe | Canal |
|---|---|---|
| Pessoa inativada com pendências | Qualidade | S+E |
| Aprovações reatribuídas | Novo aprovador | S+E |

## 3. Ligações entre módulos

| # | Quando | O sistema faz |
|---|---|---|
| 1 | RNC cria uma ação | A ação herda origem, área e confidencialidade; as duas ficam ligadas, com link nos dois sentidos |
| 2 | Todas as ações da RNC encerradas (concluídas ou canceladas) | Avisa o tratador para programar a eficácia. Se todas foram canceladas, o tratador justifica antes de programar |
| 3 | RNC cancelada com ações abertas | A confirmação lista as ações; as abertas são canceladas junto, com o motivo «RNC vinculada cancelada» e o link para a RNC (onde está a justificativa); as concluídas ficam |
| 4 | RNC não eficaz | Abre novo ciclo; as ações do ciclo anterior continuam ligadas a ele, no histórico |
| 5 | Confidencialidade da RNC sobe | As ações dela sobem junto |
| 6 | RNC ou ação aponta um documento afetado | Só o link na Fase 1, sem automação. Quando a nova versão desse documento é publicada, o responsável da ação ligada é avisado para concluir |
| 7 | Documento ligado a ação aberta vira obsoleto | Avisa a Qualidade |
| 8 | Origens Auditoria, Inspeção e Indicador | Na Fase 1 são só valores de lista na RNC, sem ligação, porque esses módulos não existem ainda |

## 4. Respostas do Eric (05/10/2026) [Decidido]

1. Aviso de prazo: 5 dias úteis antes.
2. E-mail sem descrição, por enquanto; o design do e-mail informativo entra como etapa.
3. Cancelar a RNC cancela as ações abertas, com o motivo «RNC vinculada cancelada».
