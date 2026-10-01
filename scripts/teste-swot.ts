/* Executar: npm run test:swot (requer seed). SWOT + partes interessadas: CRUD, ano único,
 * ciclo encerrado, copiar ciclo anterior, SWOT → risco/oportunidade, gating, permissão e isolamento. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import {
  adicionarItem,
  adicionarParte,
  copiarCicloAnterior,
  criarCiclo,
  editarCiclo,
  editarItem,
  editarParte,
  gerarRiscoDoItem,
  listarCiclos,
  obterCiclo,
  removerItem,
  removerParte,
} from "../src/lib/swot/servico";

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
  return {
    db: criarDbTenant(u.empresaId, admin),
    empresaId: u.empresaId,
    usuarioId: u.id,
    permissoes,
    obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId),
  };
}

const erro = (re: RegExp) => (e: unknown) => e instanceof ErroNegocio && re.test(e.message);

async function main() {
  const qualidade = await ator("qualidade@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const adminDemo = await ator("admin@demo.com.br");
  const ANO = 2091;
  const monto = qualidade.empresaId;
  // Limpa sobras de execuções anteriores (ciclos de teste nos anos 2090/2091).
  const sobras = await admin.cicloSwot.findMany({ where: { ano: { in: [ANO - 1, ANO] } }, select: { id: true } });
  await admin.itemSwot.deleteMany({ where: { cicloId: { in: sobras.map((s) => s.id) } } });
  await admin.cicloSwot.deleteMany({ where: { id: { in: sobras.map((s) => s.id) } } });
  const riscosCriados: string[] = [];

  try {
    await caso("permissão: Qualidade tem SWOT_GERENCIAR; colaborador não escreve (mas lê)", async () => {
      assert.ok(qualidade.permissoes.includes("SWOT_GERENCIAR"));
      await assert.rejects(criarCiclo(colab, { ano: ANO }), erro(/SWOT_GERENCIAR/));
      assert.ok((await listarCiclos(colab)).some((c) => c.ano === 2026), "lê o ciclo do seed");
    });

    let c1 = "";
    let fraqueza = "";
    let forca = "";
    await caso("ciclo: criar, ano único por empresa; itens por quadrante ordenados por relevância", async () => {
      c1 = (await criarCiclo(qualidade, { ano: ANO - 1, titulo: "Ciclo teste" })).id;
      await assert.rejects(criarCiclo(qualidade, { ano: ANO - 1 }), erro(/Já existe/));
      fraqueza = (await adicionarItem(qualidade, c1, { quadrante: "FRAQUEZA", descricao: "Processo manual lento", relevancia: 2 })).id;
      await adicionarItem(qualidade, c1, { quadrante: "FRAQUEZA", descricao: "Fornecedor único", relevancia: 5 });
      forca = (await adicionarItem(qualidade, c1, { quadrante: "FORCA", descricao: "Equipe experiente", relevancia: 4 })).id;
      await assert.rejects(adicionarItem(qualidade, c1, { quadrante: "AMEACA", descricao: "x y", relevancia: 9 }), erro(/1 a 5/));
      const c = (await obterCiclo(qualidade, c1))!;
      const fraquezas = c.itens.filter((i) => i.quadrante === "FRAQUEZA");
      assert.deepEqual(fraquezas.map((i) => i.relevancia), [5, 2]);
      await editarItem(qualidade, fraqueza, { quadrante: "FRAQUEZA", descricao: "Processo manual e lento", relevancia: 3 });
      assert.equal((await admin.itemSwot.findUniqueOrThrow({ where: { id: fraqueza } })).descricao, "Processo manual e lento");
    });

    await caso("partes interessadas: adicionar, editar, remover; escala 1–5", async () => {
      const p = (await adicionarParte(qualidade, c1, { nome: "Clientes", influencia: 5, interesse: 4, necessidades: "Prazo" })).id;
      await adicionarParte(qualidade, c1, { nome: "Vizinhança", influencia: 2, interesse: 3 });
      await assert.rejects(adicionarParte(qualidade, c1, { nome: "Inválida", influencia: 6, interesse: 1 }), erro(/Influência/));
      await editarParte(qualidade, p, { nome: "Clientes finais", influencia: 5, interesse: 5 });
      const c = (await obterCiclo(qualidade, c1))!;
      assert.equal(c.partesInteressadas[0].nome, "Clientes finais");
      const temp = (await adicionarParte(qualidade, c1, { nome: "Temporária", influencia: 1, interesse: 1 })).id;
      await removerParte(qualidade, temp);
      assert.equal((await obterCiclo(qualidade, c1))!.partesInteressadas.length, 2);
    });

    await caso("SWOT → risco: fraqueza gera RISCO, força gera OPORTUNIDADE, pré-preenchido e vinculado", async () => {
      const r = await gerarRiscoDoItem(qualidade, fraqueza, { probabilidade: 3, impacto: 3 });
      riscosCriados.push(r.id);
      const risco = await admin.riscoOportunidade.findUniqueOrThrow({ where: { id: r.id } });
      assert.equal(risco.tipo, "RISCO");
      assert.equal(risco.descricao, "Processo manual e lento");
      assert.equal(risco.faixa, "MEDIO");
      assert.equal((await admin.itemSwot.findUniqueOrThrow({ where: { id: fraqueza } })).riscoOportunidadeId, r.id);
      await assert.rejects(gerarRiscoDoItem(qualidade, fraqueza, { probabilidade: 1, impacto: 1 }), erro(/já está vinculado/));
      const o = await gerarRiscoDoItem(qualidade, forca, { probabilidade: 2, impacto: 4, descricao: "Aproveitar equipe em novos mercados" });
      riscosCriados.push(o.id);
      const op = await admin.riscoOportunidade.findUniqueOrThrow({ where: { id: o.id } });
      assert.equal(op.tipo, "OPORTUNIDADE");
      assert.equal(op.descricao, "Aproveitar equipe em novos mercados");
      assert.equal(await admin.historicoRiscoOportunidade.count({ where: { riscoId: o.id, acao: "CRIACAO" } }), 1);
    });

    await caso("copiar ciclo anterior: itens e partes copiados, sem vínculo com riscos", async () => {
      const r = await copiarCicloAnterior(qualidade, ANO);
      assert.equal(r.anoOrigem, ANO - 1);
      const [orig, novo] = [(await obterCiclo(qualidade, c1))!, (await obterCiclo(qualidade, r.id))!];
      assert.equal(novo.itens.length, orig.itens.length);
      assert.equal(novo.partesInteressadas.length, orig.partesInteressadas.length);
      assert.ok(novo.itens.every((i) => i.riscoOportunidadeId === null));
      await assert.rejects(copiarCicloAnterior(qualidade, ANO), erro(/Já existe/));
    });

    await caso("ciclo encerrado é somente leitura; reabrir libera", async () => {
      await editarCiclo(qualidade, c1, { encerrado: true });
      await assert.rejects(adicionarItem(qualidade, c1, { quadrante: "AMEACA", descricao: "Nova lei", relevancia: 3 }), erro(/encerrado/));
      await assert.rejects(removerItem(qualidade, fraqueza), erro(/encerrado/));
      await editarCiclo(qualidade, c1, { encerrado: false });
      await adicionarItem(qualidade, c1, { quadrante: "AMEACA", descricao: "Nova lei", relevancia: 3 });
    });

    await caso("gating: Demo sem SWOT → negado; com SWOT mas sem Riscos não gera risco", async () => {
      await assert.rejects(listarCiclos(adminDemo), erro(/não contratado/));
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: [...demo.modulosAtivos, "SWOT"] } });
      try {
        const cd = (await criarCiclo(adminDemo, { ano: ANO })).id;
        const it = (await adicionarItem(adminDemo, cd, { quadrante: "AMEACA", descricao: "Concorrência", relevancia: 3 })).id;
        await assert.rejects(gerarRiscoDoItem(adminDemo, it, { probabilidade: 1, impacto: 1 }), erro(/Ameaças e Oportunidades não contratado/));
        await admin.itemSwot.deleteMany({ where: { cicloId: cd } });
        await admin.cicloSwot.delete({ where: { id: cd } });
      } finally {
        await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: demo.modulosAtivos } });
      }
    });

    await caso("isolamento: Demo (com SWOT) não vê nem altera ciclo/itens da Monto", async () => {
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: [...demo.modulosAtivos, "SWOT"] } });
      try {
        assert.equal(await obterCiclo(adminDemo, c1), null);
        assert.ok(!(await listarCiclos(adminDemo)).some((c) => c.id === c1));
        await assert.rejects(adicionarItem(adminDemo, c1, { quadrante: "FORCA", descricao: "Invasão", relevancia: 1 }), erro(/não encontrado/));
        await assert.rejects(editarItem(adminDemo, forca, { quadrante: "FORCA", descricao: "Invasão", relevancia: 1 }), erro(/não encontrado/));
        await assert.rejects(removerItem(adminDemo, forca), erro(/não encontrado/));
        await assert.rejects(copiarCicloAnterior(adminDemo, 2099), erro(/Não há ciclo anterior/));
      } finally {
        await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: demo.modulosAtivos } });
      }
    });
  } finally {
    const ciclos = await admin.cicloSwot.findMany({ where: { empresaId: monto, ano: { in: [ANO - 1, ANO] } }, select: { id: true } });
    await admin.itemSwot.deleteMany({ where: { cicloId: { in: ciclos.map((c) => c.id) } } });
    await admin.cicloSwot.deleteMany({ where: { id: { in: ciclos.map((c) => c.id) } } });
    await admin.riscoOportunidade.updateMany({ where: { id: { in: riscosCriados } }, data: { ativo: false } });
    await admin.$disconnect();
  }
  console.log(`\n${ok} casos OK (SWOT e partes interessadas).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
