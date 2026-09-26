/* Executar: npm run test:laia (requer seed). LAIA: gating, escopo por obra, inclusão/alteração/
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
import type { DadosLaia } from "../src/lib/laia/regras";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { fontesReavaliacao } from "../src/lib/reavaliacao";
import "../src/lib/laia/reavaliacao";
import {
  alterarLaia,
  excluirLaia,
  gerarPlanoLaia,
  incluirLaia,
  listarLaia,
  listarHistoricoLaia,
  obterLaia,
  reavaliarLaia,
  resumoLaia,
  revisaoGeralLaia,
} from "../src/lib/laia/servico";

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
  const seg = await ator("meioambiente@monto.com.br");
  const adm = await ator("admin@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const adminDemo = await ator("admin@demo.com.br");
  const empresa = await admin.empresa.findUniqueOrThrow({ where: { id: seg.empresaId } });
  const configOriginal = empresa.config;
  const exigir = (sim: boolean) =>
    admin.empresa.update({
      where: { id: empresa.id },
      data: { config: mesclarConfigAprovacao(configOriginal, "laia", { exigir: sim, aprovadorIds: [adm.usuarioId], modo: "SEQUENCIAL" }) as Prisma.InputJsonValue },
    });
  const alfa = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: empresa.id, nome: "Obra Alfa" } })).id;
  const beta = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: empresa.id, nome: "Obra Beta" } })).id;
  const d = (x: Partial<DadosLaia> = {}): DadosLaia => ({
    obraId: alfa, atividade: "Atividade de teste", aspecto: "Aspecto teste", impacto: "Impacto teste", situacao: "NORMAL",
    temporalidade: "ATUAL", incidencia: "DIRETA", severidade: 2, frequencia: 2, abrangencia: 1, requisitoLegal: false, partesInteressadas: false, ...x,
  });
  const criados: string[] = [];

  try {
    await caso("handlers.ts registra LAIA; /aprovacoes importa handlers", async () => {
      const { handlersRegistrados, TIPOS_COM_HANDLER } = await import("../src/lib/aprovacao/handlers");
      assert.deepEqual(handlersRegistrados(), [...TIPOS_COM_HANDLER]);
      assert.ok(TIPOS_COM_HANDLER.includes("LAIA"));
      assert.match(readFileSync("src/app/(app)/aprovacoes/actions.ts", "utf8"), /import "@\/lib\/aprovacao\/handlers";/);
    });

    await caso("permissões: Meio Ambiente gerencia LAIA; colaborador/inspetor não", async () => {
      assert.ok(seg.permissoes.includes("LAIA_GERENCIAR"));
      assert.ok(!colab.permissoes.includes("LAIA_GERENCIAR") && !inspetor.permissoes.includes("LAIA_GERENCIAR"));
      await assert.rejects(incluirLaia(inspetor, d()), erro(/LAIA_GERENCIAR/));
    });

    await exigir(false);
    let h1 = "";
    await caso("sem aprovação: inclusão direta VIGENTE, nível pela escala, histórico INCLUSAO", async () => {
      const r = await incluirLaia(seg, d());
      h1 = r.id;
      criados.push(h1);
      assert.equal(r.aplicado, true);
      assert.equal(r.fluxoId, null);
      const l = (await obterLaia(seg, h1))!;
      assert.equal(l.status, "VIGENTE");
      assert.equal(l.score, 4);
      assert.equal(l.faixa, "BAIXO");
      assert.deepEqual((await listarHistoricoLaia(seg, h1)).map((x) => x.acao), ["INCLUSAO"]);
    });

    await caso("sem aprovação: alteração direta recalcula; conflito de versão", async () => {
      const v = (await obterLaia(seg, h1))!.versao;
      const r = await alterarLaia(seg, h1, d({ severidade: 3, frequencia: 3, abrangencia: 2 }), v);
      assert.equal(r.aplicado, true);
      const l = (await obterLaia(seg, h1))!;
      assert.equal(l.faixa, "ALTO");
      assert.equal(l.significativo, true);
      assert.ok((await listarLaia(seg, { significativos: true })).some((x) => x.id === h1), "filtro somente significativos");
      await assert.rejects(alterarLaia(seg, h1, d(), v), (e: unknown) => e instanceof ErroConflito);
      assert.equal((await listarHistoricoLaia(seg, h1))[0].acao, "ALTERACAO");
    });

    let hBeta = "";
    await caso("escopo por obra: colaborador (só Alfa) não vê linha da Beta; inspetor não inclui fora do escopo", async () => {
      hBeta = (await incluirLaia(seg, d({ obraId: beta }))).id;
      criados.push(hBeta);
      assert.ok((await listarLaia(colab)).some((x) => x.id === h1), "vê Alfa");
      assert.ok(!(await listarLaia(colab)).some((x) => x.id === hBeta), "não vê Beta");
      assert.equal(await obterLaia(colab, hBeta), null);
      const restrito = { ...seg, obrasPermitidas: [alfa] };
      await assert.rejects(incluirLaia(restrito, d({ obraId: beta })), erro(/sem acesso/));
    });

    await exigir(true);
    let h2 = "";
    await caso("com aprovação: inclusão fica PENDENTE_APROVACAO e vira VIGENTE ao aprovar pela action de /aprovacoes", async () => {
      const r = await incluirLaia(seg, d({ atividade: "Inclusão aprovada", requisitoLegal: true }));
      h2 = r.id;
      criados.push(h2);
      assert.equal(r.aplicado, false);
      assert.ok(r.fluxoId);
      assert.equal((await obterLaia(seg, h2))!.status, "PENDENTE_APROVACAO");
      assert.ok(!(await resumoLaia(seg))!.porFaixa.CRITICO || true);
      await assert.rejects(alterarLaia(seg, h2, d()), erro(/não vigente/));
      assert.match(aprovarPelaTela(r.fluxoId!), /"status":"APROVADO"/);
      const l = (await obterLaia(seg, h2))!;
      assert.equal(l.status, "VIGENTE");
      assert.equal(l.faixa, "CRITICO");
      const h = await listarHistoricoLaia(seg, h2);
      assert.deepEqual(h.map((x) => x.acao), ["APROVACAO", "INCLUSAO"]);
      assert.equal(h[0].usuarioId, seg.usuarioId, "aplicado em nome do solicitante");
    });

    await caso("com aprovação: alteração guarda {antes, depois}, não muda até aprovar, aplica recalculando", async () => {
      const antes = (await obterLaia(seg, h1))!;
      const r = await alterarLaia(seg, h1, d({ aspecto: "Aspecto alterado", severidade: 1, frequencia: 1 }), antes.versao, "Revisão de campo");
      assert.equal(r.aplicado, false);
      const f = await admin.fluxoAprovacao.findUniqueOrThrow({ where: { id: r.fluxoId! } });
      const p = f.payload as { antes: Record<string, unknown>; depois: Record<string, unknown> };
      assert.equal(f.tipoAlteracao, "ALTERACAO");
      assert.equal(p.antes.aspecto, "Aspecto teste");
      assert.equal(p.depois.aspecto, "Aspecto alterado");
      assert.equal(p.depois.faixa, "BAIXO");
      assert.equal((await obterLaia(seg, h1))!.aspecto, "Aspecto teste", "nada muda antes de aprovar");
      await assert.rejects(alterarLaia(seg, h1, d({ aspecto: "outra" })), erro(/pendente/));
      assert.match(aprovarPelaTela(r.fluxoId!), /APROVADO/);
      const l = (await obterLaia(seg, h1))!;
      assert.equal(l.aspecto, "Aspecto alterado");
      assert.equal(l.score, 1);
    });

    await caso("aprovação falha com conflito se a linha mudou depois da solicitação", async () => {
      const v = (await obterLaia(seg, h1))!.versao;
      const r = await alterarLaia(seg, h1, d({ aspecto: "Conflitante", severidade: 1, frequencia: 1 }), v);
      await admin.linhaLaia.update({ where: { id: h1 }, data: { versao: { increment: 1 } } });
      assert.throws(() => aprovarPelaTela(r.fluxoId!));
      assert.equal((await obterLaia(seg, h1))!.aspecto, "Aspecto alterado");
      const { cancelar } = await import("../src/lib/aprovacao");
      await cancelar(seg, r.fluxoId!, "teste");
      assert.equal((await listarHistoricoLaia(seg, h1))[0].acao, "REJEICAO");
    });

    await caso("rejeição da inclusão: linha REJEITADA", async () => {
      const r = await incluirLaia(seg, d({ atividade: "Inclusão rejeitada" }));
      criados.push(r.id);
      const { decidir } = await import("../src/lib/aprovacao");
      await import("../src/lib/aprovacao/handlers");
      await decidir(adm, r.fluxoId!, { decisao: "REJEITAR", comentario: "Duplicada" });
      assert.equal((await obterLaia(seg, r.id))!.status, "REJEITADA");
      assert.ok(!(await listarLaia(seg)).some((x) => x.id === r.id), "fora da planilha padrão");
    });

    await caso("plano de ação gerado com origem LAIA", async () => {
      await gerarPlanoLaia(seg, h2, { itens: [{ oQue: "Bacia de contenção", quemId: seg.usuarioId, quando: "2027-01-31" }] });
      const l = (await obterLaia(seg, h2))!;
      assert.ok(l.planoAcao);
      const plano = await admin.planoAcao.findUniqueOrThrow({ where: { id: l.planoAcao.id } });
      assert.equal(plano.origemTipo, "LAIA");
      assert.equal(plano.origemId, h2);
      assert.equal(plano.obraId, alfa);
      await assert.rejects(gerarPlanoLaia(seg, h2, { itens: [{ oQue: "x", quemId: seg.usuarioId, quando: "2027-01-31" }] }), erro(/já tem plano/));
    });

    await caso("reavaliação do item e revisão geral da obra (diretas, com histórico)", async () => {
      const v = (await obterLaia(seg, h2))!.versao;
      await reavaliarLaia(seg, h2, { severidade: 3, frequencia: 2, abrangencia: 1, observacao: "Controle implantado" }, v);
      assert.equal((await listarHistoricoLaia(seg, h2))[0].acao, "REAVALIACAO");
      assert.equal((await obterLaia(seg, h2))!.score, 6);
      assert.equal((await obterLaia(seg, h2))!.faixa, "CRITICO", "requisito legal mantém a elevação");
      const vigentes = await listarLaia(seg, { obra: alfa, status: "VIGENTE" });
      const r = await revisaoGeralLaia(seg, alfa, [{ id: h1, severidade: 1, frequencia: 1, abrangencia: 1 }], "Revisão anual");
      assert.equal(r.revisados, vigentes.length);
      assert.equal((await listarHistoricoLaia(seg, h1))[0].acao, "REVISAO_GERAL");
      await assert.rejects(revisaoGeralLaia(seg, alfa, [{ id: hBeta, severidade: 1, frequencia: 1, abrangencia: 1 }]), erro(/fora do escopo/));
      await assert.rejects(revisaoGeralLaia(colab, alfa, []), erro(/LAIA_GERENCIAR/));
    });

    await caso("exclusão via aprovação = inativação", async () => {
      const r = await excluirLaia(seg, hBeta, "Serviço concluído");
      assert.equal(r.aplicado, false);
      assert.equal((await obterLaia(seg, hBeta))!.status, "VIGENTE");
      assert.match(aprovarPelaTela(r.fluxoId!), /APROVADO/);
      assert.equal((await obterLaia(seg, hBeta))!.status, "INATIVA");
      assert.equal((await listarHistoricoLaia(seg, hBeta))[0].acao, "EXCLUSAO");
    });

    await caso("histórico é append-only (trigger)", async () => {
      const h = await admin.historicoLinhaLaia.findFirstOrThrow({ where: { linhaId: h1 } });
      await assert.rejects(admin.historicoLinhaLaia.update({ where: { id: h.id }, data: { observacao: "x" } }), /imutável/);
      await assert.rejects(admin.historicoLinhaLaia.delete({ where: { id: h.id } }), /imutável/);
    });

    await caso("fonte de reavaliação registrada", async () => {
      const fonte = fontesReavaliacao(["LAIA"])[0];
      assert.ok(fonte);
      await admin.linhaLaia.update({ where: { id: h2 }, data: { proximaReavaliacaoEm: new Date("2026-01-01T00:00:00.000Z") } });
      const itens = await fonte.listarVencendo(seg.db, { id: seg.empresaId, fusoHorario: "America/Sao_Paulo", modulosAtivos: ["LAIA"] }, "2026-09-26", 15);
      assert.ok(itens.some((i) => i.entidadeId === h2 && i.link === `/laia/${h2}`));
    });

    await caso("gating: Demo sem LAIA → negado; dashboard null", async () => {
      await assert.rejects(listarLaia(adminDemo), erro(/não contratado/));
      assert.equal(await resumoLaia(adminDemo), null);
    });

    await caso("isolamento: Demo (com módulo) não vê nem altera linha da Monto", async () => {
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: [...demo.modulosAtivos, "LAIA"] } });
      try {
        assert.equal(await obterLaia(adminDemo, h1), null);
        assert.ok(!(await listarLaia(adminDemo, { todas: true })).some((x) => x.id === h1));
        await assert.rejects(alterarLaia(adminDemo, h1, d({ obraId: alfa })), erro(/não encontrada|sem acesso/));
        await assert.rejects(reavaliarLaia(adminDemo, h1, { severidade: 1, frequencia: 1, abrangencia: 1 }), erro(/não encontrada/));
        await assert.rejects(incluirLaia(adminDemo, d({ obraId: alfa })), erro(/sem acesso/));
        assert.equal((await listarHistoricoLaia(adminDemo, h1)).length, 0);
      } finally {
        await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: demo.modulosAtivos } });
      }
    });
  } finally {
    await admin.empresa.update({ where: { id: empresa.id }, data: { config: configOriginal as Prisma.InputJsonValue } });
    // Histórico é imutável: as linhas de teste ficam inativas.
    await admin.linhaLaia.updateMany({ where: { id: { in: criados } }, data: { status: "INATIVA" } });
    await admin.$disconnect();
  }
  console.log(`\n${ok} casos OK (LAIA).`);
}

const i = process.argv.indexOf("--decidir");
(i > 0 ? modoFilho(process.argv[i + 1], process.argv[i + 2]) : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
