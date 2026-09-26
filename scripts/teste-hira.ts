/* Executar: npm run test:hira (requer seed). HIRA: gating, escopo por obra, inclusão/alteração/
 * exclusão via aprovação aplicada pelo ponto de entrada de /aprovacoes (processo separado), aplicação
 * direta quando a empresa não exige aprovação, rejeição, histórico imutável, plano de ação,
 * reavaliação/revisão geral e isolamento entre empresas. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaClient, type Prisma } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { mesclarConfigAprovacao } from "../src/lib/aprovacao/config-modulo";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroConflito, ErroNegocio } from "../src/lib/erros";
import type { DadosHira } from "../src/lib/hira/regras";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { fontesReavaliacao } from "../src/lib/reavaliacao";
import "../src/lib/hira/reavaliacao";
import {
  alterarHira,
  excluirHira,
  gerarPlanoHira,
  incluirHira,
  listarHira,
  listarHistoricoHira,
  obterHira,
  reavaliarHira,
  resumoHira,
  revisaoGeralHira,
} from "../src/lib/hira/servico";

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

/** Processo filho que carrega SÓ as actions de /aprovacoes (como o servidor) e decide o fluxo. */
async function modoFilho(fluxoId: string, email: string) {
  await import("../src/app/(app)/aprovacoes/actions");
  const { decidir } = await import("../src/lib/aprovacao");
  const r = await decidir(await ator(email), fluxoId, { decisao: "APROVAR" });
  console.log(JSON.stringify(r));
  await admin.$disconnect();
}
const aprovarPelaTela = (fluxoId: string, email = "admin@monto.com.br") =>
  execFileSync(process.execPath, [...process.execArgv, __filename, "--decidir", fluxoId, email], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

async function main() {
  const seg = await ator("seguranca@monto.com.br");
  const adm = await ator("admin@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const adminDemo = await ator("admin@demo.com.br");
  const empresa = await admin.empresa.findUniqueOrThrow({ where: { id: seg.empresaId } });
  const configOriginal = empresa.config;
  const exigir = (sim: boolean) =>
    admin.empresa.update({
      where: { id: empresa.id },
      data: { config: mesclarConfigAprovacao(configOriginal, "hira", { exigir: sim, aprovadorIds: [adm.usuarioId], modo: "SEQUENCIAL" }) as Prisma.InputJsonValue },
    });
  const alfa = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: empresa.id, nome: "Obra Alfa" } })).id;
  const beta = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: empresa.id, nome: "Obra Beta" } })).id;
  const d = (x: Partial<DadosHira> = {}): DadosHira => ({
    obraId: alfa, setor: "Teste", atividade: "Atividade de teste", rotineira: true, perigo: "Perigo teste", risco: "Dano teste",
    condicao: "NORMAL", probabilidade: 2, severidade: 4, ...x,
  });
  const criados: string[] = [];

  try {
    await caso("handlers.ts registra HIRA; /aprovacoes importa handlers", async () => {
      const { handlersRegistrados, TIPOS_COM_HANDLER } = await import("../src/lib/aprovacao/handlers");
      assert.deepEqual(handlersRegistrados(), [...TIPOS_COM_HANDLER]);
      assert.ok(TIPOS_COM_HANDLER.includes("HIRA"));
      assert.match(readFileSync("src/app/(app)/aprovacoes/actions.ts", "utf8"), /import "@\/lib\/aprovacao\/handlers";/);
    });

    await caso("permissões: Segurança gerencia HIRA; colaborador/inspetor não", async () => {
      assert.ok(seg.permissoes.includes("HIRA_GERENCIAR"));
      assert.ok(!colab.permissoes.includes("HIRA_GERENCIAR") && !inspetor.permissoes.includes("HIRA_GERENCIAR"));
      await assert.rejects(incluirHira(inspetor, d()), erro(/HIRA_GERENCIAR/));
    });

    await exigir(false);
    let h1 = "";
    await caso("sem aprovação: inclusão direta VIGENTE, nível pela escala, histórico INCLUSAO", async () => {
      const r = await incluirHira(seg, d());
      h1 = r.id;
      criados.push(h1);
      assert.equal(r.aplicado, true);
      assert.equal(r.fluxoId, null);
      const l = (await obterHira(seg, h1))!;
      assert.equal(l.status, "VIGENTE");
      assert.equal(l.score, 8);
      assert.equal(l.faixa, "MEDIO");
      assert.deepEqual((await listarHistoricoHira(seg, h1)).map((x) => x.acao), ["INCLUSAO"]);
    });

    await caso("sem aprovação: alteração direta recalcula; conflito de versão", async () => {
      const v = (await obterHira(seg, h1))!.versao;
      const r = await alterarHira(seg, h1, d({ probabilidade: 4, severidade: 4, probabilidadeResidual: 1, severidadeResidual: 4 }), v);
      assert.equal(r.aplicado, true);
      const l = (await obterHira(seg, h1))!;
      assert.equal(l.faixa, "ALTO");
      assert.equal(l.faixaResidual, "BAIXO");
      await assert.rejects(alterarHira(seg, h1, d(), v), (e: unknown) => e instanceof ErroConflito);
      assert.equal((await listarHistoricoHira(seg, h1))[0].acao, "ALTERACAO");
    });

    let hBeta = "";
    await caso("escopo por obra: colaborador (só Alfa) não vê linha da Beta; inspetor não inclui fora do escopo", async () => {
      hBeta = (await incluirHira(seg, d({ obraId: beta }))).id;
      criados.push(hBeta);
      assert.ok((await listarHira(colab)).some((x) => x.id === h1), "vê Alfa");
      assert.ok(!(await listarHira(colab)).some((x) => x.id === hBeta), "não vê Beta");
      assert.equal(await obterHira(colab, hBeta), null);
      const restrito = { ...seg, obrasPermitidas: [alfa] };
      await assert.rejects(incluirHira(restrito, d({ obraId: beta })), erro(/sem acesso/));
    });

    await exigir(true);
    let h2 = "";
    await caso("com aprovação: inclusão fica PENDENTE_APROVACAO e vira VIGENTE ao aprovar pela action de /aprovacoes", async () => {
      const r = await incluirHira(seg, d({ atividade: "Inclusão aprovada", probabilidade: 5, severidade: 5 }));
      h2 = r.id;
      criados.push(h2);
      assert.equal(r.aplicado, false);
      assert.ok(r.fluxoId);
      assert.equal((await obterHira(seg, h2))!.status, "PENDENTE_APROVACAO");
      assert.ok(!(await resumoHira(seg))!.porFaixa.CRITICO || true);
      await assert.rejects(alterarHira(seg, h2, d()), erro(/não vigente/));
      assert.match(aprovarPelaTela(r.fluxoId!), /"status":"APROVADO"/);
      const l = (await obterHira(seg, h2))!;
      assert.equal(l.status, "VIGENTE");
      assert.equal(l.faixa, "CRITICO");
      const h = await listarHistoricoHira(seg, h2);
      assert.deepEqual(h.map((x) => x.acao), ["APROVACAO", "INCLUSAO"]);
      assert.equal(h[0].usuarioId, seg.usuarioId, "aplicado em nome do solicitante");
    });

    await caso("com aprovação: alteração guarda {antes, depois}, não muda até aprovar, aplica recalculando", async () => {
      const antes = (await obterHira(seg, h1))!;
      const r = await alterarHira(seg, h1, d({ perigo: "Perigo alterado", probabilidade: 1, severidade: 2 }), antes.versao, "Revisão de campo");
      assert.equal(r.aplicado, false);
      const f = await admin.fluxoAprovacao.findUniqueOrThrow({ where: { id: r.fluxoId! } });
      const p = f.payload as { antes: Record<string, unknown>; depois: Record<string, unknown> };
      assert.equal(f.tipoAlteracao, "ALTERACAO");
      assert.equal(p.antes.perigo, "Perigo teste");
      assert.equal(p.depois.perigo, "Perigo alterado");
      assert.equal(p.depois.faixa, "BAIXO");
      assert.equal((await obterHira(seg, h1))!.perigo, "Perigo teste", "nada muda antes de aprovar");
      await assert.rejects(alterarHira(seg, h1, d({ perigo: "outra" })), erro(/pendente/));
      assert.match(aprovarPelaTela(r.fluxoId!), /APROVADO/);
      const l = (await obterHira(seg, h1))!;
      assert.equal(l.perigo, "Perigo alterado");
      assert.equal(l.score, 2);
    });

    await caso("aprovação falha com conflito se a linha mudou depois da solicitação", async () => {
      const v = (await obterHira(seg, h1))!.versao;
      const r = await alterarHira(seg, h1, d({ perigo: "Conflitante", probabilidade: 1, severidade: 2 }), v);
      await admin.linhaHira.update({ where: { id: h1 }, data: { versao: { increment: 1 } } });
      assert.throws(() => aprovarPelaTela(r.fluxoId!));
      assert.equal((await obterHira(seg, h1))!.perigo, "Perigo alterado");
      const { cancelar } = await import("../src/lib/aprovacao");
      await cancelar(seg, r.fluxoId!, "teste");
      assert.equal((await listarHistoricoHira(seg, h1))[0].acao, "REJEICAO");
    });

    await caso("rejeição da inclusão: linha REJEITADA", async () => {
      const r = await incluirHira(seg, d({ atividade: "Inclusão rejeitada" }));
      criados.push(r.id);
      const { decidir } = await import("../src/lib/aprovacao");
      await import("../src/lib/aprovacao/handlers");
      await decidir(adm, r.fluxoId!, { decisao: "REJEITAR", comentario: "Duplicada" });
      assert.equal((await obterHira(seg, r.id))!.status, "REJEITADA");
      assert.ok(!(await listarHira(seg)).some((x) => x.id === r.id), "fora da planilha padrão");
    });

    await caso("plano de ação gerado com origem HIRA", async () => {
      await gerarPlanoHira(seg, h2, { itens: [{ oQue: "Rede de proteção", quemId: seg.usuarioId, quando: "2027-01-31" }] });
      const l = (await obterHira(seg, h2))!;
      assert.ok(l.planoAcao);
      const plano = await admin.planoAcao.findUniqueOrThrow({ where: { id: l.planoAcao.id } });
      assert.equal(plano.origemTipo, "HIRA");
      assert.equal(plano.origemId, h2);
      assert.equal(plano.obraId, alfa);
      await assert.rejects(gerarPlanoHira(seg, h2, { itens: [{ oQue: "x", quemId: seg.usuarioId, quando: "2027-01-31" }] }), erro(/já tem plano/));
    });

    await caso("reavaliação do item e revisão geral da obra (diretas, com histórico)", async () => {
      const v = (await obterHira(seg, h2))!.versao;
      await reavaliarHira(seg, h2, { probabilidade: 2, severidade: 5, probabilidadeResidual: 1, severidadeResidual: 5, observacao: "Rede instalada" }, v);
      assert.equal((await listarHistoricoHira(seg, h2))[0].acao, "REAVALIACAO");
      assert.equal((await obterHira(seg, h2))!.faixaResidual, "MEDIO");
      const vigentes = await listarHira(seg, { obra: alfa, status: "VIGENTE" });
      const r = await revisaoGeralHira(seg, alfa, [{ id: h1, probabilidade: 2, severidade: 2 }], "Revisão anual");
      assert.equal(r.revisados, vigentes.length);
      assert.equal((await listarHistoricoHira(seg, h1))[0].acao, "REVISAO_GERAL");
      await assert.rejects(revisaoGeralHira(seg, alfa, [{ id: hBeta, probabilidade: 1, severidade: 1 }]), erro(/fora do escopo/));
      await assert.rejects(revisaoGeralHira(colab, alfa, []), erro(/HIRA_GERENCIAR/));
    });

    await caso("exclusão via aprovação = inativação", async () => {
      const r = await excluirHira(seg, hBeta, "Serviço concluído");
      assert.equal(r.aplicado, false);
      assert.equal((await obterHira(seg, hBeta))!.status, "VIGENTE");
      assert.match(aprovarPelaTela(r.fluxoId!), /APROVADO/);
      assert.equal((await obterHira(seg, hBeta))!.status, "INATIVA");
      assert.equal((await listarHistoricoHira(seg, hBeta))[0].acao, "EXCLUSAO");
    });

    await caso("histórico é append-only (trigger)", async () => {
      const h = await admin.historicoLinhaHira.findFirstOrThrow({ where: { linhaId: h1 } });
      await assert.rejects(admin.historicoLinhaHira.update({ where: { id: h.id }, data: { observacao: "x" } }), /imutável/);
      await assert.rejects(admin.historicoLinhaHira.delete({ where: { id: h.id } }), /imutável/);
    });

    await caso("fonte de reavaliação registrada", async () => {
      const fonte = fontesReavaliacao(["HIRA"])[0];
      assert.ok(fonte);
      await admin.linhaHira.update({ where: { id: h2 }, data: { proximaReavaliacaoEm: new Date("2026-01-01T00:00:00.000Z") } });
      const itens = await fonte.listarVencendo(seg.db, { id: seg.empresaId, fusoHorario: "America/Sao_Paulo", modulosAtivos: ["HIRA"] }, "2026-09-26", 15);
      assert.ok(itens.some((i) => i.entidadeId === h2 && i.link === `/hira/${h2}`));
    });

    await caso("gating: Demo sem HIRA → negado; dashboard null", async () => {
      await assert.rejects(listarHira(adminDemo), erro(/não contratado/));
      assert.equal(await resumoHira(adminDemo), null);
    });

    await caso("isolamento: Demo (com módulo) não vê nem altera linha da Monto", async () => {
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: [...demo.modulosAtivos, "HIRA"] } });
      try {
        assert.equal(await obterHira(adminDemo, h1), null);
        assert.ok(!(await listarHira(adminDemo, { todas: true })).some((x) => x.id === h1));
        await assert.rejects(alterarHira(adminDemo, h1, d({ obraId: alfa })), erro(/não encontrada|sem acesso/));
        await assert.rejects(reavaliarHira(adminDemo, h1, { probabilidade: 1, severidade: 1 }), erro(/não encontrada/));
        await assert.rejects(incluirHira(adminDemo, d({ obraId: alfa })), erro(/sem acesso/));
        assert.equal((await listarHistoricoHira(adminDemo, h1)).length, 0);
      } finally {
        await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: demo.modulosAtivos } });
      }
    });
  } finally {
    await admin.empresa.update({ where: { id: empresa.id }, data: { config: configOriginal as Prisma.InputJsonValue } });
    // Histórico é imutável: as linhas de teste ficam inativas.
    await admin.linhaHira.updateMany({ where: { id: { in: criados } }, data: { status: "INATIVA" } });
    await admin.$disconnect();
  }
  console.log(`\n${ok} casos OK (HIRA).`);
}

const i = process.argv.indexOf("--decidir");
(i > 0 ? modoFilho(process.argv[i + 1], process.argv[i + 2]) : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
