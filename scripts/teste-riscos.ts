/* Executar: npm run test:riscos (requer seed). Riscos e oportunidades: CRUD, gating, permissão,
 * histórico imutável, plano de ação gerado, reavaliação/revisão geral, aprovação aplicada pelo
 * ponto de entrada de /aprovacoes (item 0) e isolamento entre empresas. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroConflito, ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { fontesReavaliacao } from "../src/lib/reavaliacao";
import "../src/lib/riscos/reavaliacao";
import {
  alterarStatus,
  contarPorFaixa,
  criarRisco,
  definirTratamento,
  editarRisco,
  excluirRisco,
  gerarPlanoAcao,
  listarHistorico,
  listarRiscos,
  obterRisco,
  reavaliar,
  revisaoGeral,
  solicitarAlteracao,
} from "../src/lib/riscos/servico";

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
const prazo = "2027-01-31";

/**
 * Modo filho (item 0): processo novo que carrega SÓ o módulo de actions de /aprovacoes (como o
 * servidor ao receber o POST de "Aprovar") e decide o fluxo. Se o handler não estiver
 * registrado por esse import, o fluxo conclui sem aplicar a alteração.
 */
async function modoFilho(fluxoId: string, email: string) {
  await import("../src/app/(app)/aprovacoes/actions");
  const { decidir } = await import("../src/lib/aprovacao");
  const r = await decidir(await ator(email), fluxoId, { decisao: "APROVAR" });
  console.log(JSON.stringify(r));
  await admin.$disconnect();
}

async function main() {
  const qualidade = await ator("qualidade@monto.com.br");
  const adminMonto = await ator("admin@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const adminDemo = await ator("admin@demo.com.br");
  const proc = await admin.processo.findFirstOrThrow({ where: { empresaId: qualidade.empresaId, codigo: "PF-03" } });
  const criados: string[] = [];

  try {
    await caso("item 0: handlers.ts registra todos; /aprovacoes importa handlers", async () => {
      const { handlersRegistrados, TIPOS_COM_HANDLER } = await import("../src/lib/aprovacao/handlers");
      assert.deepEqual(handlersRegistrados(), [...TIPOS_COM_HANDLER]);
      assert.ok(TIPOS_COM_HANDLER.includes("RISCO_OPORTUNIDADE") && TIPOS_COM_HANDLER.includes("PROCESSO"));
      const fonte = readFileSync("src/app/(app)/aprovacoes/actions.ts", "utf8");
      assert.match(fonte, /import "@\/lib\/aprovacao\/handlers";/);
    });

    await caso("permissões: Qualidade gerencia e trata; colaborador não", async () => {
      assert.ok(qualidade.permissoes.includes("RISCO_GERENCIAR") && qualidade.permissoes.includes("RISCO_TRATAR"));
      assert.ok(adminMonto.permissoes.includes("RISCO_GERENCIAR"));
      assert.ok(!colab.permissoes.includes("RISCO_GERENCIAR") && !colab.permissoes.includes("RISCO_TRATAR"));
    });

    let r1 = "";
    await caso("CRUD: criar calcula nível pela escala, histórico CRIACAO, próxima reavaliação", async () => {
      r1 = (await criarRisco(qualidade, { tipo: "RISCO", descricao: "Teste risco A", processoId: proc.id, probabilidade: 2, impacto: 4, responsavelId: colab.usuarioId })).id;
      criados.push(r1);
      const r = await obterRisco(qualidade, r1);
      assert.ok(r);
      assert.equal(r.score, 8);
      assert.equal(r.faixa, "MEDIO");
      assert.equal(r.status, "IDENTIFICADO");
      assert.ok(r.proximaReavaliacaoEm, "próxima reavaliação calculada");
      const h = await listarHistorico(qualidade, r1);
      assert.deepEqual(h.map((x) => x.acao), ["CRIACAO"]);
      assert.ok((await listarRiscos(colab, { processo: proc.id })).some((x) => x.id === r1), "colaborador lê");
      assert.ok((await listarRiscos(qualidade, { faixa: "MEDIO" })).some((x) => x.id === r1));
      assert.ok(!(await listarRiscos(qualidade, { faixa: "ALTO" })).some((x) => x.id === r1));
    });

    await caso("editar: recalcula, histórico ALTERACAO, conflito de versão", async () => {
      const r = (await obterRisco(qualidade, r1))!;
      await editarRisco(qualidade, r1, { tipo: "RISCO", descricao: "Teste risco A2", processoId: proc.id, probabilidade: 3, impacto: 4, responsavelId: colab.usuarioId }, r.versao);
      const d = (await obterRisco(qualidade, r1))!;
      assert.equal(d.descricao, "Teste risco A2");
      assert.equal(d.faixa, "ALTO");
      await assert.rejects(
        editarRisco(qualidade, r1, { tipo: "RISCO", descricao: "x x x", probabilidade: 1, impacto: 1 }, r.versao),
        (e: unknown) => e instanceof ErroConflito,
      );
      assert.equal((await listarHistorico(qualidade, r1))[0].acao, "ALTERACAO");
    });

    await caso("regra: MITIGAR com nível ALTO exige plano; responsável (sem RISCO_TRATAR) pode tratar", async () => {
      const v = (await obterRisco(qualidade, r1))!.versao;
      await assert.rejects(definirTratamento(colab, r1, { tratamento: "MITIGAR" }, v), erro(/exige plano de ação/));
      await assert.rejects(definirTratamento(colab, r1, { tratamento: "EXPLORAR" }, v), erro(/oportunidade/));
      // Responsável trata com a primeira ação: plano criado com origem RISCO_OPORTUNIDADE e vinculado.
      await definirTratamento(colab, r1, { tratamento: "MITIGAR", probabilidadeResidual: 1, impactoResidual: 4, primeiraAcao: { oQue: "Treinar equipe", quemId: colab.usuarioId, quando: prazo } }, v);
      const d = (await obterRisco(qualidade, r1))!;
      assert.equal(d.status, "EM_TRATAMENTO");
      assert.equal(d.faixaResidual, "BAIXO");
      assert.ok(d.planoAcao);
      const plano = await admin.planoAcao.findUniqueOrThrow({ where: { id: d.planoAcao.id }, include: { itens: true } });
      assert.equal(plano.origemTipo, "RISCO_OPORTUNIDADE");
      assert.equal(plano.origemId, r1);
      assert.equal(plano.itens.length, 1);
      await assert.rejects(gerarPlanoAcao(qualidade, r1, { itens: [{ oQue: "x", quemId: colab.usuarioId, quando: prazo }] }), erro(/já tem plano/));
    });

    let r2 = "";
    await caso("criar com MITIGAR/CRÍTICO sem ação → erro; gerar plano depois libera o tratamento", async () => {
      await assert.rejects(
        criarRisco(qualidade, { tipo: "RISCO", descricao: "Teste risco B", probabilidade: 5, impacto: 5, tratamento: "EVITAR" }),
        erro(/exige plano de ação/),
      );
      r2 = (await criarRisco(qualidade, { tipo: "RISCO", descricao: "Teste risco B", processoId: proc.id, probabilidade: 5, impacto: 5 })).id;
      criados.push(r2);
      await assert.rejects(definirTratamento(qualidade, r2, { tratamento: "EVITAR" }), erro(/exige plano/));
      await gerarPlanoAcao(qualidade, r2, { itens: [{ oQue: "Eliminar a atividade", quemId: qualidade.usuarioId, quando: prazo }] });
      await definirTratamento(qualidade, r2, { tratamento: "EVITAR" });
      assert.equal((await obterRisco(qualidade, r2))!.tratamento, "EVITAR");
      // Colaborador não é responsável nem tem RISCO_TRATAR.
      await assert.rejects(alterarStatus(colab, r2, "MONITORADO"), erro(/permissão/));
    });

    await caso("permissão: sem RISCO_GERENCIAR não cria, edita, exclui nem faz revisão geral", async () => {
      await assert.rejects(criarRisco(colab, { tipo: "RISCO", descricao: "Negado", probabilidade: 1, impacto: 1 }), erro(/RISCO_GERENCIAR/));
      await assert.rejects(editarRisco(colab, r1, { tipo: "RISCO", descricao: "Negado", probabilidade: 1, impacto: 1 }), erro(/RISCO_GERENCIAR/));
      await assert.rejects(excluirRisco(colab, r1), erro(/RISCO_GERENCIAR/));
      await assert.rejects(revisaoGeral(colab, { processo: proc.id }, []), erro(/RISCO_GERENCIAR/));
    });

    await caso("reavaliar item: nova avaliação, histórico REAVALIACAO e nova data; regra do plano mantida", async () => {
      const antes = (await obterRisco(qualidade, r1))!;
      await reavaliar(colab, r1, { probabilidade: 2, impacto: 2, probabilidadeResidual: 1, impactoResidual: 1, observacao: "Reavaliado" }, antes.versao);
      const d = (await obterRisco(qualidade, r1))!;
      assert.equal(d.faixa, "BAIXO");
      assert.equal(d.faixaResidual, "BAIXO");
      assert.ok(d.ultimaReavaliacaoEm);
      assert.equal((await listarHistorico(qualidade, r1))[0].acao, "REAVALIACAO");
    });

    await caso("revisão geral: reavalia todos do processo de uma vez, com histórico em cada um", async () => {
      const escopo = await listarRiscos(qualidade, { processo: proc.id });
      assert.ok(escopo.length >= 2);
      const r = await revisaoGeral(qualidade, { processo: proc.id }, [{ id: r2, probabilidade: 4, impacto: 5 }], "Revisão anual");
      assert.equal(r.revisados, escopo.length);
      for (const x of escopo) {
        const h = await listarHistorico(qualidade, x.id);
        assert.equal(h[0].acao, "REVISAO_GERAL", `${x.id} revisado`);
      }
      assert.equal((await obterRisco(qualidade, r2))!.score, 20);
      await assert.rejects(revisaoGeral(qualidade, { processo: proc.id }, [{ id: "00000000-0000-0000-0000-000000000000", probabilidade: 1, impacto: 1 }]), erro(/fora do escopo/));
    });

    await caso("histórico é append-only (trigger bloqueia UPDATE/DELETE)", async () => {
      const h = await admin.historicoRiscoOportunidade.findFirstOrThrow({ where: { riscoId: r1 } });
      await assert.rejects(admin.historicoRiscoOportunidade.update({ where: { id: h.id }, data: { observacao: "adulterado" } }), /imutável/);
      await assert.rejects(admin.historicoRiscoOportunidade.delete({ where: { id: h.id } }), /imutável/);
    });

    await caso("aprovação: alteração aplicada ao aprovar pelo ponto de entrada de /aprovacoes (processo separado)", async () => {
      const r = (await obterRisco(qualidade, r2))!;
      const f = await solicitarAlteracao(
        qualidade,
        r2,
        { tipo: "RISCO", descricao: "Teste risco B (aprovado)", processoId: proc.id, probabilidade: 2, impacto: 5 },
        { aprovadorIds: [adminMonto.usuarioId], modo: "SEQUENCIAL" },
      );
      assert.equal((await obterRisco(qualidade, r2))!.descricao, r.descricao, "nada muda antes de aprovar");
      const saida = execFileSync(process.execPath, [...process.execArgv, __filename, "--decidir", f.id, "admin@monto.com.br"], { encoding: "utf8" });
      assert.match(saida, /"status":"APROVADO"/);
      const d = (await obterRisco(qualidade, r2))!;
      assert.equal(d.descricao, "Teste risco B (aprovado)");
      assert.equal(d.score, 10);
      const h = await listarHistorico(qualidade, r2);
      assert.equal(h[0].acao, "ALTERACAO");
      assert.match(h[0].observacao ?? "", /fluxo de aprovação/);
      assert.equal(h[0].usuarioId, qualidade.usuarioId, "aplicado em nome do solicitante");
    });

    await caso("fonte de reavaliação registrada e lista itens vencendo", async () => {
      const fonte = fontesReavaliacao(["RISCOS_OPORTUNIDADES"])[0];
      assert.ok(fonte);
      await admin.riscoOportunidade.update({ where: { id: r1 }, data: { proximaReavaliacaoEm: new Date("2026-01-01T00:00:00.000Z") } });
      const itens = await fonte.listarVencendo(qualidade.db, { id: qualidade.empresaId, fusoHorario: "America/Sao_Paulo", modulosAtivos: ["RISCOS_OPORTUNIDADES"] }, "2026-09-26", 15);
      assert.ok(itens.some((i) => i.entidadeId === r1 && i.link === `/riscos/${r1}`));
    });

    await caso("dashboard: contagem por faixa", async () => {
      const c = await contarPorFaixa(qualidade);
      assert.ok(c && c.BAIXO + c.MEDIO + c.ALTO + c.CRITICO >= 2);
      assert.equal(await contarPorFaixa(adminDemo), null, "Demo sem o módulo");
    });

    await caso("gating: Demo sem RISCOS_OPORTUNIDADES → negado", async () => {
      await assert.rejects(listarRiscos(adminDemo), erro(/não contratado/));
      await assert.rejects(criarRisco(adminDemo, { tipo: "RISCO", descricao: "Demo", probabilidade: 1, impacto: 1 }), erro(/não contratado/));
    });

    await caso("isolamento: Demo (com módulo) não vê nem altera risco da Monto", async () => {
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: [...demo.modulosAtivos, "RISCOS_OPORTUNIDADES"] } });
      try {
        assert.equal(await obterRisco(adminDemo, r1), null);
        assert.ok(!(await listarRiscos(adminDemo, { encerrados: true })).some((x) => x.id === r1));
        await assert.rejects(editarRisco(adminDemo, r1, { tipo: "RISCO", descricao: "Invasão", probabilidade: 1, impacto: 1 }), erro(/não encontrado/));
        await assert.rejects(reavaliar(adminDemo, r1, { probabilidade: 1, impacto: 1 }), erro(/não encontrado/));
        await assert.rejects(criarRisco(adminDemo, { tipo: "RISCO", descricao: "Com processo alheio", processoId: proc.id, probabilidade: 1, impacto: 1 }), erro(/Processo inválido/));
        assert.equal((await listarHistorico(adminDemo, r1)).length, 0);
      } finally {
        await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: demo.modulosAtivos } });
      }
    });

    await caso("excluir é lógico: some da lista, histórico preservado", async () => {
      await excluirRisco(qualidade, r2);
      assert.equal(await obterRisco(qualidade, r2), null);
      assert.equal((await admin.historicoRiscoOportunidade.findFirstOrThrow({ where: { riscoId: r2 }, orderBy: { criadoEm: "desc" } })).acao, "EXCLUSAO");
    });
  } finally {
    // Histórico é imutável: os registros de teste ficam inativos (exclusão lógica).
    await admin.riscoOportunidade.updateMany({ where: { id: { in: criados } }, data: { ativo: false } });
    await admin.$disconnect();
  }
  console.log(`\n${ok} casos OK (riscos e oportunidades).`);
}

const i = process.argv.indexOf("--decidir");
(i > 0 ? modoFilho(process.argv[i + 1], process.argv[i + 2]) : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
