# 05 - Mapa de Processos: fluxo de demanda, elaboração, aprovação, publicação e verificação

Status: especificação (nada implementado). Data: 2026-10-03. Fluxo validado pelo Eric em 03/10/2026. Depende da regra comum [04-regra-comum-atividades.md](04-regra-comum-atividades.md) (atividade, assumir, devolver, dias úteis, vencimento).

Decisões do Eric em 03/10/2026 (respondem as duas perguntas bloqueantes anteriores):
1. Hierarquia Empresa -> Unidades -> Áreas; **cada área tem o seu mapa** (um mapa por área, não por empresa).
2. **Separar rascunho e vigente: SIM.** O mapa em elaboração/revisão não aparece na visão normal do módulo; é acessado pela tramitação ou pela aba «Mapas em revisão» dentro do módulo (padrão de abas do módulo Treinamentos).
3. `Setor` é a «Área». Na interface (textos, rótulos, títulos de aba e telas) diz-se sempre «Área»; no código e no schema continuam o modelo `Setor` e os campos `setorId` (mesma convenção de «Unidade» na interface e `obra` no código).
4. Os `Processo` já cadastrados vão para uma Área provisória «Geral» (ver «Migração dos processos já cadastrados»); o Eric gerará dados de exemplo depois, com agentes novos.

Decisão opcional do Eric (não decidida): NÃO propomos renomear o modelo `Setor` para `Area` no banco. O modelo é usado em cerca de 39 arquivos de `src/` e em várias tabelas (RNC, Documento, Inspeção, Incidente, Usuário) e a renomeação exigiria migração e testes em todos os módulos, com risco de quebra silenciosa e nenhum ganho para o usuário, já que a interface é o que muda.
5. **Área «Geral»: uma por unidade** (decisão de 03/10/2026). Por isso a unicidade do nome de `Setor` passa a ser por `[empresaId, obraId, nome]` (ver Dados).
6. **Aprovador que sai ou fica sem permissão durante o ciclo:** as duas ações valem. A Qualidade (`MAPA_ELABORAR`) pode substituir o aprovador (nova etapa registrada no log) e pode cancelar a revisão (desfecho CANCELADA).
7. **Notificação de reprovação leva a justificativa** (interpretação a confirmar, não bloqueante; ver Notificações e «Pontos a confirmar»).

Correção da revisão de QA (`docs/relatorios/2026-10-03-revisao-qa-mapa-processos.md`, 20 itens) aplicada nesta versão. Dono único da mudança em `HistoricoAprovacao` (`fluxoId` opcional, `atividadeId`): o [04](04-regra-comum-atividades.md); este arquivo só a referencia.

## Objetivo

Substituir a edição/publicação livre do mapa por um fluxo controlado, com três raias (Área, Qualidade, Aprovadores): demanda registrada, elaboração/revisão com a área, aprovação de todos os aprovadores, publicação por atividade assumida, e verificação periódica ou por gatilho (12 meses desde a publicação, ou revisão de documento/LAIA/Perigos e Riscos vinculado).

## Situação atual no código

Existe:
- Cadastro do mapa: `Processo` (linha do mapa: código, nome, tipo GESTAO/FINALISTICO/APOIO, dono, SIPOC; `versao` = última versão publicada; `revisao` = trava otimista de edição), `IndicadorProcesso`, `InteracaoProcesso`, `VersaoProcesso` (snapshot Json append-only, único por `[empresaId, processoId, versao]`) em `prisma/schema.prisma`.
- Serviço: `src/lib/processos/servico.ts` (`criarProcesso`, `editarProcesso`, `publicarNaTransacao` que congela `VersaoProcesso` e incrementa `versao`, `publicarVersao` direta, `solicitarPublicacao` via motor), `src/lib/processos/regras.ts` (`montarSnapshot` etc.), handler `src/lib/processos/aprovacao.ts` (tipo `PROCESSO`, alteração PUBLICACAO), registrado em `src/lib/aprovacao/handlers.ts` e `TIPOS_COM_HANDLER`.
- Motor de aprovação com modo `PARALELO` (todos recebem juntos, todos precisam aprovar): `src/lib/aprovacao/servico.ts` (`solicitarAprovacao`, `decidir`, `cancelar`), handler com `aoAprovar`/`aoRejeitar`/`aoCancelar`. Configuração por módulo em `Empresa.config.aprovacao.<modulo>` (`config-modulo.ts`).
- Tabela de decisões: `EtapaAprovacao` (aprovador, status, `decididoEm`, `comentario`; mutável; único por fluxo+aprovador) e `HistoricoAprovacao` (append-only por trigger: usuário, ação APROVADO/REJEITADO, `comentario`, `metadados`, `criadoEm`). A justificativa na reprovação **já é exigida** pelo motor (`normalizarComentario`, `src/lib/aprovacao/regras.ts:61`).
- Vínculos com o mapa: `processoId` em `Documento`, `LinhaHira`, `LinhaLaia`, `RiscoOportunidade` (FK composta com `Processo`). Publicação de documento em `src/lib/documentos/servico.ts` (hoje dispara `DOCUMENTO_PUBLICADO`/`CIENCIA_PENDENTE`).
- Notificações, cron e tipos: ver 04. Telas: `src/app/(app)/processos/`.
- Permissões atuais: `PROCESSO_GERENCIAR`, `ADMIN_CONFIG`, `HIRA_GERENCIAR`, `LAIA_GERENCIAR`, `DOCUMENTO_ELABORAR`.

- Hierarquia: `ObraUnidade` (unidade) e `Setor` (`prisma/schema.prisma`, ~linhas 476 e 506). Escopo por unidade: `obrasPermitidas`/`filtroObras`/`obraNoEscopo` em `src/lib/escopo-obras.ts` (reexportado por `src/lib/tenant.ts`); `VER_TODAS_OBRAS` libera tudo.
- Padrão de abas do módulo Treinamentos: `src/app/(app)/treinamentos/` com `layout.tsx` (`LayoutComJanela`, janela em `@modal`), `page.tsx` e subrotas irmãs `meus/`, `matriz/`, `auditoria/`.

Lacuna na hierarquia: `Setor` não tem ligação com `ObraUnidade` (só `empresaId`, `nome`, `ativo`; nome único por empresa). Hoje não existe "Área dentro de Unidade". `Setor` é a «Área» (confirmado). Falta o vínculo `Setor.obraId` (novo, ver Dados). Atenção: `@@unique([empresaId, nome])` impede duas unidades de terem área com o mesmo nome; muda para `[empresaId, obraId, nome]`.

Outros usos de «setor» que NÃO são o modelo `Setor`: `src/lib/documentos/planilha.ts` e `src/lib/hira/servico.ts` usam «setor» como **texto livre**, sem ligação com `Setor`; ficam fora desta mudança (a troca de rótulo, fatia 8, só vale para a interface do modelo). Já ligados ao modelo: RNC, Documento, Inspeção, Incidente, Usuário. Treinamentos guarda `obrigatorioSetorIds` como lista sem chave estrangeira (`prisma/schema.prisma`, ~linha 1666) e suas telas listam todos os setores ativos.

Não existe, é novo:
- Uma entidade «mapa» (hoje só existem linhas `Processo` soltas, sem área nem unidade; "o mapa" é o conjunto delas). Estado do mapa, solicitação/demanda, ciclos de aprovação, estado «Para publicar», etiqueta «em revisão», rascunho versus vigente.
- Separar o que é publicado do que está em edição: hoje `editarProcesso` altera as linhas ao vivo, então a versão vigente seria sobrescrita durante a revisão.
- Importação de Excel: não há biblioteca de planilha em `package.json`.
- Verificação periódica, gatilho por publicação de documento/HIRA/LAIA, decisão «Precisa revisar o mapa?», «revisão complementar».
- Feriados, atividades (04).

## O que é novo

1. `MapaProcesso` (um por área), `RevisaoMapa` (revisão em andamento), `SolicitacaoMapa`, `RevisaoMapaArquivada`, `VersaoMapa`, `Setor.obraId` (+ nova unicidade e `Setor.padrao`), `Processo.mapaId` e colunas em `HistoricoAprovacao` (migração do 04).
2. Tipo de aprovação `MAPA_PROCESSO` com handler próprio; aprovação não publica, leva a «Para publicar».
3. Duas atividades (`PUBLICAR_MAPA`, `VERIFICAR_REVISAO_MAPA`) usando a regra do 04.
4. Importação de Excel, aviso no painel de edição, etiqueta «em revisão».
5. Cron de 12 meses e gatilhos de documento/LAIA/Perigos e Riscos.

## Dados

Migração aditiva: só `CREATE TABLE`, `ADD COLUMN` anulável, `ADD VALUE` em enums; nada é apagado nem reescrito. Tudo com `empresaId`, `@@unique([empresaId, id])`, FKs compostas `(empresaId, xId) -> (empresaId, id)`, `onDelete: Restrict`, exclusão lógica (`ativo`), `criarDbTenant`; em `create`, nunca `empresa: { connect }`.

**Hierarquia e escopo:**
- `Setor` (= Área, confirmado) ganha `obraId?` (FK composta para `ObraUnidade`, anulável na migração, `onDelete: Restrict`), cadastrado em Configurações. Área sem unidade não pode ter mapa (validação no serviço).
- **Troca da unicidade (migração aditiva, passo a passo):** (1) `ADD COLUMN setor.obra_id` anulável e FK composta; (2) criar `UNIQUE (empresa_id, obra_id, nome)` e índice único parcial `UNIQUE (empresa_id, nome) WHERE obra_id IS NULL` (áreas antigas sem unidade; em Postgres `NULL` não colide, por isso o parcial); (3) só então `DROP` do índice antigo `(empresa_id, nome)`; sem apagar linha alguma. No `schema.prisma`, `@@unique([empresaId, obraId, nome])` mais o índice parcial na seção «Regras SQL» da migração. Efeito: duas unidades podem ter áreas com o mesmo nome (ex.: «Produção»); duas áreas do mesmo nome na mesma unidade, ou ambas sem unidade, continuam proibidas.
- **Mensagem:** «Já existe um setor com este nome» em `src/lib/admin/servico.ts:301` passa a «Já existe uma Área com este nome nesta Unidade.» (e a variante sem unidade).
- **Cadastro de Área** (`salvarSetor`, `esquemaSetor`, `salvarSetorAcao` em `src/lib/admin/servico.ts` e `src/app/(app)/configuracoes/actions.ts`): passa a receber `obraId` (opcional), validar que a unidade é da empresa e está no escopo do ator (`obraNoEscopo`), **bloquear a troca de unidade** de área que já tem mapa, e **bloquear a inativação** de área com mapa enquanto o mapa estiver ativo (inativar o mapa antes; ver «Inativação» nas regras).
- **Seletores de Área** em incidentes, inspeções, documentos e administração: **fora do escopo** desta tarefa (continuam listando todas as áreas ativas da empresa, sem filtro por unidade). Critério: registros antigos seguem aceitando `setorId` sem unidade.
- `MapaProcesso.obraId` é **copiado** da área ao criar o mapa (e mantido por serviço), para filtrar com `filtroObras` como RNC/HIRA/LAIA; CHECK/validação de que `obraId` = `setor.obraId`.
- Permissões respeitam o escopo: ler/editar/aprovar/assumir exige a permissão E `obraNoEscopo(ator, mapa.obraId)`; quem tem `VER_TODAS_OBRAS` enxerga todas as unidades. Destinatários de avisos são filtrados pelo mesmo escopo; a Qualidade «de toda a empresa» é quem tem `VER_TODAS_OBRAS` ou a unidade no escopo.

**Modelo vigente versus revisão em andamento (decisão 2):**
- **Vigente (imutável fora da publicação):** as linhas `Processo` (e `IndicadorProcesso`, `InteracaoProcesso`) ligadas ao mapa por `Processo.mapaId` continuam sendo o conteúdo vigente que Riscos, HIRA, LAIA, Documentos e Auditorias já leem (por isso seus vínculos `processoId` não mudam). Elas só mudam dentro da transação de publicação. A cópia congelada é `VersaoMapa` (snapshot append-only).
- **Revisão em andamento:** nova tabela `RevisaoMapa` com o rascunho (`conteudo` Json no mesmo formato de `montarSnapshot` em `src/lib/processos/regras.ts`), no máximo **uma aberta por mapa** (índice único parcial `WHERE fechada_em IS NULL`). Editar no site e importar Excel gravam aqui; nunca nas linhas `Processo`. Enquanto existir, a versão vigente segue valendo e ganha a etiqueta «em revisão».
- **Publicação:** em uma transação, aplica o `conteudo` aprovado às linhas `Processo` (cria as novas, atualiza por `codigo`, inativa as removidas), chama `publicarNaTransacao` por processo (mantendo `VersaoProcesso`), grava `VersaoMapa` e fecha a `RevisaoMapa`. Processo novo só passa a ter id (e a poder ser vinculado a risco/documento) depois de publicado.
- `editarProcesso`/`criarProcesso`/`moverProcesso` etc. de `src/lib/processos/servico.ts` deixam de editar mapa vigente diretamente (passam a operar no rascunho ou a ser bloqueados quando o processo pertence a mapa).

**`RevisaoMapa`:** `id`, `empresaId`, `mapaId`, `numero` (revisão do mapa, sequência), `tipo` (ELABORACAO, REVISAO), `conteudo` (Json), `numeroGravacao` (Int, +1 a cada gravação que arquiva a anterior), `versao` (trava otimista, `updateMany where versao`), `iniciadaPorId`, `iniciadaEm`, `fechadaEm?`, `desfecho?` (PUBLICADA, CANCELADA, DESCARTADA_POR_INATIVACAO), `fechadaPorId?`, `motivoCancelamento?` (texto curto, obrigatório ao cancelar); `@@unique([empresaId, mapaId, numero])`.

**Enum `EstadoMapa`:** ELABORACAO_JUNTO_AREA, REVISAO_JUNTO_AREA, EM_APROVACAO, REPROVADO, PARA_PUBLICAR, VIGENTE.

**`MapaProcesso`:** `id`, `empresaId`, `setorId` (a área), `obraId` (unidade, derivada da área), `codigo` (único por empresa), `nome`, `estado`, `versaoVigente` (Int, 0 = nunca publicado; espelho do `VersaoMapa` mais recente), `cicloAtual` (Int, +1 a cada envio para aprovação), `reprovadoPorId?` (para «Reprovado por [nome]»), `ultimaPublicacaoEm?` (base dos 12 meses), `proximaVerificacaoEm?` (Date, = publicação + 12 meses), `versao` (trava otimista), `ativo`, `criadoEm`, `atualizadoEm`. **`@@unique([empresaId, setorId])`: um mapa por área** (a tela de criação oferece só áreas sem mapa); `@@index([empresaId, obraId, estado])`. Etiqueta «em revisão» não é coluna: é derivada (`versaoVigente > 0` e existe `RevisaoMapa` aberta).

**`Processo` (coluna nova):** `mapaId?` (FK composta; anulável por causa dos processos já cadastrados, que hoje não têm área). Carga inicial: ver «Migração dos processos já cadastrados» (todos vão para o mapa da Área «Geral» da unidade, reatribuíveis depois). Após a carga, `mapaId` passa a ser obrigatório por regra de serviço. **Código do processo** é único por empresa (`@@unique([empresaId, codigo])`); a publicação e a importação por código **recusam** código que já exista em outro mapa (nunca movem processo entre mapas).

**`SolicitacaoMapa`:** `id`, `empresaId`, `setorId` (área), `mapaId?` (nulo se mapa novo ainda não criado), `obraId`, `tipo` (ELABORACAO, REVISAO), `origem` (AREA_SISTEMA, AREA_EMAIL, AREA_PRESENCIAL, QUALIDADE), `solicitanteId?` (a área, se pediu pelo sistema), `registradaPorId`, `descricao` (texto livre curto; sem dados pessoais), `status` (REGISTRADA, EM_ANDAMENTO, ATENDIDA, CANCELADA), `versao`, `criadoEm`. Regra: origem AREA_SISTEMA é registrada pela própria área; as demais, pela Qualidade (CHECK: `origem = 'AREA_SISTEMA'` implica `solicitanteId = registradaPorId`). `obraId` é copiado de `setor.obraId` pelo serviço (validação de igualdade no serviço e no teste). Leitura e escrita filtradas por `obraNoEscopo(ator, obraId)`; índice `[empresaId, obraId, status]`.

**`RevisaoMapaArquivada`** (append-only por trigger; guarda cada `conteudo` substituído da `RevisaoMapa`): `id`, `empresaId`, `mapaId`, `revisaoMapaId`, `numero`, `snapshot` (Json do rascunho anterior), `origem` (MANUAL, IMPORTACAO_EXCEL), `arquivadoPorId`, `arquivadoEm`; `@@unique([empresaId, revisaoMapaId, numero])`. FKs compostas `(empresaId, revisaoMapaId) -> RevisaoMapa(empresaId, id)` e `(empresaId, mapaId) -> MapaProcesso(empresaId, id)`.

**`VersaoMapa`** (append-only por trigger): `id`, `empresaId`, `mapaId`, `versao`, `snapshot` (todos os processos, indicadores e interações), `publicadoPorId`, `publicadoEm`, `fluxoAprovacaoId?` (FK composta); `@@unique([empresaId, mapaId, versao])`. Conteúdo: o snapshot contém **todos** os processos ativos do mapa no momento da publicação (não só os alterados). Para a migração, o `VersaoMapa` 1 usa o estado atual das linhas `Processo` (ver Migração).

**Tabela de decisões (aprovação e reprovação): reaproveitar `HistoricoAprovacao`** em vez de criar outra. Já tem: aprovador (`usuarioId`), data (`criadoEm`), decisão (`acao` APROVADO/REJEITADO), observação (`comentario`), append-only por trigger, tipo de entidade pelo fluxo. A justificativa na reprovação já é obrigatória no serviço (`src/lib/aprovacao/regras.ts:61`); acrescenta-se apenas o CHECK de banco. Falta: (a) `ciclo Int?`; (b) `versaoEntidade Int?` (número de gravação da `RevisaoMapa` no momento da decisão); (c) CHECK `acao <> 'REJEITADO' OR comentario IS NOT NULL`, criado `NOT VALID` (não valida linhas antigas). A tela mostra «Reprovado». Cada envio cria um novo `FluxoAprovacao` (PARALELO), então o ciclo é a contagem de fluxos do mapa; `ciclo` e `versaoEntidade` são gravados na mesma transação da decisão. `EtapaAprovacao` continua sendo o estado operacional.

**Dono único da mudança de `HistoricoAprovacao`:** o [04](04-regra-comum-atividades.md) (`fluxoId` opcional, `atividadeId`, CHECK `num_nonnulls(fluxo_id, atividade_id) = 1`, novos valores de ação). Este arquivo só adiciona as colunas `ciclo` e `versaoEntidade` e o CHECK de justificativa **na mesma migração** definida no 04 (uma migração só). Registros: `PUBLICAR_MAPA` registra com `atividadeId` e guarda o `fluxoId` da aprovação nos `metadados`; `VERIFICAR_REVISAO_MAPA` (que não tem fluxo) registra só com `atividadeId`.

**Verificação:** nova tabela `VerificacaoMapa` (append-only): `id`, `empresaId`, `mapaId`, `obraId` (copiado do mapa), `atividadeId` (FK composta para `Atividade`), `origem` (PERIODICA_12_MESES, DOCUMENTO_PUBLICADO, LAIA_PUBLICADA, HIRA_PUBLICADA), `origemEntidadeId?`, `precisaRevisar` (bool), `tipoRegistro` (REVISAO_INICIADA ou REVISAO_COMPLEMENTAR), `observacao?`, `verificadaPorId`, `verificadaEm`. Revisão complementar NÃO altera `ultimaPublicacaoEm` nem `proximaVerificacaoEm`. Filtrada por `obraNoEscopo`; FK composta `(empresaId, mapaId)`.

**Enums existentes a estender:** `TipoEntidadeAprovacao` (+MAPA_PROCESSO), `TipoEntidadeNotificacao` (+MAPA_PROCESSO), `TipoAtividade`/`TipoEntidadeAtividade` (04), `ModuloAnexo`/regra de anexo só se Excel for guardado (não será: lê e descarta).

**Excel (proposta, limites ajustáveis):** biblioteca nova (sugestão `exceljs`; dependência nova, registrar no relatório de entrega). Modelo de planilha com as colunas do SIPOC. Limites propostos: **arquivo até 2 MB, até 500 linhas**, só `.xlsx`; **sem fórmulas e sem hiperlinks** (célula com fórmula ou link recusa a importação, com a linha indicada); lê só os valores, descarta macros e o arquivo (não guarda anexo). Validar tamanho, linhas, tipos e códigos duplicados no servidor. Código que já exista em **outro** mapa é recusado. Importar substitui o `conteudo` da `RevisaoMapa` (arquiva o anterior em `RevisaoMapaArquivada`, origem IMPORTACAO_EXCEL).

## Migração dos processos já cadastrados

A Área «Geral» é **provisória**: serve só para dar um mapa aos `Processo` existentes e pode ser reatribuída depois (o Eric vai gerar dados de exemplo com agentes novos). Script idempotente `scripts/migrar-processos-mapa.ts` (ou SQL na migração), usando `prismaAdmin` (só seed/cron/testes/migração), aditivo, sem apagar nem alterar linhas existentes além de preencher `Processo.mapaId` nulo.

Colunas auxiliares: `Setor.padrao Boolean @default(false)` (marca a Área padrão; índice único parcial `WHERE padrao`: no máximo uma padrão por `[empresaId, obraId]`). Decisão do Eric: **uma «Geral» por unidade**, o que depende da nova unicidade `[empresaId, obraId, nome]` (seção Dados), aplicada **antes** da carga.

Ordem das etapas, por empresa:
1. Contagens antes: nº de `Processo` (total e com `mapaId` nulo), de `Setor`, de `MapaProcesso`, de `VersaoProcesso`; gravar no relatório.
2. Criar as colunas/tabelas novas (migração aditiva normal).
3. Área padrão, por unidade (`ObraUnidade`) da empresa: se já existir uma Área chamada «Geral» **naquela unidade**, **reaproveitá-la** (marca `padrao = true`, não duplica nem renomeia). Se existir uma «Geral» antiga **sem unidade** (`obraId` nulo), reaproveitá-la ligando-a à primeira unidade (menor `criadoEm`) e registrar a escolha no relatório; as demais unidades ganham a sua «Geral» nova. Senão, criar `Setor` «Geral» (`padrao = true`, `obraId` = unidade). Empresa sem nenhuma unidade: pular e listar no relatório (os `Processo` ficam sem mapa e fora de gatilhos). A «Geral» **nunca** é atribuída a usuário nenhum automaticamente, e não entra em `obrigatorioSetorIds` de Treinamentos.
4. Para cada Área «Geral», achar ou criar o `MapaProcesso` (`@@unique([empresaId, setorId])` garante um só): estado `VIGENTE` e `versaoVigente` = 1 se algum dos processos já tiver `VersaoProcesso`; senão `ELABORACAO_JUNTO_AREA` (e `versaoVigente` 0). Regra para versões por linha diferentes: a `VersaoMapa` 1 usa o **estado atual das linhas `Processo`** (não as versões individuais) e `ultimaPublicacaoEm` = maior `publicado_em` de `versao_processo` entre os processos que irão para o mapa (`criadoEm` do mapa se nenhum publicou), `proximaVerificacaoEm` = +12 meses. `VersaoMapa` 1 é criada só se `versaoVigente` = 1, idempotente por `[empresaId, mapaId, versao]`; `VersaoProcesso` existente não muda.
5. Processos: com uma só unidade, `UPDATE processo SET mapa_id = <mapa da Geral> WHERE mapa_id IS NULL`. Com várias unidades, os `Processo` existentes (que não têm unidade) vão para o mapa da «Geral» da unidade escolhida na etapa 3 (a primeira); reatribuir a outras Áreas é feito depois, por tela de «Atribuir processos a mapas» (Qualidade). A «Geral» é provisória.
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
- **Aprovador que sai da empresa, é inativado ou perde permissão durante o ciclo** (ambas as ações valem, só com `MAPA_ELABORAR`): (a) **substituir aprovador**: cria nova `EtapaAprovacao` no mesmo fluxo para o substituto e marca a antiga IGNORADA, com registro no log (`HistoricoAprovacao`, `metadados` de/para); o substituto não pode ser o solicitante nem quem já decidiu; (b) **cancelar a revisão**: `RevisaoMapa` com `desfecho = CANCELADA`, `motivoCancelamento` obrigatório, fluxo cancelado (`aoCancelar`), mapa volta a VIGENTE (se havia vigente) ou fica ELABORACAO_JUNTO_AREA sem revisão aberta de novo início. Ambas gravam no log e notificam os envolvidos.
- **Inativação (mapa ou Área) com `RevisaoMapa` aberta:** é bloqueada enquanto houver revisão aberta; a Qualidade precisa antes cancelar a revisão. Se a inativação acontecer por caminho administrativo (inativar mapa), o serviço fecha a revisão com `desfecho = DESCARTADA_POR_INATIVACAO`, cancela fluxo e atividades abertas (`CANCELADA` no 04) e registra no log, tudo na mesma transação. Reativar o mapa não reabre a revisão.
- Publicação (`publicarNaTransacao`): hoje incrementa `versao` e grava `VersaoProcesso` para o processo sem checar mudança. Regra: só processos **alterados** pelo `conteudo` aprovado ganham novo `VersaoProcesso`; os inalterados mantêm a versão; `VersaoMapa` guarda sempre todos. Nova função auxiliar compara o snapshot atual com o novo.
- Concorrência: `assumir` e `concluir` de `PUBLICAR_MAPA` conferem, na mesma transação, o estado do mapa (`PARA_PUBLICAR`, `versao` igual) e o estado da atividade; mudança no meio => `ErroConflito`.
- O caminho atual `publicarVersao`/`solicitarPublicacao` por `Processo` isolado fica desativado na interface quando o mapa tem fluxo (ver Riscos).

## Permissões novas

Seguem o padrão `MODULO_ACAO`: `MAPA_SOLICITAR` (área registra demanda), `MAPA_ELABORAR` (Qualidade: iniciar elaboração/revisão, editar, importar, enviar, ver rascunho e etiqueta «em revisão»), `PROCESSO_PUBLICAR` (assumir e executar a publicação), `PROCESSO_VERIFICAR_REVISAO` (assumir a verificação), mais `ATIVIDADE_ACOMPANHAR` (definida no 04; aviso de vencimento e visão geral das atividades). Seed: Qualidade recebe `MAPA_ELABORAR`, `PROCESSO_PUBLICAR`, `PROCESSO_VERIFICAR_REVISAO` e `ATIVIDADE_ACOMPANHAR`; ADMIN recebe todas (`TODAS_PERMISSOES`); perfis de área recebem `MAPA_SOLICITAR`. Todas respeitam o escopo por unidade do mapa (`obraNoEscopo`); `VER_TODAS_OBRAS` libera. Aprovar reutiliza a condição de aprovador do motor. `PROCESSO_GERENCIAR` e `ADMIN_CONFIG` continuam. Cada uma: enum `Permissao` (`ALTER TYPE ... ADD VALUE`), `TODAS_PERMISSOES`, perfis no seed (conforme acima) e rótulo em Configurações. Perfis e permissões são configuráveis no sistema.

## Notificações

Tipos novos em `TipoNotificacao`: `MAPA_SOLICITADO` (à Qualidade quando a área registra), `MAPA_REPROVADO` (à Qualidade da unidade; ver regra abaixo), `MAPA_PARA_PUBLICAR` (via `ATIVIDADE_NOVA`), mais os de atividade (04). `APROVACAO_PENDENTE` existente cobre os aprovadores. Chaves determinísticas:
- `mapa-solicitado:{solicitacaoId}:{usuarioId}`
- `mapa-reprovado:{mapaId}:{ciclo}:{usuarioId}`
- `verificar-mapa:{mapaId}:periodica:{versaoVigente}` (chave de origem da atividade, 12 meses)
- `verificar-mapa:{mapaId}:{origem}:{origemEntidadeId}` (gatilho de documento/HIRA/LAIA)
- `publicar-mapa:{mapaId}:{ciclo}` (chave de origem da atividade de publicação)
Regra de `MAPA_REPROVADO` (interpretação a confirmar): a notificação **dentro do sistema** (sino) mostra a justificativa, porque exige login; o **e-mail** leva só o código do mapa e o nome do reprovador, com o link. Implementação: o corpo da notificação interna inclui a justificativa e o envio de e-mail usa um texto reduzido próprio para este tipo (conferir como o serviço monta o e-mail em `src/lib/notificacoes/` e `src/lib/email/`). Fora isso, nenhum texto livre de registro restrito em título/corpo (só códigos e nomes de mapa). Destinatários filtrados por `obraNoEscopo`.

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

Usuários de teste (guia §11, senha `vigen123`): `qualidade@monto.com.br` (Qualidade: elabora, publica, verifica), `admin@monto.com.br` (aprovador e administrador), `seguranca@monto.com.br` (aprovador sem `MAPA_ELABORAR`: deve ver o mapa só pela tramitação), `colaborador@monto.com.br` (área, só `MAPA_SOLICITAR`; não vê rascunho), `admin@demo.com.br` (empresa Demo: isolamento). Criar usuários extras com sufixo aleatório para os casos de escopo por unidade.

- vitest (regras puras): transições de estado (tabela acima); `proximaVerificacaoEm` (12 meses, fim de mês); revisão complementar não muda a data; escolha de `ciclo`; comparação de snapshot (só alterados ganham versão); validador de limites do Excel (2 MB, 500 linhas, fórmula, link).
- `scripts/teste-mapa-fluxo.ts` (sufixo aleatório, reexecutável), cada item é uma asserção com a função testada:
  1. `registrarSolicitacao` grava origem e `registradaPorId` corretos (área vs Qualidade); `obraId` igual a `setor.obraId`.
  2. `iniciarElaboracao`/`iniciarRevisao` criam uma só `RevisaoMapa` aberta (segunda tentativa recusada); área sem unidade recusada; segundo mapa na mesma área recusado.
  3. `enviarParaAprovacao` com 3 aprovadores; 2 aprovam e 1 reprova: `HistoricoAprovacao` tem 2 APROVADO e 1 REJEITADO com `ciclo` e `versaoEntidade`; mapa REPROVADO com `reprovadoPorId`; reprovação sem justificativa recusada (`normalizarComentario`) e CHECK do banco rejeita insert direto.
  4. `retomarEdicao` e novo envio geram `ciclo` 2.
  5. UPDATE/DELETE em `historico_aprovacao`, `revisao_mapa_arquivada`, `versao_mapa` e `verificacao_mapa` bloqueados por trigger.
  6. Todos aprovam => PARA_PUBLICAR e exatamente 1 `Atividade` (`criarAtividade` duas vezes, mesma `chaveOrigem`); só quem tem `PROCESSO_PUBLICAR` e escopo assume.
  7. `publicarMapa`: gera `VersaoMapa` e `VersaoProcesso` só dos alterados, aplica o `conteudo` às linhas `Processo`, estado VIGENTE, `proximaVerificacaoEm` = +12 meses; código existente em outro mapa recusado.
  8. Leitura: `listarProcessos`/`obterProcesso` (visão normal) nunca retorna conteúdo da `RevisaoMapa` (nem em elaboração de mapa novo); `qualidade@` vê a etiqueta «em revisão», `colaborador@` não.
  9. `importarExcel`: arquiva o conteúdo anterior; recusa arquivo > 2 MB, > 500 linhas, com fórmula ou link.
  10. `substituirAprovador` (cria nova etapa, antiga IGNORADA, log) e `cancelarRevisao` (desfecho CANCELADA, motivo obrigatório, fluxo cancelado); aprovador que perde a permissão não consegue decidir; inativar mapa com revisão aberta aplica o destino definido.
  11. `decidirVerificacao`: NÃO registra «revisão complementar» sem alterar `ultimaPublicacaoEm`; SIM abre `RevisaoMapa`.
  12. Gatilhos: cron de 12 meses e publicação de documento (`src/lib/documentos/servico.ts`), LAIA e HIRA vinculados criam exatamente 1 atividade (e sem duplicar se já aberta).
  13. Prazos de 2 e 7 dias úteis; vencimento avisa a Qualidade no escopo (`ATIVIDADE_ACOMPANHAR` + `obraNoEscopo`) e marca urgência máxima.
  14. `MAPA_REPROVADO`: notificação interna contém a justificativa; o e-mail só código e nome do reprovador.
- Área/migração: duas unidades da mesma empresa criam áreas com o mesmo nome (aceito); mesma unidade ou ambas sem unidade, recusado; mensagem nova de duplicidade; `migrarProcessosParaMapa` rodada duas vezes dá as mesmas contagens; «Geral» preexistente reaproveitada (não duplicada); contagens e matriz de Treinamentos idênticas antes e depois, e a «Geral» nunca atribuída a usuário; registros antigos continuam aceitando `setorId`.
- Escopo por unidade: usuário com `obrasPermitidas` de outra unidade não lista, abre nem recebe atividade/aviso; `VER_TODAS_OBRAS` vê tudo; `seguranca@` (aprovador) vê o mapa pelo `podeVer` do handler `MAPA_PROCESSO` sem `MAPA_ELABORAR`.
- Isolamento (`npm run test:isolamento`, estendido): `admin@demo.com.br` não vê mapas, solicitações, decisões, versões, revisões nem atividades da Monto; gatilho de documento de uma empresa não cria atividade na outra; FKs compostas rejeitam `mapaId`, `revisaoMapaId`, `atividadeId` de outra empresa.
- Gating: sem o módulo `MAPA_PROCESSOS` nada funciona. Handler registrado: teste confere `MAPA_PROCESSO` em `TIPOS_COM_HANDLER` e o import do cron em `src/lib/notificacoes/cron.ts`.
- Antes de entregar: `npx tsc --noEmit -p .`, `npm run lint`, `npm test`, `npm run test:mapa-fluxo` (script a criar), `npm run test:aprovacao` (regressão do motor), `npm run test:isolamento`; guia §7 passo 2 para a migração (sem `migrate dev`, sem reset).

## Fatias de implementação (em ordem)

1. Regra comum de atividades e feriados, incluindo a **única migração** de `HistoricoAprovacao` e o teste de regressão do motor antes dela (04, fatias 1 a 3): agente-arquitetura-dados. As colunas `ciclo`/`versaoEntidade`/CHECK deste arquivo entram nessa mesma migração.
2. Dados do mapa: `Setor.obraId`, troca de unicidade do nome e `Setor.padrao`, ajuste do cadastro de Área (`salvarSetor` etc.; tela em Configurações para ligar a Área à unidade), script de migração dos processos («Geral» por unidade), `MapaProcesso`, `RevisaoMapa`, `Processo.mapaId` e tela «Atribuir processos a mapas», `SolicitacaoMapa`, `RevisaoMapaArquivada`, `VersaoMapa`, `VerificacaoMapa`, permissões e seed: agente-arquitetura-dados.
3. Serviço do fluxo (estados, handler `MAPA_PROCESSO`, publicação, separação rascunho/vigente, verificação): agente-auditorias-processos (dono do módulo Processos), com arquitetura-dados para o motor.
4. Importação de Excel e aviso no painel: agente-auditorias-processos.
5. Gatilhos e cron (12 meses, documento, LAIA, HIRA) e notificações: agente-notificacoes, com agente-documentos e agente-riscos-hira-laia nos pontos de publicação.
6. Telas: agente-ux-ui, depois agente-responsivo.
7. Revisão de isolamento, log e migração: agente-qa-revisao.
8. Trocar o rótulo «Setor» por «Área» na interface de todos os módulos: agente-ux-ui. Levantamento em `src/` (sem alterar o modelo): cerca de 39 arquivos mencionam setor, dos quais 12 arquivos `.tsx` têm o rótulo visível (`src/paginas/html/`: `configuracoes.tsx` (6 ocorrências), `hira-lista.tsx` (2), `documento-detalhe.tsx` (2), `treinamento-formulario.tsx` (2), `rnc-detalhe.tsx`, `rnc-nova-formulario.tsx`, `incidente-detalhe.tsx`, `incidentes-novo-formulario.tsx`, `hira-formulario.tsx`, `dashboard.tsx`, `treinamentos-lista.tsx`, `documento-novo-formulario.tsx`) e 7 arquivos `.ts` têm mensagens de erro com a palavra (`src/lib/admin/servico.ts`, `src/lib/documentos/servico.ts`, `src/lib/incidentes/servico.ts`, `src/lib/inspecoes/servico.ts`, `src/lib/treinamentos/servico.ts`, `src/app/(app)/treinamentos/actions.ts`, `src/app/(app)/configuracoes/actions.ts`). Só texto visível; não renomear identificadores, rotas ou colunas. Refazer o Grep na hora da execução. Cobrir também ajuda, e-mails e testes que comparem texto; **rodar `npm test` completo depois** (há testes que comparam mensagens). Não tocar nos textos livres «setor» de `documentos/planilha.ts` e `hira/servico.ts`.
9. Relatório e documentação (guia §8.4, `docs/06-desenho-modulos.md`).

## Riscos

- Separar rascunho de vigente foi aprovado pelo Eric (03/10/2026). Como as linhas `Processo` seguem sendo o vigente, Riscos/HIRA/LAIA/Documentos/Auditorias não mudam; o risco é algum caminho antigo (`editarProcesso`, `moverProcesso`, `solicitarPublicacao`) ainda editar o vigente fora da publicação: bloquear e testar.
- `Setor` não tem unidade hoje: adicionar `Setor.obraId` altera uma entidade existente (aditivo, anulável); áreas sem unidade não podem ter mapa até ligadas.
- Publicação aplica o rascunho às linhas `Processo` numa transação grande: conflito de `codigo` e de vínculos (processo removido que tem risco/documento ligado: inativar, não apagar).
- Tornar `HistoricoAprovacao.fluxoId` opcional (migração do 04) afeta cerca de 60 pontos em 7 arquivos do motor; teste de regressão (`npm run test:aprovacao`) antes da migração.
- Trocar a unicidade de `Setor` mexe em índice de tabela usada por vários módulos: aplicar em ordem (criar novos índices, depois remover o antigo) e conferir duplicidades antes.
- A Área «Geral» aparece nas telas que listam setores (Treinamentos e outros): conferir contagens e matriz.
- Processos existentes ficam no mapa da «Geral» da primeira unidade até a reatribuição; empresas sem unidade ficam sem mapa e fora dos gatilhos.
- Aprovador que some trava o fluxo: mitigado pelas ações substituir/cancelar.
- Biblioteca de Excel é dependência nova (segurança, tamanho de arquivo, fórmulas/macros); ler só dados, com os limites propostos (2 MB, 500 linhas, sem fórmulas e links), ajustáveis.
- Gatilhos de documento/LAIA/HIRA podem gerar muitas verificações; a regra «não duplicar se já aberta» mitiga.
- Ciclo e versão do mapa gravados no log precisam ser lidos na mesma transação da decisão.
- Esquecer os imports (`handlers.ts`, `cron.ts`) deixa o fluxo morto em silêncio.
- Perfil Qualidade sem nenhum usuário com `PROCESSO_PUBLICAR` ou `PROCESSO_VERIFICAR_REVISAO`: a atividade fica sem quem assuma; avisar na criação.

## Perguntas bloqueantes ao Eric

Nenhuma. Resolvidas em 03/10/2026: unidade do mapa = Área; rascunho separado do vigente; `Setor` é a Área; processos existentes na «Geral»; «Geral» uma por unidade; aprovador que some (substituir e cancelar); justificativa na notificação.

## Pontos a confirmar (não bloqueantes)

1. Notificação de reprovação: interpretação adotada = sino mostra a justificativa; e-mail só código do mapa e nome do reprovador. Confirmar com o Eric.
2. Renomear o modelo `Setor` para `Area` no banco: não proposto (decisão opcional já registrada no topo).
3. Limites do Excel (2 MB, 500 linhas) e uso de `exceljs`: proposta, ajustável.
4. Seletores de Área sem filtro por unidade em outros módulos: ficam fora do escopo; avaliar depois.
