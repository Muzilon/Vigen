/* Executar: npm run test:isolamento (requer seed). */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { criarDbTenant, ErroTenant } from "../src/lib/db-tenant";

const admin = new PrismaClient();
let ok = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log("  OK", nome);
}

async function main() {
  const monto = await admin.empresa.findUniqueOrThrow({ where: { cnpj: "00000000000100" } });
  const demo = await admin.empresa.findUniqueOrThrow({ where: { cnpj: "00000000000200" } });
  const db = criarDbTenant(demo.id, admin);
  const obraMonto = await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: monto.id } });
  const usuarioMonto = await admin.usuario.findUniqueOrThrow({ where: { email: "admin@monto.com.br" } });

  console.log("Isolamento multi-tenant (contexto = Demo):");
  await caso("findMany usuarios so retorna Demo", async () => {
    const us = await db.usuario.findMany();
    assert.ok(us.length > 0);
    assert.ok(us.every((u) => u.empresaId === demo.id));
  });
  await caso("findUnique por e-mail da Monto retorna null", async () => {
    assert.equal(await db.usuario.findUnique({ where: { email: "admin@monto.com.br" } }), null);
  });
  await caso("findFirst com empresaId explicito da Monto retorna null", async () => {
    assert.equal(await db.obraUnidade.findFirst({ where: { empresaId: monto.id } }), null);
  });
  await caso("count/aggregate/groupBy nao contam Monto", async () => {
    assert.equal(await db.obraUnidade.count(), 1);
    const g = await db.usuario.groupBy({ by: ["empresaId"], _count: true });
    assert.deepEqual(
      g.map((x) => x.empresaId),
      [demo.id],
    );
    const a = await db.setor.aggregate({ _count: { _all: true } });
    assert.equal(a._count._all, 0);
  });
  await caso("update/updateMany/delete em registro da Monto nao afetam", async () => {
    const r = await db.obraUnidade.updateMany({ where: { id: obraMonto.id }, data: { endereco: "hack" } });
    assert.equal(r.count, 0);
    await assert.rejects(db.obraUnidade.update({ where: { id: obraMonto.id }, data: { endereco: "hack" } }));
    await assert.rejects(db.usuario.delete({ where: { id: usuarioMonto.id } }));
    assert.equal((await db.usuario.deleteMany({ where: { id: usuarioMonto.id } })).count, 0);
    const intacta = await admin.obraUnidade.findUniqueOrThrow({ where: { id: obraMonto.id } });
    assert.notEqual(intacta.endereco, "hack");
  });
  await caso("feriado_empresa: Demo nao ve feriado da Monto", async () => {
    const f = await admin.feriadoEmpresa.create({
      data: { empresaId: monto.id, data: new Date(Date.UTC(2999, 0, 1 + Math.floor(Math.random() * 300))), descricao: "isolamento" },
    });
    try {
      assert.equal(await db.feriadoEmpresa.count({ where: { id: f.id } }), 0);
      assert.equal((await db.feriadoEmpresa.updateMany({ where: { id: f.id }, data: { ativo: false } })).count, 0);
    } finally {
      await admin.feriadoEmpresa.delete({ where: { id: f.id } });
    }
  });
  await caso("create forca empresaId da Demo", async () => {
    const s = await db.setor.create({ data: { nome: `Teste ${Date.now()}` } as never });
    assert.equal(s.empresaId, demo.id);
    await admin.setor.delete({ where: { id: s.id } });
  });
  await caso("create com empresaId da Monto e rejeitado", async () => {
    await assert.rejects(db.setor.create({ data: { empresaId: monto.id, nome: "x" } }), ErroTenant);
  });
  await caso("createMany forca empresaId", async () => {
    const nome = `Lote ${Date.now()}`;
    await db.setor.createMany({ data: [{ nome } as never] });
    const s = await admin.setor.findFirstOrThrow({ where: { nome } });
    assert.equal(s.empresaId, demo.id);
    await admin.setor.delete({ where: { id: s.id } });
  });
  await caso("upsert sobre registro da Monto cria na Demo (Monto intacta)", async () => {
    const r = await db.obraUnidade.upsert({
      where: { id: obraMonto.id },
      update: { endereco: "hack" },
      create: { nome: `Upsert ${Date.now()}` } as never,
    });
    assert.equal(r.empresaId, demo.id);
    assert.notEqual(r.id, obraMonto.id);
    await admin.obraUnidade.delete({ where: { id: r.id } });
  });
  await caso("update nao pode trocar empresaId", async () => {
    await assert.rejects(db.obraUnidade.updateMany({ data: { empresaId: monto.id } }), ErroTenant);
  });
  await caso("Empresa: so enxerga a propria", async () => {
    assert.equal(await db.empresa.findUnique({ where: { id: monto.id } }), null);
    assert.equal((await db.empresa.findFirst())?.id, demo.id);
  });
  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exit(1);
  })
  .finally(() => admin.$disconnect());
