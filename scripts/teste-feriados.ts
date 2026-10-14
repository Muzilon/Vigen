/* Executar: npm run test:feriados (requer seed). Feriados da empresa: permissão, versão, isolamento. Limpa o que criou. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroConflito, ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import {
  carregarFeriados,
  criarFeriado,
  editarFeriado,
  faltaFeriadoNoAnoCorrente,
  inativarFeriado,
  listarFeriados,
} from "../src/lib/feriados/servico";

const admin = new PrismaClient();
let ok = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log("  OK", nome);
}

async function ator(email: string): Promise<Ator> {
  const u = await admin.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  return {
    db: criarDbTenant(u.empresaId, admin),
    empresaId: u.empresaId,
    usuarioId: u.id,
    permissoes: permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []),
    obrasPermitidas: null,
  };
}

// Ano aleatório distante, para não colidir com dados reais nem entre execuções.
const ano = 3000 + Math.floor(Math.random() * 5000);
const dia = (m: number, d: number) => `${ano}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const sufixo = Math.random().toString(36).slice(2, 8);

async function main() {
  const eu = await ator("admin@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const demo = await ator("admin@demo.com.br");
  assert.ok(!colab.permissoes.includes("ADMIN_CONFIG"));
  const ids: string[] = [];

  try {
    console.log("Feriados:");
    let f1 = { id: "", versao: 1 };
    await caso("cria e lista (ordenado por data)", async () => {
      const b = await criarFeriado(eu, { data: dia(12, 25), descricao: `Natal ${sufixo}` });
      const a = await criarFeriado(eu, { data: dia(1, 1), descricao: `Ano novo ${sufixo}` });
      ids.push(a.id, b.id);
      const l = await listarFeriados(eu, { ano });
      assert.deepEqual(l.map((x) => x.data), [dia(1, 1), dia(12, 25)]);
      f1 = { id: a.id, versao: l[0].versao };
      assert.ok((await carregarFeriados(eu)).has(dia(12, 25)));
    });
    await caso("data duplicada ativa e dados inválidos são recusados", async () => {
      await assert.rejects(criarFeriado(eu, { data: dia(1, 1), descricao: "x" }), ErroNegocio);
      await assert.rejects(criarFeriado(eu, { data: "2026-02-30", descricao: "x" }), ErroNegocio);
      await assert.rejects(criarFeriado(eu, { data: dia(3, 3), descricao: "  " }), ErroNegocio);
    });
    await caso("sem ADMIN_CONFIG é negado em todas as operações", async () => {
      await assert.rejects(criarFeriado(colab, { data: dia(5, 5), descricao: "x" }), ErroNegocio);
      await assert.rejects(editarFeriado(colab, f1.id, f1.versao, { data: dia(1, 1), descricao: "x" }), ErroNegocio);
      await assert.rejects(inativarFeriado(colab, f1.id, f1.versao), ErroNegocio);
      await assert.rejects(listarFeriados(colab), ErroNegocio);
      await assert.rejects(faltaFeriadoNoAnoCorrente(colab), ErroNegocio);
    });
    await caso("editar incrementa versao; versao velha dá ErroConflito", async () => {
      await editarFeriado(eu, f1.id, f1.versao, { data: dia(1, 1), descricao: `Confraternização ${sufixo}` });
      await assert.rejects(editarFeriado(eu, f1.id, f1.versao, { data: dia(1, 1), descricao: "outra" }), ErroConflito);
      const l = await listarFeriados(eu, { ano });
      assert.equal(l[0].versao, f1.versao + 1);
      f1.versao++;
    });
    await caso("isolamento: Demo não vê nem altera feriado da Monto", async () => {
      assert.equal((await listarFeriados(demo, { ano })).length, 0);
      assert.equal((await carregarFeriados(demo)).size, 0);
      await assert.rejects(inativarFeriado(demo, f1.id, f1.versao), ErroNegocio);
      await assert.rejects(editarFeriado(demo, f1.id, f1.versao, { data: dia(1, 1), descricao: "x" }), ErroNegocio);
    });
    await caso("inativar some da lista ativa, aparece com incluirInativos e conflita se repetido", async () => {
      await inativarFeriado(eu, f1.id, f1.versao);
      assert.equal((await listarFeriados(eu, { ano })).length, 1);
      assert.equal((await listarFeriados(eu, { ano, incluirInativos: true })).length, 2);
      await assert.rejects(inativarFeriado(eu, f1.id, f1.versao), ErroConflito);
      assert.ok(!(await carregarFeriados(eu)).has(dia(1, 1)));
    });
    await caso("recadastrar data inativa reativa a mesma linha", async () => {
      const r = await criarFeriado(eu, { data: dia(1, 1), descricao: `Ano novo 2 ${sufixo}` });
      assert.equal(r.id, f1.id);
      assert.equal((await listarFeriados(eu, { ano })).length, 2);
    });
    await caso("aviso de ano corrente sem feriado", async () => {
      assert.equal(await faltaFeriadoNoAnoCorrente(eu, new Date(Date.UTC(ano, 5, 15, 12))), false);
      assert.equal(await faltaFeriadoNoAnoCorrente(eu, new Date(Date.UTC(ano + 1, 5, 15, 12))), true);
      assert.equal(await faltaFeriadoNoAnoCorrente(demo, new Date(Date.UTC(ano, 5, 15, 12))), true);
    });
    await caso("FK composta: criadoPorId de outra empresa é rejeitado pelo banco", async () => {
      await assert.rejects(
        admin.feriadoEmpresa.create({
          data: { empresaId: eu.empresaId, data: new Date(Date.UTC(ano, 8, 9)), descricao: "x", criadoPorId: demo.usuarioId },
        }),
      );
    });
  } finally {
    await admin.feriadoEmpresa.deleteMany({ where: { id: { in: ids } } });
    await admin.$disconnect();
  }
  console.log(`\n${ok} casos OK`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
