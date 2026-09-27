/* Executar: npm run test:indicadores (requer seed). Indicadores com meta (P7): gating, permissão (gerencia × responsável),
 * lançamento com correção append-only, período inválido/futuro, indicador automático calculando o valor real (RNC e
 * Plano de Ação), alerta "sem lançamento" pelo cron (idempotente), isolamento entre empresas e resumo do dashboard. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { hojeNoFuso, paraDataDb } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroNegocio } from "../src/lib/erros";
import { calcularAutomatico, calcularEficaciaPrimeiraVerificacao, calcularItensAtrasados } from "../src/lib/indicadores/automaticos";
import {
  calcularValorIndicador,
  criarIndicador,
  definirAtivoIndicador,
  editarIndicador,
  lancarResultado,
  listarIndicadores,
  obterIndicador,
  registrarResultadoAutomatico,
  resumoIndicadores,
} from "../src/lib/indicadores/gestao";
import { limitesPeriodo, periodoDaData, ultimoPeriodoFechado } from "../src/lib/indicadores/periodos";
import "../src/lib/indicadores/reavaliacao";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { criarPlanoManual } from "../src/lib/plano-acao/servico";
import { fontesReavaliacao, gerarAlertasReavaliacao } from "../src/lib/reavaliacao/fontes";

const admin = new PrismaClient();
let ok = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log("  OK", nome);
}
async function ator(email: string): Promise<Ator> {
  const u = await admin.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return { db: criarDbTenant(u.empresaId, admin), empresaId: u.empresaId, usuarioId: u.id, permissoes, obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId) };
}
const erro = (re: RegExp) => (e: unknown) => e instanceof ErroNegocio && re.test(e.message);
const FUSO = "America/Sao_Paulo";
const hoje = hojeNoFuso(FUSO);
const sufixo = Date.now().toString(36);
const criados: string[] = [];

async function main() {
  const q = await ator("qualidade@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const demo = await ator("admin@demo.com.br");
  const e = q.empresaId;
  const base = { unidade: "%", direcao: "MAIOR_MELHOR" as const, meta: 90, periodicidade: "MENSAL" as const };
  const novo = async (nome: string, extra: Partial<Parameters<typeof criarIndicador>[1]> = {}) => {
    const r = await criarIndicador(q, { ...base, nome: `${nome} ${sufixo}`, ...extra });
    criados.push(r.id);
    return r.id;
  };
  const ultimo = ultimoPeriodoFechado(hoje, "MENSAL");

  await caso("gating: Demo sem o módulo", async () => {
    await assert.rejects(listarIndicadores(demo), erro(/não contratado/));
    assert.equal(await resumoIndicadores(demo), null);
  });

  await caso("permissão: só INDICADOR_GERENCIAR cadastra; responsável sem a permissão lança; outro não", async () => {
    await assert.rejects(criarIndicador(inspetor, { ...base, nome: "x" }), erro(/INDICADOR_GERENCIAR/));
    await assert.rejects(criarIndicador(colab, { ...base, nome: "x" }), erro(/INDICADOR_GERENCIAR/));
    const id = await novo("Permissão", { responsavelId: inspetor.usuarioId });
    await lancarResultado(inspetor, id, { periodo: ultimo, valor: 95 });
    await assert.rejects(lancarResultado(colab, id, { periodo: ultimo, valor: 1, observacao: "x" }), erro(/Sem permissão/));
    await assert.rejects(editarIndicador(inspetor, id, { ...base, nome: "y" }), erro(/INDICADOR_GERENCIAR/));
    const i = (await obterIndicador(inspetor, id))!;
    assert.equal(i.situacao, "ATINGIDO");
    // nome duplicado
    await assert.rejects(criarIndicador(q, { ...base, nome: `Permissão ${sufixo}` }), erro(/Já existe/));
  });

  await caso("lançamento: período inválido/futuro negado; correção exige observação e o mais recente vale", async () => {
    const id = await novo("Correção", { direcao: "MENOR_MELHOR", meta: 3 });
    await assert.rejects(lancarResultado(q, id, { periodo: "2026-T1", valor: 1 }), erro(/inválido/));
    await assert.rejects(lancarResultado(q, id, { periodo: "2999-01", valor: 1 }), erro(/futuro/));
    await lancarResultado(q, id, { periodo: ultimo, valor: 2.5 });
    await assert.rejects(lancarResultado(q, id, { periodo: ultimo, valor: 3.5 }), erro(/motivo da correção/));
    const c = await lancarResultado(q, id, { periodo: ultimo, valor: 3.5, observacao: "valor revisado" });
    assert.equal(c.correcao, true);
    const i = (await obterIndicador(q, id))!;
    assert.equal(i.resultados.length, 2);
    assert.equal(i.resultado!.valor, 3.5);
    assert.equal(i.situacao, "NAO_ATINGIDO");
    // editar a meta não altera o que já foi lançado (meta gravada no lançamento)
    await editarIndicador(q, id, { ...base, nome: `Correção ${sufixo}`, direcao: "MENOR_MELHOR", meta: 4 }, 0);
    assert.equal((await obterIndicador(q, id))!.situacao, "NAO_ATINGIDO");
    await assert.rejects(editarIndicador(q, id, { ...base, nome: `Correção ${sufixo}`, direcao: "MENOR_MELHOR", meta: 5 }, 0), /alterado por outra pessoa/);
  });

  await caso("resultado é append-only (trigger bloqueia UPDATE/DELETE)", async () => {
    const r = await admin.resultadoIndicador.findFirstOrThrow({ where: { empresaId: e } });
    await assert.rejects(admin.resultadoIndicador.update({ where: { id: r.id }, data: { valor: 0 } }), /imutável/);
    await assert.rejects(admin.resultadoIndicador.delete({ where: { id: r.id } }), /imutável/);
  });

  await caso("automático (Plano de Ação): calcula o valor real dos itens do período", async () => {
    // Plano com 2 itens; o prazo de um deles é levado a um mês passado e fica pendente (atrasado).
    const quando = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const plano = await criarPlanoManual(q, { titulo: `Plano teste indicador ${sufixo}`, itens: [{ oQue: "Ação atrasada", quemId: q.usuarioId, quando }, { oQue: "Ação cancelada", quemId: q.usuarioId, quando }] });
    const itens = await admin.itemAcao.findMany({ where: { planoAcaoId: plano.id }, orderBy: { ordem: "asc" } });
    const mesPassado = "2019-03";
    await admin.itemAcao.update({ where: { id: itens[0].id }, data: { quando: paraDataDb("2019-03-15") } });
    await admin.itemAcao.update({ where: { id: itens[1].id }, data: { quando: paraDataDb("2019-03-20"), status: "CANCELADO" } });
    const id = await novo("Atrasados", { fonte: "PLANO_ITENS_ATRASADOS", direcao: "MENOR_MELHOR", meta: 15, unidade: "ignorada" });
    const lim = limitesPeriodo(mesPassado, "MENSAL");
    const esperados = await admin.itemAcao.findMany({ where: { empresaId: e, quando: { gte: paraDataDb(lim.inicio), lte: paraDataDb(lim.fim) } }, select: { status: true, quando: true, dataConclusao: true } });
    const esperado = calcularItensAtrasados(esperados, lim, hoje, FUSO);
    assert.ok(esperado !== null && esperado > 0);
    assert.equal(await calcularValorIndicador(q, id, mesPassado), esperado);
    const r = await registrarResultadoAutomatico(q, id, mesPassado);
    assert.equal(r.valor, esperado);
    const i = (await obterIndicador(q, id))!;
    assert.equal(i.unidade, "%"); // unidade fixa dos automáticos
    assert.equal(i.resultados[0].automatico, true);
    await assert.rejects(lancarResultado(q, id, { periodo: mesPassado, valor: 1 }), erro(/automático/));
    // isolamento do cálculo: a Demo não enxerga os itens da Monto
    assert.equal(await calcularAutomatico({ db: demo.db }, "PLANO_ITENS_ATRASADOS", lim, hoje, FUSO), null);
  });

  await caso("automático (RNC): % eficaz na 1ª verificação confere com as verificações reais do mês", async () => {
    const id = await novo("Eficácia", { fonte: "RNC_EFICACIA_PRIMEIRA_VERIFICACAO", meta: 80 });
    const atual = periodoDaData(hoje, "MENSAL");
    const lim = limitesPeriodo(atual, "MENSAL");
    const vs = await admin.verificacaoEficacia.findMany({ where: { empresaId: e, tentativa: 1 }, select: { resultado: true, verificadoEm: true } });
    const esperado = calcularEficaciaPrimeiraVerificacao(vs.map((v) => ({ eficaz: v.resultado === "EFICAZ", verificadoEm: v.verificadoEm })), lim, FUSO);
    assert.equal(await calcularValorIndicador(q, id, atual), esperado);
    await assert.rejects(calcularValorIndicador(q, criados[0], atual), erro(/manual/));
  });

  await caso("alerta: indicador sem lançamento no último período gera INDICADOR_SEM_LANCAMENTO (idempotente)", async () => {
    const pendente = await novo("Alerta", { responsavelId: inspetor.usuarioId });
    const lancado = await novo("Alerta lançado", { responsavelId: inspetor.usuarioId });
    await lancarResultado(q, lancado, { periodo: ultimo, valor: 99 });
    const fonte = fontesReavaliacao(["INDICADORES"])[0];
    assert.ok(fonte && fonte.tipoNotificacao === "INDICADOR_SEM_LANCAMENTO");
    const empresa = { id: e, fusoHorario: FUSO, modulosAtivos: ["INDICADORES" as const] };
    const itens = await fonte.listarVencendo(q.db, empresa, hoje, 15);
    assert.ok(itens.some((x) => x.entidadeId === pendente));
    assert.ok(!itens.some((x) => x.entidadeId === lancado));
    await gerarAlertasReavaliacao(q.db, empresa, hoje);
    const n1 = await admin.notificacao.count({ where: { empresaId: e, usuarioId: inspetor.usuarioId, tipo: "INDICADOR_SEM_LANCAMENTO", link: `/indicadores/${pendente}` } });
    assert.equal(n1, 1);
    await gerarAlertasReavaliacao(q.db, empresa, hoje);
    assert.equal(await admin.notificacao.count({ where: { empresaId: e, usuarioId: inspetor.usuarioId, tipo: "INDICADOR_SEM_LANCAMENTO", link: `/indicadores/${pendente}` } }), 1);
    // inativo não alerta nem aceita lançamento
    await definirAtivoIndicador(q, pendente, false);
    assert.ok(!(await fonte.listarVencendo(q.db, empresa, hoje, 15)).some((x) => x.entidadeId === pendente));
    await assert.rejects(lancarResultado(q, pendente, { periodo: ultimo, valor: 1 }), erro(/inativo/));
  });

  await caso("isolamento: Demo não vê indicador nem resultados da Monto", async () => {
    const x = await admin.indicador.findFirstOrThrow({ where: { empresaId: e } });
    assert.equal(await demo.db.indicador.findFirst({ where: { id: x.id } }), null);
    assert.equal(await demo.db.resultadoIndicador.count({ where: { indicadorId: x.id } }), 0);
  });

  await caso("listas, processo e dashboard", async () => {
    const meus = await listarIndicadores(inspetor, { responsavelId: inspetor.usuarioId });
    assert.ok(meus.every((i) => i.responsavelId === inspetor.usuarioId));
    const r = await resumoIndicadores(q);
    assert.ok(r && r.total > 0 && r.atingidos + r.naoAtingidos + r.semLancamento === r.total);
    const seed = await listarIndicadores(q);
    assert.ok(seed.some((i) => i.situacao === "SEM_LANCAMENTO"));
    assert.ok(seed.some((i) => i.situacao === "ATINGIDO"));
    assert.ok(seed.some((i) => i.situacao === "NAO_ATINGIDO"));
    assert.ok(seed.every((i) => i.periodoReferencia === ultimoPeriodoFechado(hoje, i.periodicidade)));
  });

  for (const id of criados) await definirAtivoIndicador(q, id, false).catch(() => undefined);
  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
