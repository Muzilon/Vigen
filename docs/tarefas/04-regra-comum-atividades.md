# 04 - Regra comum de «atividades» (tarefas que caem na aba Aprovações)

Status: especificação (nada implementado). Data: 2026-10-03. Usada primeiro pelo fluxo do Mapa de Processos ([05-mapa-de-processos-fluxo.md](05-mapa-de-processos-fluxo.md)); pensada para qualquer módulo.

## Objetivo

Uma «atividade» é uma tarefa criada **pelo sistema** para um grupo de pessoas que têm uma permissão. Uma delas «assume»; as demais veem «em execução por [responsável]». Quem assumiu pode devolver a outra pessoa, que confirma ou recusa. Tem prazo em dias úteis; vencido o prazo, a Qualidade é avisada e o item vai à máxima urgência. Tudo fica registrado no log de aprovações.

## Situação atual no código

Existe e será reaproveitado:
- Motor de aprovação multi-assinante: `src/lib/aprovacao/` (`servico.ts`, `registry.ts`, `handlers.ts`), modelos `FluxoAprovacao`, `EtapaAprovacao`, `HistoricoAprovacao` em `prisma/schema.prisma`. O `HistoricoAprovacao` é append-only (trigger) e é o «log de aprovações».
- Aba Aprovações: `src/app/(app)/aprovacoes/` (`page.tsx`, `actions.ts`, `[id]`, `@modal`); lista só fluxos (`listarAguardandoMim`, `listarSolicitadasPorMim`).
- Notificações: `src/lib/notificacoes/` (`servico.ts` com `criarNotificacoes` e chave de idempotência `@@unique([empresaId, chaveIdempotencia])`, `gatilhos.ts`, `cron.ts` com `executarCronDiario`, `destinatarios.ts`).
- Datas: `src/lib/datas.ts` (`hojeNoFuso`, `dataIso`, `paraDataDb`, `somarDias`).
- Configuração por empresa: `Empresa.config` (Json) e `src/lib/admin/servico.ts`; permissões em `src/lib/permissoes.ts` (`TODAS_PERMISSOES`, enum `Permissao`).

Não existe, é novo: entidade de atividade/tarefa de sistema; assumir/devolver; calendário de feriados; contagem de dias úteis; urgência máxima; exibição de itens que não são fluxos na aba Aprovações. O `HistoricoAprovacao` hoje exige `fluxoId` (não aceita evento de atividade) e a enum `AcaoHistoricoAprovacao` só tem SOLICITADO/APROVADO/REJEITADO/CANCELADO/CONCLUIDO.

## O que é novo

1. Modelo `Atividade` + serviço `src/lib/atividades/` (criar, assumir, devolver, aceitar, recusar, concluir, cancelar, vencer).
2. Calendário de feriados por empresa (Configurações) e função de dias úteis.
3. Registro no log de aprovações dos eventos de atividade.
4. Cron de vencimento e notificações de atividade.
5. Futuro (fora do escopo agora): a aba Aprovações exibirá atividades numa nova visualização. Agora, a atividade aparece no contador e numa lista simples de «Atividades» (ver Telas).

## Dados

Migração aditiva (sem `migrate dev`, sem apagar dados; guia §7 passo 2).

**Enums novos:** `StatusAtividade` (ABERTA, ASSUMIDA, DEVOLUCAO_PENDENTE, CONCLUIDA, CANCELADA); `TipoAtividade` (um valor por uso; no 05: PUBLICAR_MAPA, VERIFICAR_REVISAO_MAPA); `TipoEntidadeAtividade` (começa com MAPA_PROCESSO).

**`Atividade`** (`atividade`): `id`, `empresaId`, `tipo`, `entidadeTipo`, `entidadeId`, `titulo` (texto gerado pelo sistema, nunca texto livre de registro restrito), `permissaoAlvo` (`Permissao`: quem pode assumir), `status`, `responsavelId?`, `devolvidoParaId?`, `prazoDiasUteis`, `prazoEm` (Date), `vencidaEm?`, `urgenciaMaxima` (bool, padrão false), `chaveOrigem` (idempotência de criação), `resultado` (Json?), `versao` (trava otimista), `criadoEm`, `assumidaEm?`, `concluidaEm?`.
- `@@unique([empresaId, id])`, `@@unique([empresaId, chaveOrigem])`, índices `[empresaId, status, prazoEm]` e `[empresaId, responsavelId, status]`.
- FKs compostas `(empresaId, responsavelId) -> Usuario(empresaId, id)` e idem `devolvidoParaId`; `onDelete: Restrict`; sem exclusão (cancelar = status). Em `create`, nunca `empresa: { connect }`.
- CHECKs na seção «Regras SQL» da migração: `status = 'ASSUMIDA'` exige `responsavelId`; `status = 'DEVOLUCAO_PENDENTE'` exige `responsavelId` e `devolvidoParaId`; `devolvidoParaId <> responsavelId`; `prazoDiasUteis > 0`.

**`FeriadoEmpresa`** (`feriado_empresa`): `id`, `empresaId`, `data` (Date), `descricao`, `criadoPorId`, `criadoEm`; `@@unique([empresaId, data])`. Decisão: tabela e não JSON em `Empresa.config`, para ter unicidade e histórico por linha. Sábado e domingo nunca são dia útil (sem cadastro).

**Log:** alterar `HistoricoAprovacao` (aditivo): `fluxoId` passa a opcional, nova coluna `atividadeId?` com FK composta, e CHECK `num_nonnulls(fluxo_id, atividade_id) = 1`. Valores novos em `AcaoHistoricoAprovacao` (`ALTER TYPE ... ADD VALUE`): ATIVIDADE_CRIADA, ATIVIDADE_ASSUMIDA, ATIVIDADE_DEVOLVIDA, ATIVIDADE_ACEITA, ATIVIDADE_RECUSADA, ATIVIDADE_CONCLUIDA, ATIVIDADE_VENCIDA, ATIVIDADE_CANCELADA. `metadados` guarda de/para (ids), nunca texto sensível. O trigger append-only continua valendo; conferir se a relação `fluxo` e as consultas existentes (`obterFluxo`) toleram `fluxoId` nulo.

## Regras de negócio e estados

Dias úteis: `somarDiasUteis(inicioIso, n, feriados: Set<string>)` e `diasUteisEntre(...)` em `src/lib/datas.ts` (puras, testadas por vitest); o serviço carrega os feriados da empresa. `prazoEm` = criação + N dias úteis (dia da criação não conta), calculado na criação e gravado.

| Estado | Quem pode agir | Ação | Próximo estado |
|---|---|---|---|
| (nada) | sistema | cria a atividade (idempotente pela `chaveOrigem`) | ABERTA |
| ABERTA | quem tem `permissaoAlvo` | «Assumir atividade» | ASSUMIDA (`responsavelId` = quem clicou) |
| ASSUMIDA | só o responsável | «Devolver», informando o novo responsável (tem de ter `permissaoAlvo`, ser outra pessoa) | DEVOLUCAO_PENDENTE |
| DEVOLUCAO_PENDENTE | só `devolvidoParaId` | Confirmar | ASSUMIDA (responsável = novo) |
| DEVOLUCAO_PENDENTE | só `devolvidoParaId` | Recusar | ASSUMIDA com o responsável anterior (volta a quem devolveu) |
| ABERTA ou ASSUMIDA | responsável (ou o handler do módulo) | concluir (via ação do módulo, ex.: publicar) | CONCLUIDA |
| qualquer aberta | handler do módulo / sistema | cancelar (ex.: mapa foi cancelado) | CANCELADA |

Demais regras:
- Enquanto ASSUMIDA, os demais veem «em execução por [nome]» e não podem assumir. Em DEVOLUCAO_PENDENTE o item mostra «devolvida para [nome], aguardando confirmação»; o responsável original segue dono até a confirmação.
- Assumir usa trava otimista: `updateMany({ where: { id, versao, status: 'ABERTA' } })`; `count === 0` => `ErroConflito` (dois cliques simultâneos: um vence).
- Toda transição grava um `HistoricoAprovacao` na mesma `$transaction`.
- Vencimento: no cron diário, atividade ABERTA/ASSUMIDA/DEVOLUCAO_PENDENTE com `prazoEm < hoje` e `vencidaEm` nulo recebe `vencidaEm`, `urgenciaMaxima = true`, log ATIVIDADE_VENCIDA e aviso a todos os usuários da Qualidade (quem tem `ATIVIDADE_ACOMPANHAR`). O vencimento não muda o estado nem o responsável.
- Serviços recebem `Ator`, exigem módulo e permissão, revalidam a entrada (a ação não é confiável) e não usam `getContexto()`.

## Permissões novas

- `ATIVIDADE_ACOMPANHAR`: perfil «Qualidade»; recebe o aviso de prazo vencido e vê todas as atividades da empresa.
- A permissão de assumir é a `permissaoAlvo` de cada atividade (definida pelo módulo; no 05 são `PROCESSO_PUBLICAR` e `PROCESSO_VERIFICAR_REVISAO`).
- Feriados: reutiliza `ADMIN_CONFIG`.
Cada valor: enum `Permissao` (`ALTER TYPE ... ADD VALUE`), `TODAS_PERMISSOES`, perfil no seed e rótulo em Configurações.

## Notificações

Tipos novos em `TipoNotificacao`: `ATIVIDADE_NOVA` (a todos com `permissaoAlvo`), `ATIVIDADE_DEVOLVIDA` (ao novo responsável), `ATIVIDADE_DEVOLUCAO_RECUSADA` (a quem devolveu), `ATIVIDADE_VENCIDA` (à Qualidade). `TipoEntidadeNotificacao` ganha `ATIVIDADE`. Chaves determinísticas:
- `atividade-nova:{atividadeId}:{usuarioId}`
- `atividade-devolvida:{atividadeId}:{nDevolucao}:{usuarioId}` (`nDevolucao` = contagem de logs ATIVIDADE_DEVOLVIDA)
- `atividade-recusada:{atividadeId}:{nDevolucao}:{usuarioId}`
- `atividade-vencida:{atividadeId}:{usuarioId}`
Título e corpo só com texto gerado pelo sistema (tipo da atividade + código do registro); nada de texto livre. Disparo após o commit, com `comSeguranca`.

## Gatilhos e cron

- Criação: chamada explícita do serviço do módulo (ex.: handler de aprovação) dentro da transação; notificação após o commit.
- Vencimento: nova função `src/lib/atividades/cron.ts` com import em `src/lib/notificacoes/cron.ts` (`executarCronDiario`). Esquecer o import deixa a função morta em silêncio; incluir teste que confira.
- Idempotente: rodar duas vezes não duplica (filtro `vencidaEm` nulo + chave de notificação).

## Telas (apenas listar; desenho com o agente-ux-ui)

- Aba Aprovações: bloco/lista «Atividades» (versão simples); selo de urgência máxima; contador de pendentes inclui atividades para o usuário.
- Cartão da atividade: título, prazo, estado, «Assumir atividade», «Devolver», «Confirmar/Recusar», «em execução por [nome]».
- Configurações: cadastro de feriados (lista com data e descrição, adicionar/remover).
- Linha do tempo da atividade (leitura do log).
- Futuro: nova visualização de atividades na aba Aprovações.

## Testes e critérios de aceite

- vitest: `somarDiasUteis` (fim de semana, feriado, virada de mês, 0 feriados, feriado em sábado); transições da máquina de estados.
- `scripts/teste-atividades.ts` (nomes com sufixo aleatório, roda de novo sem quebrar): criar duas vezes com a mesma `chaveOrigem` gera uma só; dois assumirem ao mesmo tempo, um recebe `ErroConflito`; quem não tem a permissão não assume; só o responsável devolve; só o destinatário confirma/recusa; recusa volta ao anterior; cada transição gera um log; UPDATE/DELETE no log é bloqueado pelo trigger; cron marca vencida uma vez só e avisa a Qualidade (e só ela).
- Isolamento: empresa Demo não vê atividade, feriado nem log de outra empresa (`npm run test:isolamento` estendido); FK composta impede responsável de outra empresa.
- Critério: com feriado cadastrado, o prazo pula o dia; a migração não altera linhas existentes de `historico_aprovacao`.
- Antes de entregar: `npx tsc --noEmit -p .`, `npm run lint`, `npm test`, `npm run test:atividades`, `npm run test:isolamento`.

## Fatias de implementação (em ordem)

1. Feriados + dias úteis (modelo, tela em Configurações, funções puras e vitest): agente-arquitetura-dados (modelo/serviço), agente-ux-ui (tela).
2. Modelo `Atividade`, ajuste do `HistoricoAprovacao`, permissão `ATIVIDADE_ACOMPANHAR`, serviço e testes: agente-arquitetura-dados.
3. Notificações e cron de vencimento: agente-notificacoes.
4. Telas na aba Aprovações e cartão da atividade: agente-ux-ui, depois agente-responsivo.
5. Revisão de isolamento e do log: agente-qa-revisao.

## Riscos

- Tornar `fluxoId` opcional pode quebrar consultas e tipos do motor atual; cobrir com testes antes de migrar.
- Usuário sem ninguém com a `permissaoAlvo`: a atividade nasce sem destinatário; avisar a Qualidade na criação.
- Dois cliques/devoluções simultâneas: depende da trava por `versao`.
- Fuso: `prazoEm` é data civil no fuso da empresa (`hojeNoFuso`), nunca `toISOString().slice(0,10)`.
- Falta de feriados cadastrados deixa o prazo curto demais; mostrar aviso em Configurações se o ano corrente não tiver nenhum feriado.

## Perguntas bloqueantes ao Eric

Nenhuma.
