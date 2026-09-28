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
  avaliarEficacia,
  criarTreinamento,
  definirAtivoTreinamento,
  editarTreinamento,
  excluirGatilho,
  registrarGatilho,
  relatorioAuditoria,
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

  await caso("alertas escalados: 60 dias colaborador, 30 dias gestores, vencido a ambos — idempotentes", async () => {
    const fontes = fontesReavaliacao(["TREINAMENTOS"]);
    const por = (d: number) => fontes.find((f) => f.diasAntecedencia === d)!;
    assert.equal(fontes.length, 3);
    assert.ok(fontes.every((f) => f.tipoNotificacao === "TREINAMENTO_VENCENDO"));
    const empresa = { id: e, fusoHorario: FUSO, modulosAtivos: ["TREINAMENTOS" as const] };
    const doTreino = <T extends { link: string }>(xs: T[], id = tId) => xs.filter((x) => x.link === `/treinamentos/${id}`);
    // Técnico de segurança a vencer (≤ 30 dias): colaborador só ele; gestão = quem cadastrou + TREINAMENTO_GERENCIAR.
    const colabItens = doTreino(await por(60).listarVencendo(q.db, empresa, hoje, 60));
    assert.equal(colabItens.length, 1); // o inspetor reciclou
    assert.deepEqual(colabItens[0].usuarioIds, [seg.usuarioId]);
    const gestao = doTreino(await por(30).listarVencendo(q.db, empresa, hoje, 30));
    assert.equal(gestao.length, 1);
    assert.ok(gestao[0].usuarioIds.includes(q.usuarioId) && !gestao[0].usuarioIds.includes(inspetor.usuarioId));
    assert.equal(doTreino(await por(0).listarVencendo(q.db, empresa, hoje, 0)).length, 0);
    // Vencido (crítico): colaborador + gestores, mensagem de inaptidão.
    const t2 = (await criarTreinamento(q, { ...base, nome: `${base.nome} vencido`, critico: true })).id;
    const s2 = await registrarSessao(q, t2, { dataRealizacao: somarDias(hoje, -400), instrutor: "Instrutor V" });
    await lancarPresencas(q, s2.id, [{ usuarioId: colab.usuarioId, presente: true }]);
    const venc = doTreino(await por(0).listarVencendo(q.db, empresa, hoje, 0), t2);
    assert.equal(venc.length, 1);
    assert.ok(venc[0].usuarioIds.includes(colab.usuarioId) && venc[0].usuarioIds.includes(q.usuarioId) && venc[0].entidadeId.endsWith(":vencido:critico"));
    assert.equal(doTreino(await por(60).listarVencendo(q.db, empresa, hoje, 60), t2).length, 0); // vencido sai do aviso prévio
    const conta = (u: string, id: string) => admin.notificacao.count({ where: { empresaId: e, usuarioId: u, tipo: "TREINAMENTO_VENCENDO", link: `/treinamentos/${id}` } });
    await gerarAlertasReavaliacao(q.db, empresa, hoje);
    const [segN, colabN, qN] = [await conta(seg.usuarioId, tId), await conta(colab.usuarioId, t2), await conta(q.usuarioId, t2)];
    assert.ok(segN >= 1 && colabN === 1 && qN === 1);
    const n = await admin.notificacao.findFirstOrThrow({ where: { usuarioId: colab.usuarioId, link: `/treinamentos/${t2}` } });
    assert.match(n.corpo ?? "", /INAPTA/);
    await gerarAlertasReavaliacao(q.db, empresa, hoje);
    assert.deepEqual([await conta(seg.usuarioId, tId), await conta(colab.usuarioId, t2), await conta(q.usuarioId, t2)], [segN, 1, 1]);
    await definirAtivoTreinamento(q, t2, false);
  });

  await caso("obrigatoriedade por função: soma com setor; função inválida é recusada", async () => {
    const f = await admin.funcao.upsert({ where: { empresaId_nome: { empresaId: e, nome: "Função teste" } }, create: { empresaId: e, nome: "Função teste" }, update: {} });
    const antes = (await admin.usuario.findUniqueOrThrow({ where: { id: colab.usuarioId } })).funcaoId;
    await admin.usuario.update({ where: { id: colab.usuarioId }, data: { funcaoId: f.id } });
    try {
      assert.equal((await celula(colab.usuarioId))!.obrigatorio, false);
      await editarTreinamento(q, tId, { ...base, obrigatorioFuncaoIds: [f.id] });
      const c = (await celula(colab.usuarioId))!;
      assert.deepEqual([c.obrigatorio, c.status], [true, "NAO_REALIZADO"]);
      assert.equal((await celula(seg.usuarioId))!.obrigatorio, true); // setor continua valendo
      await assert.rejects(editarTreinamento(q, tId, { ...base, obrigatorioFuncaoIds: ["00000000-0000-0000-0000-000000000000"] }), erro(/Função inválida/));
      await editarTreinamento(q, tId, { ...base, obrigatorioTodos: true, obrigatorioFuncaoIds: [f.id] });
      assert.deepEqual((await admin.treinamento.findUniqueOrThrow({ where: { id: tId } })).obrigatorioFuncaoIds, []);
    } finally {
      await admin.usuario.update({ where: { id: colab.usuarioId }, data: { funcaoId: antes } });
      await editarTreinamento(q, tId, base);
    }
  });

  await caso("conscientização (ISO 7.3): ciência da revisão vigente conta; ciência anterior à publicação = reciclagem pendente", async () => {
    const doc = await admin.documento.findUniqueOrThrow({ where: { empresaId_codigo: { empresaId: e, codigo: "PR-001" } }, select: { id: true, versaoVigenteId: true, versaoVigente: { select: { publicacao: { select: { publicadoEm: true } } } } } });
    const pub = doc.versaoVigente!.publicacao!.publicadoEm;
    const ciencia = async (usuarioId: string, dias: number) => {
      const c = await admin.cienciaDocumento.findFirst({ where: { versaoId: doc.versaoVigenteId!, usuarioId } });
      return c ?? admin.cienciaDocumento.create({ data: { empresaId: e, versaoId: doc.versaoVigenteId!, usuarioId, confirmadoEm: new Date(pub.getTime() + dias * 86_400_000) } });
    };
    const antiga = await ciencia(inspetor.usuarioId, -3); // simula ciência de revisão anterior
    const atual = await ciencia(seg.usuarioId, 2);
    const tc = (await criarTreinamento(q, { nome: `Política SGI ${sufixo}`, tipo: "CONSCIENTIZACAO", validadeMeses: null, obrigatorioTodos: true, critico: true, documentoId: doc.id })).id;
    await assert.rejects(criarTreinamento(q, { nome: `x ${sufixo}`, tipo: "CONSCIENTIZACAO", documentoId: "00000000-0000-0000-0000-000000000000" }), erro(/Documento inválido/));
    const m = await matrizCompetencias(q, { treinamentoId: tc });
    const st = (u: string) => m.linhas.find((l) => l.usuario.id === u)!.celulas[0].status;
    assert.equal(st(seg.usuarioId), atual.confirmadoEm > pub ? "EM_DIA" : "RECICLAGEM_PENDENTE");
    assert.equal(st(inspetor.usuarioId), antiga.confirmadoEm < pub ? "RECICLAGEM_PENDENTE" : "EM_DIA");
    assert.equal(st(colab.usuarioId), "NAO_REALIZADO");
    assert.equal(m.linhas.find((l) => l.usuario.id === colab.usuarioId)!.aptidao.apto, false);
    assert.equal(await statusDoUsuario(seg, seg.usuarioId, tc), st(seg.usuarioId));
    assert.equal((await meusTreinamentos(colab)).itens.find((i) => i.treinamento.id === tc)!.status, "NAO_REALIZADO");
    await definirAtivoTreinamento(q, tc, false);
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

  await caso("gatilho de reciclagem: pendência calculada, torna inapto se crítico, resolvida por nova sessão", async () => {
    await editarTreinamento(q, tId, { ...base, critico: true });
    const antes = await matrizCompetencias(q, { treinamentoId: tId, usuarioId: seg.usuarioId });
    assert.equal(antes.linhas[0].aptidao.apto, true);
    await assert.rejects(registrarGatilho(inspetor, { usuarioId: seg.usuarioId, treinamentoIds: [tId], motivo: "RETORNO_AFASTAMENTO", dataEvento: hoje }), erro(/TREINAMENTO_GERENCIAR/));
    await assert.rejects(registrarGatilho(q, { usuarioId: seg.usuarioId, treinamentoIds: [tId], motivo: "RETORNO_AFASTAMENTO", dataEvento: somarDias(hoje, 1) }), erro(/futura/));
    await registrarGatilho(q, { usuarioId: seg.usuarioId, treinamentoIds: [tId], motivo: "RETORNO_AFASTAMENTO", dataEvento: somarDias(hoje, -2), descricao: "Afastamento 120 dias" });
    assert.equal((await celula(seg.usuarioId))!.status, "RECICLAGEM_PENDENTE");
    assert.equal(await statusDoUsuario(seg, seg.usuarioId, tId), "RECICLAGEM_PENDENTE");
    const m = await matrizCompetencias(q, { treinamentoId: tId, usuarioId: seg.usuarioId });
    assert.deepEqual(m.linhas[0].aptidao, { apto: false, pendencias: [{ treinamentoId: tId, status: "RECICLAGEM_PENDENTE" }] });
    assert.ok((await meusTreinamentos(seg)).aptidao.pendencias.some((x) => x.treinamentoId === tId));
    const s = await registrarSessao(q, tId, { dataRealizacao: somarDias(hoje, -1), instrutor: "Instrutor E" });
    await lancarPresencas(q, s.id, [{ usuarioId: seg.usuarioId, presente: true }]);
    assert.equal((await celula(seg.usuarioId))!.status, "EM_DIA");
    assert.ok(!(await meusTreinamentos(seg)).aptidao.pendencias.some((x) => x.treinamentoId === tId));
    // Excluir gatilho lançado por engano.
    await registrarGatilho(q, { usuarioId: inspetor.usuarioId, treinamentoIds: [tId], motivo: "OUTRO", dataEvento: hoje });
    assert.equal((await celula(inspetor.usuarioId))!.status, "RECICLAGEM_PENDENTE");
    const g = await admin.gatilhoReciclagem.findFirstOrThrow({ where: { usuarioId: inspetor.usuarioId, treinamentoId: tId } });
    await assert.rejects(excluirGatilho(demo, g.id), erro(/não contratado/));
    await excluirGatilho(q, g.id);
    assert.equal((await celula(inspetor.usuarioId))!.status, "EM_DIA");
    await editarTreinamento(q, tId, { ...base, critico: false });
  });

  await caso("eficácia e NR-1: avaliação só de presente, não eficaz exige ação; sessão conforme/pendente; auditoria", async () => {
    await editarTreinamento(q, tId, { ...base, diasAvaliacaoEficacia: 30 });
    const s = await registrarSessao(q, tId, {
      dataRealizacao: somarDias(hoje, -40),
      instrutor: "Instrutor F",
      cargaHoraria: 8,
      modalidade: "PRESENCIAL",
      conteudoProgramatico: "Riscos, medidas de controle, EPI",
      qualificacaoInstrutor: "Téc. Segurança do Trabalho",
    });
    const pendente = await registrarSessao(q, tId, { dataRealizacao: somarDias(hoje, -40), instrutor: "Instrutor G", cargaHoraria: 4 });
    await assert.rejects(registrarSessao(q, tId, { dataRealizacao: hoje, instrutor: "x", modalidade: "X" as never }), erro(/Modalidade/));
    const ps = await lancarPresencas(q, s.id, [{ usuarioId: inspetor.usuarioId, presente: true }, { usuarioId: seg.usuarioId, presente: false }]);
    await assert.rejects(avaliarEficacia(q, ps.get(seg.usuarioId)!, "EFICAZ"), erro(/presente/));
    await assert.rejects(avaliarEficacia(q, ps.get(inspetor.usuarioId)!, "NAO_EFICAZ"), erro(/ação/));
    await assert.rejects(avaliarEficacia(inspetor, ps.get(inspetor.usuarioId)!, "EFICAZ"), erro(/TREINAMENTO_GERENCIAR/));
    const aud0 = (await relatorioAuditoria(q)).itens.find((t) => t.id === tId)!;
    assert.equal(aud0.sessoes.find((x) => x.id === s.id)!.eficaciaPendente, 1);
    await avaliarEficacia(q, ps.get(inspetor.usuarioId)!, "EFICAZ", "Observado em campo");
    const p = await admin.participacaoTreinamento.findUniqueOrThrow({ where: { id: ps.get(inspetor.usuarioId)! } });
    assert.equal(p.eficaciaResultado, "EFICAZ");
    assert.equal(p.eficaciaAvaliadorId, q.usuarioId);
    // Virar ausente limpa a avaliação (CHECK do banco).
    await lancarPresencas(q, s.id, [{ usuarioId: inspetor.usuarioId, presente: false }]);
    assert.equal((await admin.participacaoTreinamento.findUniqueOrThrow({ where: { id: p.id } })).eficaciaResultado, null);
    await lancarPresencas(q, s.id, [{ usuarioId: inspetor.usuarioId, presente: true }]);
    await avaliarEficacia(q, p.id, "NAO_EFICAZ", "Refazer prática de resgate");
    const aud = (await relatorioAuditoria(q)).itens.find((t) => t.id === tId)!;
    const sa = aud.sessoes.find((x) => x.id === s.id)!;
    assert.deepEqual([sa.pendenciasNr1, sa.naoEficazes, sa.eficaciaPendente], [[], 1, 0]);
    assert.equal(aud.sessoes.find((x) => x.id === pendente.id)!.pendenciasNr1!.length, 3);
    await assert.rejects(relatorioAuditoria(colab), erro(/TREINAMENTO_GERENCIAR/));
    await editarTreinamento(q, tId, base);
  });

  await caso("isolamento: Demo não vê treinamento, sessões nem participações da Monto", async () => {
    assert.equal(await demo.db.gatilhoReciclagem.count({ where: { treinamentoId: tId } }), 0);
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
