# Revisão de QA das especificações do Mapa de Processos (03/10/2026)

**Revisado:** `docs/tarefas/04-regra-comum-atividades.md` e `docs/tarefas/05-mapa-de-processos-fluxo.md`, commit `78c4703`.
**Quem revisou:** `agente-qa-revisao` (somente leitura). Este arquivo resume o relatório dele; as correções ainda não foram aplicadas.
**Veredito:** APROVADO COM RESSALVAS. O desenho é coerente, mas há 1 defeito que quebra a migração e vários pontos a fechar antes da primeira fatia.

## Fatos da especificação conferidos no código
- **Confirmados:** `Setor` sem ligação com a unidade (`prisma/schema.prisma:506-524`), `HistoricoAprovacao` com `fluxoId` obrigatório (`:1083-1101`), `VersaoProcesso` (`:1185`), `publicarNaTransacao` (`src/lib/processos/servico.ts:270`), `obraNoEscopo`, `VER_TODAS_OBRAS`, o cron diário, `datas.ts`, o vínculo `processoId` com chave composta em Documento, HIRA, LAIA e Risco, `TIPOS_COM_HANDLER`, e nenhuma biblioteca de planilha no `package.json`.
- **Errado no 05:** a justificativa obrigatória na reprovação não é algo a «verificar»; já é exigida em `normalizarComentario` (`src/lib/aprovacao/regras.ts:61`).
- **Errado no 05:** `src/lib/documentos/planilha.ts` e `src/lib/hira/servico.ts` usam «setor» como texto livre, sem ligação com o modelo `Setor`.

## Crítico
1. **A migração quebra.** O 05 cria uma Área «Geral» por unidade, mas `Setor` tem `@@unique([empresaId, nome])` (`:522`): só cabe uma «Geral» por empresa, e uma «Geral» já cadastrada à mão também colide. A mesma regra impede duas unidades de terem uma área com o mesmo nome (por exemplo «Produção»). Correção: unicidade por `[empresaId, obraId, nome]`, com índice parcial para áreas antigas sem unidade (em Postgres, `NULL` não colide), e ajustar a mensagem «Já existe um setor» (`admin/servico.ts:301`).

## Alto
2. **Treinamentos.** A obrigatoriedade guarda `obrigatorioSetorIds` como lista sem chave estrangeira (`:1666`) e as telas listam todos os setores ativos. A Área «Geral» passará a aparecer nelas. Critério de aceite: contagem e matriz de treinamentos idênticas antes e depois da migração; a «Geral» nunca é atribuída a um usuário automaticamente.
3. **Seletores de setor** em incidentes, inspeções, documentos e administração não filtram por unidade. O 05 precisa dizer se isso entra ou fica fora do escopo, e testar que os registros antigos seguem aceitando `setorId`.
4. **Cadastro de área** (`salvarSetor`, `esquemaSetor`, `salvarSetorAcao`) não conhece `obraId`. Faltam validar a unidade e o escopo, bloquear a troca de unidade quando há mapa e definir o que acontece ao inativar uma área com mapa.
5. **`fluxoId` opcional** em `HistoricoAprovacao` afeta 60 pontos em 7 arquivos e aparece em duas fatias (04 e 05). Definir um dono, uma migração e um teste de regressão do motor antes de alterar a coluna.
6. **Atividade sem fluxo.** `VERIFICAR_REVISAO_MAPA` não tem fluxo de aprovação. Os dois registros precisam apontar para `fluxoId` OU `atividadeId`; `PUBLICAR_MAPA` registra com `atividadeId` e guarda `fluxoId` nos metadados.
7. **Aprovador que some** trava o fluxo em «em aprovação». Faltam a ação «cancelar revisão» para a Qualidade e a substituição de aprovador (nova etapa, registrada no log), além do destino de uma revisão aberta quando o mapa ou a área é inativado.

## Médio
8. **Dias úteis sem calendário:** definir o cálculo só com sábado e domingo e dizer que feriado cadastrado depois não recalcula prazos já gravados.
9. **Contradição 04 x 05:** o aviso de vencimento deve usar `ATIVIDADE_ACOMPANHAR` com `obraNoEscopo`, nos dois documentos.
10. **Concorrência:** `assumir` e `concluir` conferem o estado da entidade na mesma transação.
11. **`publicarNaTransacao`** incrementa a versão de todo processo, mesmo sem mudança. Definir se só os alterados ganham `VersaoProcesso`.
12. **Código de processo** é único por empresa; a importação por código pode mover processo entre mapas. Proibir código que exista em outro mapa.
13. **Idempotência da migração:** processos têm versões diferentes por linha; definir a regra e o conteúdo do `VersaoMapa` 1.
14. **Critérios não verificáveis:** listar as funções testadas («a visão normal nunca retorna o rascunho») e dar um usuário de teste do guia (§11) para «aprovador vê pelo `podeVer`».
15. **Importação de Excel:** `exceljs` é dependência nova; fixar limites numéricos (por exemplo 2 MB e 500 linhas) e proibir fórmulas e links.
16. **LGPD:** a notificação `MAPA_REPROVADO` leva a justificativa; o padrão do projeto é não colocar texto livre em notificação. Decisão do Eric.
17. **Isolamento:** faltam chaves compostas em `RevisaoMapaArquivada.revisaoMapaId` e `VerificacaoMapa.atividadeId`, escopo por `obraId` em `SolicitacaoMapa` e `VerificacaoMapa`, e a verificação de igualdade com `setor.obraId` em `SolicitacaoMapa.obraId`.

## Baixo
18. A fatia 8 (troca de rótulo) toca testes que comparam texto: rodar `npm test` completo depois dela.
19. Somar `ATIVIDADE_ACOMPANHAR` às permissões novas do 05 e dizer quem recebe `PROCESSO_PUBLICAR` no seed.
20. Sem dependência circular entre as fatias. Manter o teste dos imports dos handlers e do cron.

## Perguntas ao Eric (bloqueantes)
1. **Nome «Geral»:** uma por empresa ou uma por unidade (exige mudar a unicidade do nome de `Setor`)?
2. **Notificação de reprovação:** leva a justificativa ou só o código do mapa e o nome do reprovador?
3. **Aprovador que sai da empresa durante o ciclo:** a Qualidade o substitui, cancela a revisão, ou as duas coisas?
