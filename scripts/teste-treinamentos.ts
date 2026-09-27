/* Executar: npm run test:treinamentos (requer seed). Treinamentos e competências (P7): gating, permissão, matriz refletindo
 * presença/validade (vencido, a vencer, em dia, não realizado, reciclagem), recálculo ao mudar a validade, certificado
 * (participante lê, outros não), alerta de vencimento pelo cron (idempotente), isolamento e resumo do dashboard. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { listarAnexos } from "../src/lib/anexos/servico";
import { hojeNoFuso, somarDias } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { fontesReavaliacao, gerarAlertasReavaliacao } from "../src/lib/reavaliacao/fontes";
import "../src/lib/treinamentos/reavaliacao";
import {
  anexarCertificado,
  criarTreinamento,
  definirAtivoTreinamento,
  editarTreinamento,
  lancarPresencas,
  listarTreinamentos,
  matrizCompetencias,
  meusTreinamentos,
  registrarSessao,
  resumoTreinamentos,
  statusDoUsuario,
} from "../src/lib/treinamentos/servico";
import { gerarPdfExemplo } from "./pdf-exemplo";

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

async function main() {
  const q = await ator("qualidade@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const seg = await ator("seguranca@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const demo = await ator("admin@demo.com.br");
  const e = q.empresaId;
  const setorSeg = (await admin.setor.findUniqueOrThrow({ where: { empresaId_nome: { empresaId: e, nome: "Segurança" } } })).id;
  const base = { nome: `NR-teste ${sufixo}`, tipo: "NR" as const, cargaHoraria: 8, validadeMeses: 12, obrigatorioSetorIds: [setorSeg] };
  let tId = "";
  const celula = async (usuarioId: string) => {
    const m = await matrizCompetencias(q, { treinamentoId: tId, usuarioId });
    return m.linhas[0]?.celulas[0];
  };

  await caso("gating: Demo sem o módulo", async () => {
    await assert.rejects(listarTreinamentos(demo), erro(/não contratado/));
    assert.equal(await resumoTreinamentos(demo), null);
  });

  await caso("permissão: só TREINAMENTO_GERENCIAR cadastra, registra sessão, lança presença e vê a matriz", async () => {
    await assert.rejects(criarTreinamento(inspetor, base), erro(/TREINAMENTO_GERENCIAR/));
    await assert.rejects(criarTreinamento(colab, base), erro(/TREINAMENTO_GERENCIAR/));
    tId = (await criarTreinamento(q, base)).id;
    await assert.rejects(criarTreinamento(q, base), erro(/Já existe/));
    await assert.rejects(registrarSessao(inspetor, tId, { dataRealizacao: hoje, instrutor: "x" }), erro(/TREINAMENTO_GERENCIAR/));
    await assert.rejects(matrizCompetencias(colab), erro(/TREINAMENTO_GERENCIAR/));
    await assert.rejects(registrarSessao(q, tId, { dataRealizacao: somarDias(hoje, 1), instrutor: "Instrutor" }), erro(/futura/));
    await assert.rejects(statusDoUsuario(colab, inspetor.usuarioId, tId), erro(/outro usuário/));
    assert.ok((await listarTreinamentos(colab)).some((t) => t.id === tId)); // catálogo é aberto
  });

  await caso("matriz reflete presença e validade: vencido, a vencer, em dia, não realizado e reciclagem", async () => {
    const a = await registrarSessao(q, tId, { dataRealizacao: somarDias(hoje, -400), instrutor: "Instrutor A" });
    const pa = await lancarPresencas(q, a.id, [{ usuarioId: inspetor.usuarioId, presente: true }, { usuarioId: seg.usuarioId, presente: false }]);
    assert.equal((await celula(inspetor.usuarioId))!.status, "VENCIDO");
    assert.equal((await celula(seg.usuarioId))!.status, "NAO_REALIZADO"); // setor Segurança = obrigatório; ausente não conta
    assert.equal((await celula(colab.usuarioId))!.status, null); // sem setor: não obrigatório e não realizado
    const ausente = await admin.participacaoTreinamento.findUniqueOrThrow({ where: { id: pa.get(seg.usuarioId)! } });
    assert.equal(ausente.dataValidade, null);
    const b = await registrarSessao(q, tId, { dataRealizacao: somarDias(hoje, -350), instrutor: "Instrutor B" });
    await lancarPresencas(q, b.id, [{ usuarioId: seg.usuarioId, presente: true, aproveitamento: "8,5" }]);
    const cs = (await celula(seg.usuarioId))!;
    assert.equal(cs.status, "A_VENCER");
    assert.ok(cs.dataValidade! >= hoje && cs.dataValidade! <= somarDias(hoje, 30));
    // Reciclagem do inspetor resolve o vencido.
    const c = await registrarSessao(q, tId, { dataRealizacao: somarDias(hoje, -10), instrutor: "Instrutor C" });
    await lancarPresencas(q, c.id, [{ usuarioId: inspetor.usuarioId, presente: true }]);
    assert.equal((await celula(inspetor.usuarioId))!.status, "EM_DIA");
    assert.equal(await statusDoUsuario(inspetor, inspetor.usuarioId, tId), "EM_DIA");
    // Reenviar presença da mesma sessão atualiza (não duplica).
    await lancarPresencas(q, c.id, [{ usuarioId: inspetor.usuarioId, presente: true, aproveitamento: "10" }]);
    assert.equal(await admin.participacaoTreinamento.count({ where: { sessaoId: c.id } }), 1);
    const meus = await meusTreinamentos(inspetor);
    assert.equal(meus.itens.find((i) => i.treinamento.id === tId)!.status, "EM_DIA");
  });

  await caso("alerta de vencimento (TREINAMENTO_VENCENDO, 30 dias): só a última realização, idempotente", async () => {
    const fonte = fontesReavaliacao(["TREINAMENTOS"])[0];
    assert.ok(fonte && fonte.tipoNotificacao === "TREINAMENTO_VENCENDO" && fonte.diasAntecedencia === 30);
    const empresa = { id: e, fusoHorario: FUSO, modulosAtivos: ["TREINAMENTOS" as const] };
    const itens = await fonte.listarVencendo(q.db, empresa, hoje, 30);
    const doTreino = itens.filter((i) => i.link === `/treinamentos/${tId}`);
    assert.equal(doTreino.length, 1); // só o técnico de segurança (a vencer); o inspetor reciclou
    assert.ok(doTreino[0].usuarioIds.includes(seg.usuarioId) && doTreino[0].usuarioIds.includes(q.usuarioId));
    const conta = () => admin.notificacao.count({ where: { empresaId: e, usuarioId: seg.usuarioId, tipo: "TREINAMENTO_VENCENDO", link: `/treinamentos/${tId}` } });
    await gerarAlertasReavaliacao(q.db, empresa, hoje);
    assert.equal(await conta(), 1);
    await gerarAlertasReavaliacao(q.db, empresa, hoje);
    assert.equal(await conta(), 1);
  });

  await caso("mudar a validade recalcula as participações (sem validade → em dia)", async () => {
    await editarTreinamento(q, tId, { ...base, validadeMeses: null });
    assert.equal((await celula(seg.usuarioId))!.status, "EM_DIA");
    assert.equal((await celula(seg.usuarioId))!.dataValidade, null);
    await editarTreinamento(q, tId, { ...base, validadeMeses: 12 });
    assert.equal((await celula(seg.usuarioId))!.status, "A_VENCER");
  });

  await caso("certificado: gestor anexa; participante lê; colaborador não vê; participante não envia", async () => {
    const s = await registrarSessao(q, tId, { dataRealizacao: somarDias(hoje, -5), instrutor: "Instrutor D" });
    const p = await lancarPresencas(q, s.id, [{ usuarioId: inspetor.usuarioId, presente: true }]);
    const pid = p.get(inspetor.usuarioId)!;
    const pdf = gerarPdfExemplo("Certificado teste", ["Participante: inspetor"]);
    const { anexoId } = await anexarCertificado(q, pid, { nome: "certificado.pdf", dados: pdf });
    assert.equal((await admin.participacaoTreinamento.findUniqueOrThrow({ where: { id: pid } })).certificadoAnexoId, anexoId);
    assert.equal((await listarAnexos(inspetor, { tipo: "CERTIFICADO_TREINAMENTO", entidadeId: pid })).length, 1);
    assert.equal((await listarAnexos(colab, { tipo: "CERTIFICADO_TREINAMENTO", entidadeId: pid })).length, 0);
    await assert.rejects(anexarCertificado(inspetor, pid, { nome: "x.pdf", dados: pdf }), erro(/TREINAMENTO_GERENCIAR/));
    assert.equal((await celula(inspetor.usuarioId))!.status, "EM_DIA"); // nova sessão renova a validade
  });

  await caso("isolamento: Demo não vê treinamento, sessões nem participações da Monto", async () => {
    assert.equal(await demo.db.treinamento.findFirst({ where: { id: tId } }), null);
    assert.equal(await demo.db.sessaoTreinamento.count({ where: { treinamentoId: tId } }), 0);
    assert.equal(await demo.db.participacaoTreinamento.count({ where: { usuarioId: seg.usuarioId } }), 0);
    await assert.rejects(lancarPresencas(q, "00000000-0000-0000-0000-000000000000", [{ usuarioId: seg.usuarioId, presente: true }]), erro(/Sessão não encontrada/));
  });

  await caso("seed e dashboard: matriz com vencidos, a vencer e em dia; resumo por escopo", async () => {
    const m = await matrizCompetencias(q);
    const st = new Set(m.linhas.flatMap((l) => l.celulas.map((c) => c.status)));
    for (const s of ["EM_DIA", "A_VENCER", "VENCIDO", "NAO_REALIZADO"] as const) assert.ok(st.has(s), `seed sem célula ${s}`);
    const r = await resumoTreinamentos(q);
    assert.ok(r && r.escopo === "EMPRESA" && r.obrigatorias > 0 && r.percentualEmDia !== null);
    const rc = await resumoTreinamentos(colab);
    assert.ok(rc && rc.escopo === "PROPRIO");
  });

  await definirAtivoTreinamento(q, tId, false);
  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
