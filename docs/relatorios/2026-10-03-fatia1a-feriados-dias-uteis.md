# Fatia 1a: feriados + dias úteis (dados e serviço)

## O que foi feito
- Modelo `FeriadoEmpresa` (`feriado_empresa`): id, empresaId, data (Date), descricao, ativo, versao, criadoPorId?, criadoEm, atualizadoEm; `@@unique([empresaId, id])`, `@@unique([empresaId, data])`; FK composta `(empresaId, criadoPorId) -> usuario(empresaId, id)`, Restrict. Migração aditiva `20261003000000_feriado_empresa` (CHECK `versao >= 1` e descricao não vazia).
- `somarDiasUteis`, `diasUteisEntre`, `ehDiaUtil` em `src/lib/datas.ts` (puras, sobre datas civis; JSDoc diz que prazo gravado não é recalculado).
- Serviço `src/lib/feriados/servico.ts`: `listarFeriados`, `criarFeriado`, `editarFeriado`, `inativarFeriado` (trava por `versao`, `ErroConflito`), `carregarFeriados` (Set para o cálculo; sem checagem de admin, para uso por outros serviços), `faltaFeriadoNoAnoCorrente` (aviso, ano no fuso da empresa).

## Decisões
- Permissão: reutiliza `ADMIN_CONFIG` (doc 04); não há permissão nova.
- Unicidade: `[empresaId, data]` total (doc 04), não parcial. Recadastrar data inativa reativa a mesma linha.
- Campo `descricao` (doc 04) em vez de `nome`; `ativo` e `versao` pedidos na tarefa.
- Sem tabela de histórico: o doc 04 só pede tabela por linha; criadoPorId/criadoEm/atualizadoEm cobrem.
- `n < 0` em `somarDiasUteis` lança RangeError.

## Arquivos
prisma/schema.prisma; prisma/migrations/20261003000000_feriado_empresa/migration.sql; src/lib/datas.ts; src/lib/feriados/servico.ts; tests/dias-uteis.test.ts; scripts/teste-feriados.ts; scripts/teste-isolamento.ts (+1 caso); package.json (`test:feriados`).

## Comandos e resultado (Postgres 16 local, banco `vigen_dev`, URLs só como variáveis de ambiente)
- `npm ci`: ok. `prisma format`, `migrate deploy` (todas as migrações), `generate`, `db seed`: ok.
- `npx tsc --noEmit -p .`: verde, depois de `npx next typegen` (sem ele aparecem erros preexistentes de PageProps/LayoutProps/RouteContext, alheios a esta tarefa).
- `npx eslint` nos arquivos criados/alterados: verde.
- `npm test`: 30 arquivos, 243 testes, verde.
- `npm run test:feriados`: 9 casos verdes, rodado duas vezes.
- `npm run test:isolamento`: 12 casos verdes.

## Não verificado
- Tela em Configurações (fica para o agente-ux-ui); não rodei os demais `test:<modulo>` nem revisão do agente-qa-revisao.
- Ainda pendente para a tela: server actions chamando o serviço e exibição do aviso `faltaFeriadoNoAnoCorrente`.
