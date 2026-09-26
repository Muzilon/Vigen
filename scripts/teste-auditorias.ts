/* Executar: npm run test:auditorias (requer seed). Auditorias: gating, permissão, escopo por obra, ciclo
 * planejada → execução → concluída, constatação NC virando RNC real (origem, evidência, visível em /rncs),
 * isolamento entre empresas e código sequencial sem duplicata em paralelo. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { enviarAnexos, listarAnexos } from "../src/lib/anexos/servico";
import {
  abrirRncDaConstatacao,
  adicionarItemAuditoria,
  cancelarAuditoria,
  concluirAuditoria,
  criarAuditoria,
  iniciarAuditoria,
  listarAuditorias,
  obterAuditoria,
  registrarConstatacao,
} from "../src/lib/auditorias/servico";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroNegocio } from "../src/lib/erros";
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
  const q = await ator("qualidade@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const demo = await ator("admin@demo.com.br");
  const e = q.empresaId;
  const alfa = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Alfa" } })).id;
  const beta = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Beta" } })).id;
  const base = { tipo: "INTERNA" as const, norma: "ISO 9001", escopo: "Teste", auditorLiderId: q.usuarioId, dataInicio: "2026-09-26", dataFim: "2026-09-27" };

  await caso("gating: Demo sem o módulo", async () => {
    await assert.rejects(listarAuditorias(demo), erro(/não contratado/));
  });

  await caso("permissão: inspetor/colaborador não planejam; líder sem REALIZAR não executa", async () => {
    await assert.rejects(criarAuditoria(inspetor, { ...base, auditorLiderId: inspetor.usuarioId }), erro(/AUDITORIA_GERENCIAR/));
    const au = await criarAuditoria(q, { ...base, auditorLiderId: colab.usuarioId });
    await assert.rejects(iniciarAuditoria(colab, au.id), erro(/auditor líder/));
    await cancelarAuditoria(q, au.id, "teste");
  });

  await caso("escopo por obra: inspetor (só Alfa) não vê auditoria da Beta; vê a sem obra", async () => {
    const b = await criarAuditoria(q, { ...base, obraId: beta });
    const s = await criarAuditoria(q, base);
    assert.equal(await obterAuditoria(inspetor, b.id), null);
    assert.ok(await obterAuditoria(inspetor, s.id));
    await cancelarAuditoria(q, b.id, "teste");
    await cancelarAuditoria(q, s.id, "teste");
  });

  let rncId = "";
  await caso("ciclo completo: constatação NC vira RNC real com evidência, visível em /rncs", async () => {
    const au = await criarAuditoria(q, { ...base, obraId: alfa }, [{ requisito: "7.5.3" }]);
    assert.match(au.codigo, /^AUD-\d{3}-26$/);
    await assert.rejects(registrarConstatacao(q, au.id, { tipo: "OBSERVACAO", descricao: "cedo demais" }), erro(/em execução/));
    await iniciarAuditoria(q, au.id);
    await adicionarItemAuditoria(q, au.id, { requisito: "8.5.1", pergunta: "FVS?" });
    const d = (await obterAuditoria(q, au.id))!;
    assert.equal(d.itens.length, 2);
    const obs = await registrarConstatacao(q, au.id, { tipo: "OBSERVACAO", descricao: "Observação qualquer" });
    await assert.rejects(abrirRncDaConstatacao(q, obs.id, { gravidade: "BAIXA" }), erro(/não conformidade/));
    const nc = await registrarConstatacao(q, au.id, { itemAuditoriaId: d.itens[0].id, tipo: "NAO_CONFORMIDADE", descricao: "Documento obsoleto em uso", evidencia: "Pasta X" });
    await enviarAnexos(q, { tipo: "CONSTATACAO_AUDITORIA", entidadeId: nc.id }, [{ nome: "ev.png", dados: gerarPngExemplo() }]);
    await concluirAuditoria(q, au.id, "Concluída no teste.");
    const rnc = await abrirRncDaConstatacao(q, nc.id, { gravidade: "MEDIA" });
    rncId = rnc.id;
    assert.equal(rnc.origem, "AUDITORIA_INTERNA");
    assert.equal(rnc.obraId, alfa);
    assert.match(rnc.descricao, /Requisito: 7\.5\.3/);
    assert.match(rnc.descricao, /Evidência: Pasta X/);
    assert.equal((await listarAnexos(q, { tipo: "RNC", entidadeId: rnc.id })).length, 1);
    assert.ok(await q.db.rnc.findFirst({ where: { AND: [{ id: rnc.id }, filtroAcessoRnc(q)] } }));
    await assert.rejects(abrirRncDaConstatacao(q, nc.id, { gravidade: "MEDIA" }), erro(/já gerou/));
    await assert.rejects(cancelarAuditoria(q, au.id, "x".repeat(5)), erro(/cancelada/));
  });

  await caso("externa sem obra: RNC exige obra e sai com origem AUDITORIA_EXTERNA", async () => {
    const au = await criarAuditoria(q, { ...base, tipo: "EXTERNA_CERTIFICACAO" });
    await iniciarAuditoria(q, au.id);
    const nc = await registrarConstatacao(q, au.id, { tipo: "NAO_CONFORMIDADE", descricao: "NC externa" });
    await assert.rejects(abrirRncDaConstatacao(q, nc.id, { gravidade: "ALTA" }), erro(/obra/));
    const rnc = await abrirRncDaConstatacao(q, nc.id, { gravidade: "ALTA", obraId: beta });
    assert.equal(rnc.origem, "AUDITORIA_EXTERNA");
    await concluirAuditoria(q, au.id, "Concluída.");
  });

  await caso("isolamento: Demo não vê auditoria nem RNC da Monto", async () => {
    const x = await admin.auditoria.findFirstOrThrow({ where: { empresaId: e } });
    assert.equal(await demo.db.auditoria.findFirst({ where: { id: x.id } }), null);
    assert.equal(await demo.db.rnc.findFirst({ where: { id: rncId } }), null);
  });

  await caso("código sequencial sem duplicata em paralelo", async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, () => criarAuditoria(q, base)));
    assert.equal(new Set(rs.map((r) => r.codigo)).size, 6);
    for (const r of rs) await cancelarAuditoria(q, r.id, "teste de paralelismo");
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
