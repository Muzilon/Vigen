# 05 - Mapa de Processos: fluxo de demanda, elaboração, aprovação, publicação e verificação

Status: especificação (nada implementado). Data: 2026-10-03. Fluxo validado pelo Eric em 03/10/2026. Depende da regra comum [04-regra-comum-atividades.md](04-regra-comum-atividades.md) (atividade, assumir, devolver, dias úteis, vencimento).

Decisões do Eric em 03/10/2026 (respondem as duas perguntas bloqueantes anteriores):
1. Hierarquia Empresa -> Unidades -> Áreas; **cada área tem o seu mapa** (um mapa por área, não por empresa).
2. **Separar rascunho e vigente: SIM.** O mapa em elaboração/revisão não aparece na visão normal do módulo; é acessado pela tramitação ou pela aba «Mapas em revisão» dentro do módulo (padrão de abas do módulo Treinamentos).
3. `Setor` é a «Área». Na interface (textos, rótulos, títulos de aba e telas) diz-se sempre «Área»; no código e no schema continuam o modelo `Setor` e os campos `setorId` (mesma convenção de «Unidade» na interface e `obra` no código).
4. Os `Processo` já cadastrados vão para uma Área provisória «Geral» (ver «Migração dos processos já cadastrados»); o Eric gerará dados de exemplo depois, com agentes novos.

Decisão opcional do Eric (não decidida): NÃO propomos renomear o modelo `Setor` para `Area` no banco. O modelo é usado em cerca de 39 arquivos de `src/` e em várias tabelas (RNC, Documento, Inspeção, Incidente, Usuário) e a renomeação exigiria migração e testes em todos os módulos, com risco de quebra silenciosa e nenhum ganho para o usuário, já que a interface é o que muda.

## Objetivo

Substituir a edição/publicação livre do mapa por um fluxo controlado, com três raias (Área, Qualidade, Aprovadores): demanda registrada, elaboração/revisão com a área, aprovação de todos os aprovadores, publicação por atividade assumida, e verificação periódica ou por gatilho (12 meses desde a publicação, ou revisão de documento/LAIA/Perigos e Riscos vinculado).

## Situação atual no código

Existe:
- Cadastro do mapa: `Processo` (linha do mapa: código, nome, tipo GESTAO/FINALISTICO/APOIO, dono, SIPOC; `versao` = última versão publicada; `revisao` = trava otimista de edição), `IndicadorProcesso`, `InteracaoProcesso`, `VersaoProcesso` (snapshot Json append-only, único por `[empresaId, processoId, versao]`) em `prisma/schema.prisma`.
- Serviço: `src/lib/processos/servico.ts` (`criarProcesso`, `editarProcesso`, `publicarNaTransacao` que congela `VersaoProcesso` e incrementa `versao`, `publicarVersao` direta, `solicitarPublicacao` via motor), `src/lib/processos/regras.ts` (`montarSnapshot` etc.), handler `src/lib/processos/aprovacao.ts` (tipo `PROCESSO`, alteração PUBLICACAO), registrado em `src/lib/aprovacao/handlers.ts` e `TIPOS_COM_HANDLER`.
- Motor de aprovação com modo `PARALELO` (todos recebem juntos, todos precisam aprovar): `src/lib/aprovacao/servico.ts` (`solicitarAprovacao`, `decidir`, `cancelar`), handler com `aoAprovar`/`aoRejeitar`/`aoCancelar`. Configuração por módulo em `Empresa.config.aprovacao.<modulo>` (`config-modulo.ts`).
- Tabela de decisões: `EtapaAprovacao` (aprovador, status, `decididoEm`, `comentario`; mutável; único por fluxo+aprovador) e `HistoricoAprovacao` (append-only por trigger: usuário, ação APROVADO/REJEITADO, `comentario`, `metadados`, `criadoEm`).
- Vínculos com o mapa: `processoId` em `Documento`, `LinhaHira`, `LinhaLaia`, `RiscoOportunidade` (FK composta com `Processo`). Publicação de documento em `src/lib/documentos/servico.ts` (hoje dispara `DOCUMENTO_PUBLICADO`/`CIENCIA_PENDENTE`).
- Notificações, cron e tipos: ver 04. Telas: `src/app/(app)/processos/`.
- Permissões atuais: `PROCESSO_GERENCIAR`, `ADMIN_CONFIG`, `HIRA_GERENCIAR`, `LAIA_GERENCIAR`, `DOCUMENTO_ELABORAR`.

- Hierarquia: `ObraUnidade` (unidade) e `Setor` (`prisma/schema.prisma`, ~linhas 476 e 506). Escopo por unidade: `obrasPermitidas`/`filtroObras`/`obraNoEscopo` em `src/lib/escopo-obras.ts` (reexportado por `src/lib/tenant.ts`); `VER_TODAS_OBRAS` libera tudo.
- Padrão de abas do módulo Treinamentos: `src/app/(app)/treinamentos/` com `layout.tsx` (`LayoutComJanela`, janela em `@modal`), `page.tsx` e subrotas irmãs `meus/`, `matriz/`, `auditoria/`.

Lacuna na hierarquia: `Setor` não tem ligação com `ObraUnidade` (só `empresaId`, `nome`, `ativo`; nome único por empresa). Hoje não existe "Área dentro de Unidade". Assumindo que `Setor` é a «Área» (a confirmar, pergunta 1), falta o vínculo `Setor.obraId` (novo, ver Dados).

Não existe, é novo:
- Uma entidade «mapa» (hoje só existem linhas `Processo` soltas, sem área nem unidade; "o mapa" é o conjunto delas). Estado do mapa, solicitação/demanda, ciclos de aprovação, estado «Para publicar», etiqueta «em revisão», rascunho versus vigente.
- Separar o que é publicado do que está em edição: hoje `editarProcesso` altera as linhas ao vivo, então a versão vigente seria sobrescrita durante a revisão.
- Importação de Excel: não há biblioteca de planilha em `package.json`.
- Verificação periódica, gatilho por publicação de documento/HIRA/LAIA, decisão «Precisa revisar o mapa?», «revisão complementar».
- Feriados, atividades (04).

## O que é novo

1. `MapaProcesso` (um por área), `RevisaoMapa` (revisão em andamento), `SolicitacaoMapa`, `RevisaoMapaArquivada`, `VersaoMapa`, `Setor.obraId`, `Processo.mapaId` e colunas em `HistoricoAprovacao`.
2. Tipo de aprovação `MAPA_PROCESSO` com handler próprio; aprovação não publica, leva a «Para publicar».
3. Duas atividades (`PUBLICAR_MAPA`, `VERIFICAR_REVISAO_MAPA`) usando a regra do 04.
4. Importação de Excel, aviso no painel de edição, etiqueta «em revisão».
5. Cron de 12 meses e gatilhos de documento/LAIA/Perigos e Riscos.

## Dados

Migração aditiva: só `CREATE TABLE`, `ADD COLUMN` anulável, `ADD VALUE` em enums; nada é apagado nem reescrito. Tudo com `empresaId`, `@@unique([empresaId, id])`, FKs compostas `(empresaId, xId) -> (empresaId, id)`, `onDelete: Restrict`, exclusão lógica (`ativo`), `criarDbTenant`; em `create`, nunca `empresa: { connect }`.

**Hierarquia e escopo:**
- `Setor` (= Área, confirmado) ganha `obraId?` (FK composta para `ObraUnidade`, anulável na migração, `onDelete: Restrict`), cadastrado em Configurações. Área sem unidade não pode ter mapa (validação no serviço). Troca de unidade de uma área com mapa é bloqueada (ou exige decisão separada).
- `MapaProcesso.obraId` é **copiado** da área ao criar o mapa (e mantido por serviço), para filtrar com `filtroObras` como RNC/HIRA/LAIA; CHECK/validação de que `obraId` = `setor.obraId`.
- Permissões respeitam o escopo: ler/editar/aprovar/assumir exige a permissão E `obraNoEscopo(ator, mapa.obraId)`; quem tem `VER_TODAS_OBRAS` enxerga todas as unidades. Destinatários de avisos são filtrados pelo mesmo escopo; a Qualidade «de toda a empresa» é quem tem `VER_TODAS_OBRAS` ou a unidade no escopo.

**Modelo vigente versus revisão em andamento (decisão 2):**
- **Vigente (imutável fora da publicação):** as linhas `Processo` (e `IndicadorProcesso`, `InteracaoProcesso`) ligadas ao mapa por `Processo.mapaId` continuam sendo o conteúdo vigente que Riscos, HIRA, LAIA, Documentos e Auditorias já leem (por isso seus vínculos `processoId` não mudam). Elas só mudam dentro da transação de publicação. A cópia congelada é `VersaoMapa` (snapshot append-only).
- **Revisão em andamento:** nova tabela `RevisaoMapa` com o rascunho (`conteudo` Json no mesmo formato de `montarSnapshot` em `src/lib/processos/regras.ts`), no máximo **uma aberta por mapa** (índice único parcial `WHERE fechada_em IS NULL`). Editar no site e importar Excel gravam aqui; nunca nas linhas `Processo`. Enquanto existir, a versão vigente segue valendo e ganha a etiqueta «em revisão».
- **Publicação:** em uma transação, aplica o `conteudo` aprovado às linhas `Processo` (cria as novas, atualiza por `codigo`, inativa as removidas), chama `publicarNaTransacao` por processo (mantendo `VersaoProcesso`), grava `VersaoMapa` e fecha a `RevisaoMapa`. Processo novo só passa a ter id (e a poder ser vinculado a risco/documento) depois de publicado.
- `editarProcesso`/`criarProcesso`/`moverProcesso` etc. de `src/lib/processos/servico.ts` deixam de editar mapa vigente diretamente (passam a operar no rascunho ou a ser bloqueados quando o processo pertence a mapa).

**`RevisaoMapa`:** `id`, `empresaId`, `mapaId`, `numero` (revisão do mapa, sequência), `tipo` (ELABORACAO, REVISAO), `conteudo` (Json), `numeroGravacao` (Int, +1 a cada gravação que arquiva a anterior), `versao` (trava otimista, `updateMany where versao`), `iniciadaPorId`, `iniciadaEm`, `fechadaEm?`, `desfecho?` (PUBLICADA, CANCELADA); `@@unique([empresaId, mapaId, numero])`.

**Enum `EstadoMapa`:** ELABORACAO_JUNTO_AREA, REVISAO_JUNTO_AREA, EM_APROVACAO, REPROVADO, PARA_PUBLICAR, VIGENTE.

**`MapaProcesso`:** `id`, `empresaId`, `setorId` (a área), `obraId` (unidade, derivada da área), `codigo` (único por empresa), `nome`, `estado`, `versaoVigente` (Int, 0 = nunca publicado; espelho do `VersaoMapa` mais recente), `cicloAtual` (Int, +1 a cada envio para aprovação), `reprovadoPorId?` (para «Reprovado por [nome]»), `ultimaPublicacaoEm?` (base dos 12 meses), `proximaVerificacaoEm?` (Date, = publicação + 12 meses), `versao` (trava otimista), `ativo`, `criadoEm`, `atualizadoEm`. **`@@unique([empresaId, setorId])`: um mapa por área** (a tela de criação oferece só áreas sem mapa); `@@index([empresaId, obraId, estado])`. Etiqueta «em revisão» não é coluna: é derivada (`versaoVigente > 0` e existe `RevisaoMapa` aberta).

**`Processo` (coluna nova):** `mapaId?` (FK composta; anulável por causa dos processos já cadastrados, que hoje não têm área). Carga inicial: os `Processo` existentes ficam sem mapa até o administrador/Qualidade atribuí-los a mapas de área por uma tela única de «Atribuir processos existentes» (pergunta 2). Após a carga, `mapaId` passa a ser obrigatório por regra de serviço.

**`SolicitacaoMapa`:** `id`, `empresaId`, `setorId` (área), `mapaId?` (nulo se mapa novo ainda não criado), `obraId`, `tipo` (ELABORACAO, REVISAO), `origem` (AREA_SISTEMA, AREA_EMAIL, AREA_PRESENCIAL, QUALIDADE), `solicitanteId?` (a área, se pediu pelo sistema), `registradaPorId`, `descricao` (texto livre curto; sem dados pessoais), `status` (REGISTRADA, EM_ANDAMENTO, ATENDIDA, CANCELADA), `versao`, `criadoEm`. Regra: origem AREA_SISTEMA é registrada pela própria área; as demais, pela Qualidade (CHECK: `origem = 'AREA_SISTEMA'` implica `solicitanteId = registradaPorId`).

**`RevisaoMapaArquivada`** (append-only por trigger; guarda cada `conteudo` substituído da `RevisaoMapa`): `id`, `empresaId`, `mapaId`, `revisaoMapaId`, `numero`, `snapshot` (Json do rascunho anterior), `origem` (MANUAL, IMPORTACAO_EXCEL), `arquivadoPorId`, `arquivadoEm`; `@@unique([empresaId, revisaoMapaId, numero])`.

**`VersaoMapa`** (append-only por trigger): `id`, `empresaId`, `mapaId`, `versao`, `snapshot` (todos os processos, indicadores e interações), `publicadoPorId`, `publicadoEm`, `fluxoAprovacaoId?`; `@@unique([empresaId, mapaId, versao])`. 

**Tabela de decisões (aprovação e reprovação): reaproveitar `HistoricoAprovacao`** em vez de criar outra. Já tem: aprovador (`usuarioId`), data (`criadoEm`), decisão (`acao` APROVADO/REJEITADO), observação (`comentario`), append-only por trigger, tipo de entidade pelo fluxo. Falta: (a) número do ciclo: `ciclo Int?`; (b) versão do mapa: `versaoEntidade Int?` (número do rascunho no momento da decisão); (c) obrigatoriedade da justificativa na reprovação: CHECK `acao <> 'REJEITADO' OR comentario IS NOT NULL` criado `NOT VALID` (não valida linhas antigas) mais validação no serviço; (d) o nome do valor é REJEITADO, e a tela mostra «Reprovado»/«REPROVADO». Cada envio cria um novo `FluxoAprovacao` (modo PARALELO), então o ciclo é a contagem de fluxos do mapa; gravar `ciclo` e `versaoEntidade` ao decidir. `EtapaAprovacao` continua sendo o estado operacional (quem ainda falta). Verificar em `decidir` se `comentario` já é exigido na rejeição; se não, exigir.

**Verificação:** nova tabela `VerificacaoMapa` (append-only): `id`, `empresaId`, `mapaId`, `atividadeId`, `origem` (PERIODICA_12_MESES, DOCUMENTO_PUBLICADO, LAIA_PUBLICADA, HIRA_PUBLICADA), `origemEntidadeId?`, `precisaRevisar` (bool), `tipoRegistro` (REVISAO_INICIADA ou REVISAO_COMPLEMENTAR), `observacao?`, `verificadaPorId`, `verificadaEm`. Revisão complementar NÃO altera `ultimaPublicacaoEm` nem `proximaVerificacaoEm`.

**Enums existentes a estender:** `TipoEntidadeAprovacao` (+MAPA_PROCESSO), `TipoEntidadeNotificacao` (+MAPA_PROCESSO), `TipoAtividade`/`TipoEntidadeAtividade` (04), `ModuloAnexo`/regra de anexo só se Excel for guardado (não será: lê e descarta).

**Excel:** biblioteca nova (sugestão `exceljs`; é dependência nova, registrar no relatório). Modelo de planilha de importação com as colunas do SIPOC. Importar substitui o `conteudo` da `RevisaoMapa` (arquiva o anterior em `RevisaoMapaArquivada`, origem IMPORTACAO_EXCEL); validar tamanho, linhas, tipos e código duplicado no servidor.

## Migração dos processos já cadastrados

A Área «Geral» é **provisória**: serve só para dar um mapa aos `Processo` existentes e pode ser reatribuída depois (o Eric vai gerar dados de exemplo com agentes novos). Script idempotente `scripts/migrar-processos-mapa.ts` (ou SQL na migração), usando `prismaAdmin` (só seed/cron/testes/migração), aditivo, sem apagar nem alterar linhas existentes além de preencher `Processo.mapaId` nulo.

Colunas auxiliares: `Setor.padrao Boolean @default(false)` (marca a Área padrão; índice único parcial: no máximo uma padrão por `empresaId` + `obraId`, tratando `obraId` nulo como um grupo próprio).

Ordem das etapas, por empresa:
1. Contagens antes: nº de `Processo` (total e com `mapaId` nulo), de `Setor`, de `MapaProcesso`, de `VersaoProcesso`; gravar no relatório.
2. Criar as colunas/tabelas novas (migração aditiva normal).
3. Área padrão: para cada unidade (`ObraUnidade`) da empresa, achar ou criar `Setor` «Geral» (`padrao = true`, `obraId` = unidade). Enquanto as Áreas antigas tiverem `obraId` nulo, criar uma única «Geral» por empresa com `obraId` nulo; ela só pode ter mapa depois de ligada a uma unidade, então, nesse caso, usar a primeira unidade da empresa (ou a única) para a «Geral» e registrar a escolha no relatório. Empresa sem nenhuma unidade: pular e listar no relatório.
4. Para cada Área «Geral», achar ou criar o `MapaProcesso` (`@@unique([empresaId, setorId])` garante um só), estado `VIGENTE`, `versaoVigente` = 1 se já houver `VersaoProcesso` publicada (senão `ELABORACAO_JUNTO_AREA` e `versaoVigente` 0), `ultimaPublicacaoEm` = maior `publicado_em` do `VersaoProcesso` da empresa (se houver), `proximaVerificacaoEm` = +12 meses dessa data. Quando houver publicação anterior, criar também um `VersaoMapa` 1 com o snapshot atual (idempotente por `[empresaId, mapaId, versao]`).
5. `UPDATE processo SET mapa_id = <mapa Geral> WHERE mapa_id IS NULL` (a empresa inteira vai para esse mapa; com várias unidades, usar o mapa da «Geral» escolhida na etapa 3).
6. Contagens depois e conferência.

Idempotência: cada etapa é «achar ou criar»; rodar de novo não duplica nem muda nada (o `UPDATE` só atinge `mapa_id` nulo).

Como conferir (por empresa, antes e depois): `Processo` total igual; `Processo` com `mapaId` nulo = 0; `MapaProcesso` = nº de Áreas «Geral» criadas; `VersaoProcesso` e `Setor` antigos inalterados (mesmas contagens, mais as «Geral»); nenhum `Processo` ligado a mapa de outra empresa (FK composta já impede, conferir por consulta). Teste em `scripts/teste-mapa-fluxo.ts`: rodar a migração duas vezes numa empresa de teste e comparar as contagens.

## Regras de negócio e estados

Estados do mapa (descrevem a `RevisaoMapa` aberta; a versão vigente, isto é, as linhas `Processo` + o último `VersaoMapa`, segue valendo até a publicação). Nos estados de edição, aprovação e «Para publicar» o mapa só aparece na aba «Mapas em revisão» e na tramitação, nunca na visão normal:

| Estado | Quem pode | Ação | Próximo estado |
|---|---|---|---|
| (sem mapa) | área (`MAPA_SOLICITAR`) ou Qualidade | registra `SolicitacaoMapa` | solicitação REGISTRADA |
| solicitação REGISTRADA | Qualidade (`MAPA_ELABORAR`) | iniciar elaboração (mapa novo) | ELABORACAO_JUNTO_AREA |
| VIGENTE | Qualidade (`MAPA_ELABORAR`) | iniciar revisão (solicitação ou decisão «Precisa revisar» = SIM) | REVISAO_JUNTO_AREA (vigente ganha «em revisão») |
| ELABORACAO_ ou REVISAO_JUNTO_AREA | Qualidade | editar no site ou importar Excel (cada gravação arquiva a anterior) | mesmo estado |
| ELABORACAO_ ou REVISAO_JUNTO_AREA | Qualidade | enviar para aprovação, definindo os aprovadores | EM_APROVACAO |
| EM_APROVACAO | cada aprovador | aprovar | EM_APROVACAO até o último |
| EM_APROVACAO | último aprovador | aprovar (todos aprovaram) | PARA_PUBLICAR + cria atividade PUBLICAR_MAPA |
| EM_APROVACAO | qualquer aprovador | reprovar com justificativa obrigatória | REPROVADO (mostra «Reprovado por [nome]»); aviso à Qualidade |
| REPROVADO | Qualidade | retomar edição (passo 2.2) | ELABORACAO_ ou REVISAO_JUNTO_AREA (conforme houver versão vigente) |
| EM_APROVACAO | Qualidade | cancelar o envio | volta ao estado de edição |
| PARA_PUBLICAR | quem assumiu a atividade (`PROCESSO_PUBLICAR`) | publicar (congela `VersaoMapa` e `VersaoProcesso`) | VIGENTE; `ultimaPublicacaoEm` = hoje; `proximaVerificacaoEm` = +12 meses |
| VIGENTE | sistema | 12 meses ou publicação vinculada | atividade VERIFICAR_REVISAO_MAPA (estado do mapa não muda) |
| VIGENTE | quem assumiu a verificação | «Precisa revisar o mapa?» SIM | REVISAO_JUNTO_AREA |
| VIGENTE | quem assumiu a verificação | NÃO | segue VIGENTE; registra «revisão complementar» |

Regras:
- Aprovação em PARALELO, todos precisam aprovar; o solicitante nunca aprova a si mesmo (regra do motor). A Qualidade define os aprovadores por mapa a cada envio (`aprovadorIds` do `solicitarAprovacao`; opcionalmente guardar a última lista como sugestão em `Empresa.config.aprovacao`).
- Handler `MAPA_PROCESSO`: `aoAprovar` (última assinatura) muda para PARA_PUBLICAR e cria a atividade na mesma transação; `aoRejeitar` muda para REPROVADO e grava `reprovadoPorId`; `aoCancelar` volta à edição. Os handlers conferem `versao` (conflito se o mapa mudou).
- Prazos (04): publicação 2 dias úteis; verificação 7 dias úteis. Vencido: aviso a toda a Qualidade e urgência máxima.
- O `conteudo` da `RevisaoMapa` não pode ser editado nos estados EM_APROVACAO e PARA_PUBLICAR; em VIGENTE não há revisão aberta. Um mapa por área: iniciar elaboração em área que já tem mapa é recusado.
- Editar `Processo` valida que o mapa está em estado de edição; trava otimista por `versao` do mapa e `revisao` do processo.
- Painel de edição mostra o aviso: «Considere a revisão dos seguintes documentos: LAIA, Perigos e Riscos, caso mude algum processo ou atividade».
- Revisão complementar não é revisão periódica e não reinicia os 12 meses.
- O caminho atual `publicarVersao`/`solicitarPublicacao` por `Processo` isolado fica desativado na interface quando o mapa tem fluxo (ver Riscos).

## Permissões novas

Seguem o padrão `MODULO_ACAO`: `MAPA_SOLICITAR` (área registra demanda), `MAPA_ELABORAR` (Qualidade: iniciar elaboração/revisão, editar, importar, enviar, ver rascunho e etiqueta «em revisão»), `PROCESSO_PUBLICAR` (assumir e executar a publicação), `PROCESSO_VERIFICAR_REVISAO` (assumir a verificação). Todas respeitam o escopo por unidade do mapa (`obraNoEscopo`); `VER_TODAS_OBRAS` libera. Aprovar reutiliza a condição de aprovador do motor. `PROCESSO_GERENCIAR` e `ADMIN_CONFIG` continuam. Cada uma: enum `Permissao` (`ALTER TYPE ... ADD VALUE`), `TODAS_PERMISSOES`, perfis no seed (Qualidade recebe todas menos `MAPA_SOLICITAR`; perfis de área recebem `MAPA_SOLICITAR`) e rótulo em Configurações. Perfis e permissões são configuráveis no sistema.

## Notificações

Tipos novos em `TipoNotificacao`: `MAPA_SOLICITADO` (à Qualidade quando a área registra), `MAPA_REPROVADO` (à Qualidade, com o nome do reprovador e a justificativa; mapa não é registro restrito, mas só a justificativa entra como texto livre), `MAPA_PARA_PUBLICAR` (via `ATIVIDADE_NOVA`), mais os de atividade (04). `APROVACAO_PENDENTE` existente cobre os aprovadores. Chaves determinísticas:
- `mapa-solicitado:{solicitacaoId}:{usuarioId}`
- `mapa-reprovado:{mapaId}:{ciclo}:{usuarioId}`
- `verificar-mapa:{mapaId}:periodica:{versaoVigente}` (chave de origem da atividade, 12 meses)
- `verificar-mapa:{mapaId}:{origem}:{origemEntidadeId}` (gatilho de documento/HIRA/LAIA)
- `publicar-mapa:{mapaId}:{ciclo}` (chave de origem da atividade de publicação)
Nenhum texto livre de registro restrito em título/corpo (só códigos e nomes de mapa).

## Gatilhos e cron

- Gatilho (b): em `src/lib/documentos/servico.ts` (publicação de versão de documento de qualquer tipo), no handler/serviço de LAIA e de HIRA (publicação de revisão vinculada ao mapa via `processoId` -> `Processo.mapaId`), chamar `criarAtividadeVerificacaoMapa` após o commit com `comSeguranca`. Se já existir verificação aberta para o mapa, não duplica: grava o evento no log dela. Só considerar publicação, não rascunho. O mapa afetado vem de `Processo.mapaId` (processo sem mapa é ignorado).
- Gatilho (a): em `src/lib/atividades/cron.ts` (ou `src/lib/processos/cron.ts`), com import em `src/lib/notificacoes/cron.ts`: mapas VIGENTE com `proximaVerificacaoEm <= hoje` (fuso da empresa) e sem verificação aberta geram a atividade. Idempotente pela `chaveOrigem`.
- Handler novo: import em `src/lib/aprovacao/handlers.ts` e `TIPOS_COM_HANDLER`.
- Vencimento de atividades: cron do 04.

## Telas (apenas listar; desenho com o agente-ux-ui)

- Registrar solicitação (área e Qualidade); lista de solicitações.
- Rotas/abas do módulo (padrão de `src/app/(app)/treinamentos/`: `layout.tsx` com `LayoutComJanela`, `page.tsx` e subrotas irmãs; confirmar o componente de abas usado por Treinamentos ao implementar):
  - `/processos` (visão normal, já existe): só a versão **vigente**, por área/unidade, com a etiqueta «em revisão» visível a quem tem `MAPA_ELABORAR` (Qualidade/administrador); nunca mostra rascunho.
  - `/processos/revisao` (nova aba «Mapas em revisão»): lista dos mapas com `RevisaoMapa` aberta ou em estado PARA_PUBLICAR/REPROVADO, filtrada por escopo de unidade; exige `MAPA_ELABORAR` (aprovadores veem só os seus pelo item seguinte).
  - `/processos/revisao/[mapaId]` (e janela `@modal`): painel de edição da revisão, importar Excel, revisões arquivadas, enviar para aprovação.
  - `/processos/solicitacoes` (nova aba): registrar e listar solicitações.
  - `/processos/[id]` (detalhe do processo, já existe): sem mudança na leitura do vigente.
- Tramitação: aprovadores e quem assume a atividade chegam ao mapa pela aba Aprovações (`/aprovacoes/[id]`, já existe) e pelo cartão da atividade, que abrem uma visão **somente leitura** da `RevisaoMapa` (e do vigente para comparar). O handler `MAPA_PROCESSO` define `podeVer` para esses usuários (o aprovador não precisa de `MAPA_ELABORAR` para ver o mapa que vai aprovar), respeitando o escopo da unidade.
- Mapa com estado e etiquetas («em revisão», «Reprovado por [nome]», «Para publicar», «Mapa vigente»); leitores veem a versão vigente.
- Painel de edição (revisão em andamento) com o aviso LAIA/Perigos e Riscos, importar Excel, histórico de revisões arquivadas.
- Enviar para aprovação (escolher aprovadores); tela de aprovação com justificativa na reprovação; histórico de decisões por ciclo.
- Atividades «Publicar mapa» e «Verificar possível revisão de mapa» (cartões do 04); diálogo «Precisa revisar o mapa?» (Sim/Não e observação).
- Configurações: feriados (04) e rótulos das novas permissões.

## Testes e critérios de aceite

- vitest: transições de estado; cálculo de `proximaVerificacaoEm` (12 meses, fim de mês); revisão complementar não muda a data; escolha de ciclo.
- `scripts/teste-mapa-fluxo.ts` (sufixo aleatório, reexecutável): demanda por área vs Qualidade grava origem correta; elaboração -> aprovação com 3 aprovadores: 2 aprovam e 1 reprova gera REPROVADO com nome e justificativa, e avisa a Qualidade; reprovação sem justificativa é recusada; retorno ao 2.2 e novo ciclo com `ciclo` 2 no `HistoricoAprovacao`; UPDATE/DELETE em `historico_aprovacao`, `revisao_mapa_arquivada` e `versao_mapa` bloqueados por trigger; todos aprovam => PARA_PUBLICAR e uma atividade criada (duas chamadas, uma atividade); só quem tem `PROCESSO_PUBLICAR` assume; publicar gera `VersaoMapa` + `VersaoProcesso` e estado VIGENTE; durante revisão o leitor vê a versão anterior e a Qualidade vê «em revisão»; importação de Excel arquiva o conteúdo anterior da `RevisaoMapa`; a visão normal e as leituras de outros módulos nunca retornam o rascunho (nem durante a elaboração de mapa novo); só uma `RevisaoMapa` aberta por mapa e só um mapa por área (violações recusadas); mapa de área sem unidade é recusado; verificação NÃO e SIM; revisão complementar não reinicia os 12 meses; gatilhos 12 meses e publicação de documento/LAIA/HIRA vinculado criam exatamente uma atividade; prazos de 2 e 7 dias úteis respeitam feriados; vencimento avisa toda a Qualidade e marca urgência máxima.
- Escopo por unidade: usuário com `obrasPermitidas` de outra unidade não lista, abre nem recebe atividade/aviso do mapa; `VER_TODAS_OBRAS` vê tudo; aprovador da tramitação vê o mapa pelo `podeVer` mesmo sem `MAPA_ELABORAR`.
- Isolamento: a empresa Demo não vê mapas, solicitações, decisões, versões nem atividades de outra empresa; gatilho de documento de uma empresa não cria atividade na outra; FKs compostas rejeitam `mapaId` de outra empresa.
- Gating: sem o módulo `MAPA_PROCESSOS` nada funciona.
- Handler registrado: teste confere `MAPA_PROCESSO` em `TIPOS_COM_HANDLER`.
- Antes de entregar: `npx tsc --noEmit -p .`, `npm run lint`, `npm test`, `npm run test:mapa-fluxo` (script a criar), `npm run test:isolamento`; guia §7 passo 2 para a migração (sem `migrate dev`, sem reset).

## Fatias de implementação (em ordem)

1. Regra comum de atividades e feriados (04, fatias 1 e 2): agente-arquitetura-dados.
2. Dados do mapa: `Setor.obraId` (e tela em Configurações para ligar área à unidade), `MapaProcesso`, `RevisaoMapa`, `Processo.mapaId` e tela de atribuição dos processos existentes, `SolicitacaoMapa`, `RevisaoMapaArquivada`, `VersaoMapa`, `VerificacaoMapa`, colunas do `HistoricoAprovacao`, permissões e seed: agente-arquitetura-dados.
3. Serviço do fluxo (estados, handler `MAPA_PROCESSO`, publicação, separação rascunho/vigente, verificação): agente-auditorias-processos (dono do módulo Processos), com arquitetura-dados para o motor.
4. Importação de Excel e aviso no painel: agente-auditorias-processos.
5. Gatilhos e cron (12 meses, documento, LAIA, HIRA) e notificações: agente-notificacoes, com agente-documentos e agente-riscos-hira-laia nos pontos de publicação.
6. Telas: agente-ux-ui, depois agente-responsivo.
7. Revisão de isolamento, log e migração: agente-qa-revisao.
8. Trocar o rótulo «Setor» por «Área» na interface de todos os módulos: agente-ux-ui. Levantamento em `src/` (sem alterar o modelo): cerca de 39 arquivos mencionam setor, dos quais 12 arquivos `.tsx` têm o rótulo visível (`src/paginas/html/`: `configuracoes.tsx` (6 ocorrências), `hira-lista.tsx` (2), `documento-detalhe.tsx` (2), `treinamento-formulario.tsx` (2), `rnc-detalhe.tsx`, `rnc-nova-formulario.tsx`, `incidente-detalhe.tsx`, `incidentes-novo-formulario.tsx`, `hira-formulario.tsx`, `dashboard.tsx`, `treinamentos-lista.tsx`, `documento-novo-formulario.tsx`) e 7 arquivos `.ts` têm mensagens de erro com a palavra (`src/lib/admin/servico.ts`, `src/lib/documentos/servico.ts`, `src/lib/incidentes/servico.ts`, `src/lib/inspecoes/servico.ts`, `src/lib/treinamentos/servico.ts`, `src/app/(app)/treinamentos/actions.ts`, `src/app/(app)/configuracoes/actions.ts`). Só texto visível; não renomear identificadores, rotas ou colunas. Refazer o Grep na hora da execução. Cobrir também ajuda, e-mails e testes que comparem texto.
9. Relatório e documentação (guia §8.4, `docs/06-desenho-modulos.md`).

## Riscos

- Separar rascunho de vigente foi aprovado pelo Eric (03/10/2026). Como as linhas `Processo` seguem sendo o vigente, Riscos/HIRA/LAIA/Documentos/Auditorias não mudam; o risco é algum caminho antigo (`editarProcesso`, `moverProcesso`, `solicitarPublicacao`) ainda editar o vigente fora da publicação: bloquear e testar.
- `Setor` não tem unidade hoje: adicionar `Setor.obraId` altera uma entidade existente (aditivo, anulável); áreas sem unidade não podem ter mapa até ligadas.
- Publicação aplica o rascunho às linhas `Processo` numa transação grande: conflito de `codigo` e de vínculos (processo removido que tem risco/documento ligado: inativar, não apagar).
- Tornar `HistoricoAprovacao.fluxoId` opcional (04) pode quebrar consultas do motor.
- Processos existentes sem área: ficam sem `mapaId` até a atribuição; enquanto isso não geram gatilho de verificação.
- Biblioteca de Excel é dependência nova (segurança, tamanho de arquivo, fórmulas/macros); ler só dados, limites de tamanho e linhas.
- Gatilhos de documento/LAIA/HIRA podem gerar muitas verificações; a regra «não duplicar se já aberta» mitiga.
- Ciclo e versão do mapa gravados no log precisam ser lidos na mesma transação da decisão.
- Esquecer os imports (`handlers.ts`, `cron.ts`) deixa o fluxo morto em silêncio.
- Perfil Qualidade sem nenhum usuário com `PROCESSO_PUBLICAR` ou `PROCESSO_VERIFICAR_REVISAO`: a atividade fica sem quem assuma; avisar na criação.

## Perguntas bloqueantes ao Eric

Nenhuma. (Resolvidas em 03/10/2026: unidade do mapa = Área; rascunho separado do vigente; `Setor` é a Área; processos existentes vão para a Área provisória «Geral».) A decisão opcional de renomear o modelo no banco está registrada no topo e não bloqueia nada.
