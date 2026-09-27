/* Executar: npm run test:requisitos-legais (requer seed). Requisitos legais: gating, permissão, escopo por obra,
 * plano de ação gerado (NAO_ATENDE), verificação com histórico, revisão geral, evidência (anexo), histórico imutável,
 * isolamento entre empresas e código sequencial sem duplicata em paralelo. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { enviarAnexos, listarAnexos } from "../src/lib/anexos/servico";
import { hojeNoFuso } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import {
  criarRequisito,
  excluirRequisito,
  gerarPlanoRequisito,
  listarHistoricoRequisito,
  listarRequisitos,
  obterRequisito,
  registrarVerificacao,
  resumoRequisitos,
  revisaoGeralRequisitos,
} from "../src/lib/requisitos-legais/servico";
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
const hoje = hojeNoFuso("America/Sao_Paulo");
const prazo = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);

async function main() {
  const q = await ator("qualidade@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const demo = await ator("admin@demo.com.br");
  const e = q.empresaId;
  const alfa = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Alfa" } })).id;
  const beta = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Beta" } })).id;
  const base = { tipo: "NORMA" as const, numero: "NR-TESTE", titulo: "Requisito de teste", esfera: "FEDERAL" as const, tema: "SSO" as const };

  await caso("gating: Demo sem o módulo", async () => {
    await assert.rejects(listarRequisitos(demo), erro(/não contratado/));
    assert.equal(await resumoRequisitos(demo), null);
  });

  await caso("permissão: inspetor/colaborador não cadastram; responsável sem GERENCIAR verifica", async () => {
    await assert.rejects(criarRequisito(inspetor, base), erro(/REQUISITO_LEGAL_GERENCIAR/));
    await assert.rejects(criarRequisito(colab, base), erro(/REQUISITO_LEGAL_GERENCIAR/));
    const r = await criarRequisito(q, { ...base, obraId: alfa, responsavelId: inspetor.usuarioId });
    await registrarVerificacao(inspetor, r.id, { status: "ATENDE", observacao: "ok pelo responsável" });
    const outro = await criarRequisito(q, { ...base, obraId: alfa });
    await assert.rejects(registrarVerificacao(inspetor, outro.id, { status: "ATENDE" }), erro(/Sem permissão/));
    await excluirRequisito(q, r.id);
    await excluirRequisito(q, outro.id);
  });

  await caso("escopo por obra: inspetor (só Alfa) não vê requisito da Beta; vê o sem obra", async () => {
    const b = await criarRequisito(q, { ...base, obraId: beta });
    const s = await criarRequisito(q, base);
    assert.equal(await obterRequisito(inspetor, b.id), null);
    assert.ok(await obterRequisito(inspetor, s.id));
    assert.ok(!(await listarRequisitos(inspetor)).some((x) => x.id === b.id));
    await excluirRequisito(q, b.id);
    await excluirRequisito(q, s.id);
  });

  await caso("NAO_ATENDE exige plano: sem ação é negado; com ação gera plano real (origem REQUISITO_LEGAL)", async () => {
    await assert.rejects(criarRequisito(q, { ...base, status: "NAO_ATENDE" }), erro(/exige plano/));
    const r = await criarRequisito(q, { ...base, obraId: alfa, status: "NAO_ATENDE", primeiraAcao: { oQue: "Adequar", quemId: q.usuarioId, quando: prazo } });
    assert.match(r.codigo, /^LEG-\d{3}-\d{2}$/);
    const d = (await obterRequisito(q, r.id))!;
    assert.ok(d.planoAcao);
    const plano = await admin.planoAcao.findUniqueOrThrow({ where: { id: d.planoAcao.id }, include: { itens: true } });
    assert.equal(plano.origemTipo, "REQUISITO_LEGAL");
    assert.equal(plano.origemId, r.id);
    assert.equal(plano.obraId, alfa);
    assert.equal(plano.itens.length, 1);
    // Verificação para parcial não pede nova ação (já tem plano); plano duplicado é negado.
    await registrarVerificacao(q, r.id, { status: "ATENDE_PARCIAL", observacao: "melhorou" });
    await assert.rejects(gerarPlanoRequisito(q, r.id, { itens: [{ oQue: "x", quemId: q.usuarioId, quando: prazo }] }), erro(/já tem plano/));
    // Requisito sem plano: verificação NAO_ATENDE sem ação é negada; gerar plano depois libera.
    const s = await criarRequisito(q, base);
    await assert.rejects(registrarVerificacao(q, s.id, { status: "NAO_ATENDE" }), erro(/exige plano/));
    await gerarPlanoRequisito(q, s.id, { itens: [{ oQue: "Treinar equipe", quemId: q.usuarioId, quando: prazo }] });
    await registrarVerificacao(q, s.id, { status: "NAO_ATENDE" });
    await assert.rejects(registrarVerificacao(q, s.id, { status: "ATENDE", data: "2999-01-01" }), erro(/futura/));
    await excluirRequisito(q, r.id);
    await excluirRequisito(q, s.id);
  });

  await caso("histórico: verificação registra status anterior → novo; revisão geral mantém status e recalcula data", async () => {
    const r = await criarRequisito(q, { ...base, periodicidadeMeses: 6 });
    await registrarVerificacao(q, r.id, { status: "ATENDE", data: hoje, observacao: "Laudo OK" });
    const h = await listarHistoricoRequisito(q, r.id);
    assert.deepEqual(h.map((x) => x.acao), ["VERIFICACAO", "CRIACAO"]);
    assert.equal(h[0].statusAnterior, "EM_ANALISE");
    assert.equal(h[0].statusNovo, "ATENDE");
    await admin.requisitoLegal.update({ where: { id: r.id }, data: { proximaVerificacaoEm: new Date("2020-01-01T00:00:00Z") } });
    assert.ok((await listarRequisitos(q, { vencidos: true })).some((x) => x.id === r.id));
    const res = await revisaoGeralRequisitos(q, [r.id], hoje, "Revisão anual");
    assert.equal(res.revisados, 1);
    const d = (await obterRequisito(q, r.id))!;
    assert.equal(d.status, "ATENDE");
    assert.ok(d.proximaVerificacaoEm!.toISOString().slice(0, 10) > hoje);
    assert.equal((await listarHistoricoRequisito(q, r.id))[0].acao, "REVISAO_GERAL");
    await assert.rejects(revisaoGeralRequisitos(inspetor, [r.id], hoje), erro(/REQUISITO_LEGAL_GERENCIAR/));
    await excluirRequisito(q, r.id);
  });

  await caso("histórico imutável (trigger bloqueia UPDATE/DELETE)", async () => {
    const h = await admin.historicoRequisitoLegal.findFirstOrThrow({ where: { empresaId: e } });
    await assert.rejects(admin.historicoRequisitoLegal.update({ where: { id: h.id }, data: { observacao: "adulterado" } }), /imutável/);
    await assert.rejects(admin.historicoRequisitoLegal.delete({ where: { id: h.id } }), /imutável/);
  });

  await caso("evidência de atendimento via anexo REQUISITO_LEGAL (colaborador sem responsabilidade não envia)", async () => {
    const r = await criarRequisito(q, { ...base, obraId: alfa });
    await enviarAnexos(q, { tipo: "REQUISITO_LEGAL", entidadeId: r.id }, [{ nome: "licenca.png", dados: gerarPngExemplo() }]);
    assert.equal((await listarAnexos(inspetor, { tipo: "REQUISITO_LEGAL", entidadeId: r.id })).length, 1);
    await assert.rejects(enviarAnexos(colab, { tipo: "REQUISITO_LEGAL", entidadeId: r.id }, [{ nome: "x.png", dados: gerarPngExemplo() }]), erro(/Sem permissão/));
    assert.equal((await listarAnexos(demo, { tipo: "REQUISITO_LEGAL", entidadeId: r.id })).length, 0);
    await excluirRequisito(q, r.id);
  });

  await caso("isolamento: Demo não vê requisito nem histórico da Monto", async () => {
    const x = await admin.requisitoLegal.findFirstOrThrow({ where: { empresaId: e } });
    assert.equal(await demo.db.requisitoLegal.findFirst({ where: { id: x.id } }), null);
    assert.equal(await demo.db.historicoRequisitoLegal.count({ where: { requisitoId: x.id } }), 0);
  });

  await caso("código sequencial sem duplicata em paralelo", async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, () => criarRequisito(q, base)));
    assert.equal(new Set(rs.map((r) => r.codigo)).size, 6);
    for (const r of rs) await excluirRequisito(q, r.id);
  });

  await caso("dashboard: % de atendimento e vencidos", async () => {
    const r = await resumoRequisitos(q);
    assert.ok(r && r.total > 0);
    assert.ok(r.percentual !== null && r.percentual >= 0 && r.percentual <= 100);
    assert.ok(r.vencidos >= 0);
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
