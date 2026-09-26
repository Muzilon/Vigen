/* Executar: npm run test:inspecoes (requer seed). Inspeções: gating, permissão, escopo por obra, execução
 * completa com RNC real (origem INSPECAO, evidências = fotos, visível na lista de RNCs), item de ação,
 * conclusão/pendências, isolamento entre empresas e código sequencial sem duplicata em paralelo. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { enviarAnexos, listarAnexos } from "../src/lib/anexos/servico";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroNegocio } from "../src/lib/erros";
import {
  abrirRncDaResposta,
  cancelarInspecao,
  concluirInspecao,
  criarItemAcaoDaResposta,
  criarModelo,
  iniciarInspecao,
  listarInspecoes,
  obterInspecao,
  responder,
} from "../src/lib/inspecoes/servico";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { filtroAcessoRnc } from "../src/lib/rnc/servico";
import { gerarPngExemplo } from "./png-exemplo";

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

async function main() {
  const qual = await ator("qualidade@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const demo = await ator("admin@demo.com.br");
  const e = qual.empresaId;
  const alfa = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Alfa" } })).id;
  const beta = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Beta" } })).id;
  const nome = `Teste checklist ${Date.now()}`;
  const modelo = await criarModelo(qual, { nome, tipo: "SSO", notaMinima: 3 }, [
    { pergunta: "EPI em uso?", tipoResposta: "CONFORME_NAO_CONFORME_NA", obrigatorioFoto: true },
    { pergunta: "Extintor ok?", tipoResposta: "SIM_NAO" },
    { pergunta: "Limpeza", tipoResposta: "NOTA_1A5" },
    { pergunta: "Observações", tipoResposta: "TEXTO" },
  ]);
  const hoje = "2026-09-26";

  await caso("gating: empresa Demo sem o módulo não lista nem inicia", async () => {
    await assert.rejects(listarInspecoes(demo), erro(/não contratado/));
    await assert.rejects(iniciarInspecao(demo, { modeloId: modelo.id, obraId: alfa, dataInspecao: hoje }), erro(/não contratado/));
  });

  await caso("permissão: colaborador não realiza; inspetor não cria modelo", async () => {
    await assert.rejects(iniciarInspecao(colab, { modeloId: modelo.id, obraId: alfa, dataInspecao: hoje }), erro(/INSPECAO_REALIZAR/));
    await assert.rejects(criarModelo(inspetor, { nome: "x" + Date.now(), tipo: "GERAL" }), erro(/INSPECAO_GERENCIAR/));
  });

  await caso("escopo por obra: inspetor (só Alfa) não inicia na Beta nem vê inspeções da Beta", async () => {
    await assert.rejects(iniciarInspecao(inspetor, { modeloId: modelo.id, obraId: beta, dataInspecao: hoje }), erro(/Obra/));
    const ib = await iniciarInspecao(qual, { modeloId: modelo.id, obraId: beta, dataInspecao: hoje });
    assert.equal(await obterInspecao(inspetor, ib.id), null);
    assert.ok(!(await listarInspecoes(inspetor)).some((x) => x.id === ib.id));
    await cancelarInspecao(qual, ib.id, "teste de escopo");
  });

  let rncId = "";
  await caso("execução completa: NC com foto vira RNC real (origem, obra, evidência) visível em /rncs", async () => {
    const i = await iniciarInspecao(inspetor, { modeloId: modelo.id, obraId: alfa, dataInspecao: hoje });
    assert.match(i.codigo, /^INSP-\d{3}-26$/);
    const d = (await obterInspecao(inspetor, i.id))!;
    assert.equal(d.respostas.length, 4);
    const [r1, r2, r3, r4] = d.respostas;
    await responder(inspetor, r1.id, { resposta: "NAO_CONFORME", comentario: "Sem capacete" });
    await assert.rejects(concluirInspecao(inspetor, i.id), erro(/Responda|foto/));
    await enviarAnexos(inspetor, { tipo: "RESPOSTA_INSPECAO", entidadeId: r1.id }, [{ nome: "nc.png", dados: gerarPngExemplo() }]);
    await responder(inspetor, r2.id, { resposta: "SIM" });
    await responder(inspetor, r3.id, { nota: 2 });
    await responder(inspetor, r4.id, { texto: "ok" });
    await assert.rejects(abrirRncDaResposta(inspetor, r2.id, { gravidade: "BAIXA" }), erro(/não conformes/));
    const rnc = await abrirRncDaResposta(inspetor, r1.id, { gravidade: "ALTA" });
    rncId = rnc.id;
    assert.equal(rnc.origem, "INSPECAO");
    assert.equal(rnc.obraId, alfa);
    assert.equal(rnc.tipo, "SSO");
    assert.match(rnc.descricao, /EPI em uso\?/);
    assert.match(rnc.descricao, /Sem capacete/);
    const ev = await listarAnexos(inspetor, { tipo: "RNC", entidadeId: rnc.id });
    assert.equal(ev.length, 1);
    assert.equal(ev[0].nomeArquivo, "nc.png");
    assert.ok(await qual.db.rnc.findFirst({ where: { AND: [{ id: rnc.id }, filtroAcessoRnc(qual)] } }), "RNC na lista de RNCs");
    await assert.rejects(abrirRncDaResposta(inspetor, r1.id, { gravidade: "ALTA" }), erro(/já gerou/));
    await assert.rejects(responder(inspetor, r1.id, { resposta: "CONFORME" }), erro(/continuar não conforme/));
    const it = await criarItemAcaoDaResposta(inspetor, r3.id, { quemId: inspetor.usuarioId, quando: "2026-10-30" });
    const plano = await admin.planoAcao.findFirstOrThrow({ where: { itens: { some: { id: it.itemId } } } });
    assert.equal(plano.origemTipo, "INSPECAO");
    assert.equal(plano.origemId, i.id);
    const c = await concluirInspecao(inspetor, i.id);
    assert.equal(c.percentual, 33);
    const fim = (await obterInspecao(inspetor, i.id))!;
    assert.equal(fim.status, "CONCLUIDA");
    assert.equal(fim.planoAcaoId, plano.id);
    await assert.rejects(responder(inspetor, r2.id, { resposta: "NAO" }), erro(/andamento/));
  });

  await caso("isolamento: Demo não vê a inspeção nem a RNC da Monto", async () => {
    const qualquer = await admin.inspecao.findFirstOrThrow({ where: { empresaId: e } });
    assert.equal(await demo.db.inspecao.findFirst({ where: { id: qualquer.id } }), null);
    assert.equal(await demo.db.rnc.findFirst({ where: { id: rncId } }), null);
  });

  await caso("código sequencial sem duplicata em paralelo", async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, () => iniciarInspecao(qual, { modeloId: modelo.id, obraId: alfa, dataInspecao: hoje })));
    assert.equal(new Set(rs.map((r) => r.codigo)).size, 6);
    for (const r of rs) await cancelarInspecao(qual, r.id, "teste de paralelismo");
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
