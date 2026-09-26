/* Executar: npm run test:documentos (requer seed). Tramitação de Documentos: gating, arquivo inválido
 * recusado, código automático, elaborar → revisar/aprovar pelas actions de /aprovacoes (processo separado)
 * → publicar, obsolescência automática da revisão anterior, público restrito (quem não está não vê nem
 * baixa), ciência, rejeição, cancelamento, revisão publicada imutável (trigger), anexo de revisão não
 * excluível, fonte de revisão periódica, integração HIRA → revisão da planilha controlada e isolamento. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PrismaClient, type Prisma } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { abrirAnexo, excluirAnexo, listarAnexos } from "../src/lib/anexos/servico";
import { mesclarConfigAprovacao } from "../src/lib/aprovacao/config-modulo";
import { criarDbTenant } from "../src/lib/db-tenant";
import { podeLerVersao } from "../src/lib/documentos/acesso";
import { chavePlanilha } from "../src/lib/documentos/planilha";
import {
  cancelar,
  criarDocumento,
  enviarParaAprovacao,
  listarHistorico,
  listarMestra,
  listarVersoes,
  meusDocumentos,
  novaRevisao,
  obterDocumento,
  obsoletar,
  publicar,
  registrarCiencia,
  resumoDocumentos,
  salvarTipo,
  situacaoCienciasDocumento,
  substituirArquivo,
} from "../src/lib/documentos/servico";
import { ErroConflito, ErroNegocio } from "../src/lib/erros";
import { incluirHira } from "../src/lib/hira/servico";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { fontesReavaliacao } from "../src/lib/reavaliacao";
import "../src/lib/documentos/reavaliacao";
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
const pdf = (nome: string) => ({ nome, dados: gerarPdfExemplo(nome, ["Teste automatizado"]) });

/** Processo filho que carrega SÓ as actions de /aprovacoes (como o servidor) e decide o fluxo. */
async function modoFilho(fluxoId: string, email: string, decisao: "APROVAR" | "REJEITAR") {
  await import("../src/app/(app)/aprovacoes/actions");
  const { decidir } = await import("../src/lib/aprovacao");
  const r = await decidir(await ator(email), fluxoId, { decisao, comentario: decisao === "REJEITAR" ? "Ajustar o item 4." : null });
  console.log(JSON.stringify(r));
  await admin.$disconnect();
}
const decidirPelaTela = (fluxoId: string, email: string, decisao: "APROVAR" | "REJEITAR" = "APROVAR") =>
  execFileSync(process.execPath, [...process.execArgv, __filename, "--decidir", fluxoId, email, decisao], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

async function main() {
  const qual = await ator("qualidade@monto.com.br");
  const adm = await ator("admin@monto.com.br");
  const seg = await ator("seguranca@monto.com.br");
  const amb = await ator("meioambiente@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const adminDemo = await ator("admin@demo.com.br");
  const empresa = await admin.empresa.findUniqueOrThrow({ where: { id: qual.empresaId } });
  const configOriginal = empresa.config;
  const setorAmb = (await admin.setor.findFirstOrThrow({ where: { empresaId: empresa.id, nome: "Meio Ambiente" } })).id;
  const obraAlfa = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: empresa.id, nome: "Obra Alfa" } })).id;
  const criados: string[] = [];
  let tipoId = "";

  try {
    await caso("handlers.ts registra DOCUMENTO; /aprovacoes importa handlers", async () => {
      const { handlersRegistrados, TIPOS_COM_HANDLER } = await import("../src/lib/aprovacao/handlers");
      assert.deepEqual(handlersRegistrados(), [...TIPOS_COM_HANDLER]);
      assert.ok(TIPOS_COM_HANDLER.includes("DOCUMENTO"));
      assert.match(readFileSync("src/app/(app)/aprovacoes/actions.ts", "utf8"), /import "@\/lib\/aprovacao\/handlers";/);
    });

    await caso("permissões: Qualidade elabora e gerencia; colaborador/inspetor não; lista mestra restrita", async () => {
      assert.ok(qual.permissoes.includes("DOCUMENTO_ELABORAR") && qual.permissoes.includes("DOCUMENTO_GERENCIAR"));
      assert.ok(!colab.permissoes.includes("DOCUMENTO_ELABORAR") && !inspetor.permissoes.includes("DOCUMENTO_GERENCIAR"));
      await assert.rejects(listarMestra(colab), erro(/lista mestra/));
      assert.ok((await listarMestra(qual)).length >= 6, "seed com documentos");
    });

    await caso("tipos configuráveis: sigla normalizada e única", async () => {
      const t = (await admin.tipoDocumentoEmpresa.findFirst({ where: { empresaId: empresa.id, sigla: "TST" } })) ?? (await salvarTipo(qual, { nome: "Teste automatizado", sigla: "tst", periodicidadeRevisaoMeses: 6 }));
      tipoId = t.id;
      await admin.tipoDocumentoEmpresa.update({ where: { id: t.id }, data: { ativo: true } });
      await assert.rejects(salvarTipo(qual, { nome: "Outro nome", sigla: "TST", periodicidadeRevisaoMeses: 6 }), erro(/já existe/i));
      await assert.rejects(salvarTipo(colab, { nome: "X", sigla: "XX", periodicidadeRevisaoMeses: 6 }), erro(/permissão/));
    });

    await caso("arquivo inválido é recusado (conteúdo ≠ extensão) e nada é criado", async () => {
      const antes = await admin.documento.count({ where: { empresaId: empresa.id } });
      const falso = { nome: "procedimento.pdf", dados: new TextEncoder().encode("isto não é um PDF") };
      await assert.rejects(criarDocumento(qual, { tipoId, titulo: "Doc inválido", responsavelId: qual.usuarioId, arquivo: falso }), erro(/não corresponde|não permitido/));
      await assert.rejects(criarDocumento(qual, { tipoId, titulo: "Sem arquivo", responsavelId: qual.usuarioId, arquivo: null }), erro(/Anexe o arquivo/));
      await assert.rejects(criarDocumento(colab, { tipoId, titulo: "Sem permissão", responsavelId: colab.usuarioId, arquivo: pdf("a.pdf") }), erro(/DOCUMENTO_ELABORAR/));
      assert.equal(await admin.documento.count({ where: { empresaId: empresa.id } }), antes);
    });

    let docId = "";
    await caso("elaborar: código automático por tipo (TST-NNN), Rev. 00 em rascunho com arquivo", async () => {
      const r = await criarDocumento(seg, { tipoId, titulo: "Procedimento de teste A", responsavelId: seg.usuarioId, motivo: "Emissão inicial.", arquivo: pdf("teste-a.pdf") });
      const r2 = await criarDocumento(seg, { tipoId, titulo: "Procedimento de teste B", responsavelId: seg.usuarioId, arquivo: pdf("teste-b.pdf") });
      docId = r.id;
      criados.push(r.id, r2.id);
      assert.match(r.codigo, /^TST-\d{3}$/);
      assert.equal(Number(r2.codigo.slice(4)), Number(r.codigo.slice(4)) + 1, "sequência por tipo");
      const d = (await obterDocumento(seg, docId))!;
      assert.equal(d.status, "ELABORACAO");
      assert.equal(d.periodicidadeRevisaoMeses, 6, "periodicidade padrão do tipo");
      const vs = await listarVersoes(seg, docId);
      assert.equal(vs.length, 1);
      assert.equal(vs[0].numero, 0);
      assert.equal(vs[0].status, "RASCUNHO");
      assert.ok(vs[0].anexo);
      await substituirArquivo(seg, docId, { arquivo: pdf("teste-a-v2.pdf"), motivo: "Emissão inicial (ajustada)." });
      const [v] = await listarVersoes(seg, docId);
      assert.equal(v.anexo?.nomeArquivo, "teste-a-v2.pdf");
      assert.equal(v.motivo, "Emissão inicial (ajustada).");
    });

    await caso("enviar com revisor + aprovador (sequencial): EM_REVISAO → EM_APROVACAO → APROVADO via /aprovacoes", async () => {
      await assert.rejects(enviarParaAprovacao(seg, docId, { revisorIds: [qual.usuarioId], aprovadorIds: [qual.usuarioId], modo: "SEQUENCIAL" }), erro(/revisora e aprovadora/));
      const { fluxoId } = await enviarParaAprovacao(seg, docId, { revisorIds: [qual.usuarioId], aprovadorIds: [adm.usuarioId], modo: "SEQUENCIAL" });
      assert.equal((await obterDocumento(seg, docId))!.status, "EM_REVISAO");
      assert.equal((await listarVersoes(seg, docId))[0].status, "EM_APROVACAO");
      await assert.rejects(substituirArquivo(seg, docId, { arquivo: pdf("x.pdf") }), erro(/rascunho/));
      await assert.rejects(cancelar(seg, docId, "x"), erro(/aprovação pendente/));
      assert.match(decidirPelaTela(fluxoId, "qualidade@monto.com.br"), /"status":"PENDENTE"/);
      assert.equal((await obterDocumento(seg, docId))!.status, "EM_APROVACAO", "revisores assinaram (aoAvancar)");
      assert.match(decidirPelaTela(fluxoId, "admin@monto.com.br"), /"status":"APROVADO"/);
      assert.equal((await obterDocumento(seg, docId))!.status, "APROVADO");
      const [v] = await listarVersoes(seg, docId);
      assert.equal(v.status, "APROVADA");
      assert.ok(v.aprovadoEm);
      const acoes = (await listarHistorico(seg, docId)).map((h) => h.acao);
      assert.deepEqual(acoes.slice(0, 3), ["APROVACAO", "REVISADO", "ENVIO_APROVACAO"]);
    });

    await caso("publicar: só DOCUMENTO_GERENCIAR; público vazio recusado; restrito a colaborador + setor Meio Ambiente, exige ciência", async () => {
      const base = { publicoTodos: false, setorIds: [] as string[], obraIds: [] as string[], perfilIds: [] as string[], usuarioIds: [] as string[], notificar: true, exigirCiencia: true };
      await assert.rejects(publicar(seg, docId, { ...base, publicoTodos: true }), erro(/DOCUMENTO_GERENCIAR/));
      await assert.rejects(publicar(qual, docId, base), erro(/público/));
      await publicar(qual, docId, { ...base, setorIds: [setorAmb], usuarioIds: [colab.usuarioId] });
      const d = (await obterDocumento(qual, docId))!;
      assert.equal(d.status, "PUBLICADO");
      assert.equal(d.versaoVigente?.numero, 0);
      assert.ok(d.proximaRevisaoEm, "próxima revisão calculada");
      const ns = await admin.notificacao.findMany({ where: { entidadeTipo: "DOCUMENTO", entidadeId: docId, tipo: "CIENCIA_PENDENTE" } });
      assert.deepEqual(new Set(ns.map((n) => n.usuarioId)), new Set([colab.usuarioId, amb.usuarioId]), "notifica só o público");
    });

    await caso("público restrito: inspetor (fora do público) não vê, não baixa, não dá ciência; colaborador vê e baixa a vigente", async () => {
      assert.equal(await obterDocumento(inspetor, docId), null);
      assert.ok(!(await meusDocumentos(inspetor)).some((x) => x.id === docId));
      const vigente = (await obterDocumento(qual, docId))!.versaoVigente!;
      const anexoId = vigente.anexo!.id;
      assert.equal(await abrirAnexo(inspetor, anexoId), null);
      await assert.rejects(registrarCiencia(inspetor, docId), erro(/não foi publicado para você/));
      const meu = (await meusDocumentos(colab)).find((x) => x.id === docId);
      assert.ok(meu && meu.exigirCiencia && !meu.cienciaEm);
      const d = (await obterDocumento(colab, docId))!;
      assert.equal(d.acessoCompleto, false, "público vê só a vigente");
      assert.deepEqual(await listarVersoes(colab, docId), []);
      const r = await abrirAnexo(colab, anexoId);
      assert.ok(r);
      await r!.stream.cancel();
    });

    await caso("ciência: registra uma vez; situação mostra quem confirmou e quem falta", async () => {
      await registrarCiencia(colab, docId);
      await assert.rejects(registrarCiencia(colab, docId), erro(/já registrou/));
      const s = (await situacaoCienciasDocumento(qual, docId))!;
      assert.ok(s.exigirCiencia);
      assert.deepEqual(s.confirmaram.map((x) => x.id), [colab.usuarioId]);
      assert.ok(s.faltam.some((x) => x.id === amb.usuarioId));
      assert.ok(!s.faltam.some((x) => x.id === inspetor.usuarioId), "inspetor não está no público");
      assert.ok((await meusDocumentos(colab)).find((x) => x.id === docId)?.cienciaEm);
      assert.equal(await admin.notificacao.count({ where: { usuarioId: colab.usuarioId, entidadeId: docId, tipo: "CIENCIA_PENDENTE", lidaEm: null } }), 0, "notificação baixada");
    });

    await caso("revisão publicada é imutável (trigger) e seu arquivo não pode ser excluído", async () => {
      const v = await admin.versaoDocumento.findFirstOrThrow({ where: { documentoId: docId, numero: 0 } });
      await assert.rejects(admin.versaoDocumento.update({ where: { id: v.id }, data: { motivo: "adulterado" } }), /imutável/);
      await assert.rejects(admin.versaoDocumento.update({ where: { id: v.id }, data: { status: "RASCUNHO" } }), /imutável/);
      await assert.rejects(admin.versaoDocumento.delete({ where: { id: v.id } }), /imutável/);
      await assert.rejects(admin.publicacaoDocumento.deleteMany({ where: { versaoId: v.id } }), /imutável/);
      await assert.rejects(admin.historicoDocumento.updateMany({ where: { documentoId: docId }, data: { observacao: "x" } }), /imutável/);
      const [an] = await listarAnexos(qual, { tipo: "DOCUMENTO_VERSAO", entidadeId: v.id });
      assert.equal(an.podeExcluir, false);
      await assert.rejects(excluirAnexo(seg, an.id), erro(/não pode ser excluído/));
    });

    await caso("nova revisão: rejeição devolve a rascunho; aprovada e publicada obsoleta a anterior automaticamente", async () => {
      await assert.rejects(novaRevisao(colab, docId, { motivo: "x", arquivo: pdf("x.pdf") }), erro(/DOCUMENTO_ELABORAR/));
      const r = await novaRevisao(seg, docId, { motivo: "Inclusão do item 5.3.", arquivo: pdf("teste-a-rev01.pdf") });
      assert.equal(r.numero, 1);
      await assert.rejects(novaRevisao(seg, docId, { motivo: "outra", arquivo: pdf("y.pdf") }), erro(/não pode passar|Já existe/));
      assert.equal((await obterDocumento(qual, docId))!.status, "ELABORACAO");
      assert.equal((await obterDocumento(colab, docId))!.versaoVigente?.numero, 0, "a vigente continua valendo para o público");
      const f1 = await enviarParaAprovacao(seg, docId, { revisorIds: [], aprovadorIds: [adm.usuarioId], modo: "PARALELO" });
      assert.equal((await obterDocumento(qual, docId))!.status, "EM_APROVACAO");
      assert.match(decidirPelaTela(f1.fluxoId, "admin@monto.com.br", "REJEITAR"), /REJEITADO/);
      assert.equal((await obterDocumento(qual, docId))!.status, "ELABORACAO");
      assert.equal((await listarVersoes(qual, docId))[0].status, "RASCUNHO");
      const f2 = await enviarParaAprovacao(seg, docId, { revisorIds: [], aprovadorIds: [adm.usuarioId], modo: "SEQUENCIAL" });
      assert.match(decidirPelaTela(f2.fluxoId, "admin@monto.com.br"), /APROVADO/);
      await publicar(qual, docId, { publicoTodos: true, setorIds: [], obraIds: [], perfilIds: [], usuarioIds: [], notificar: false, exigirCiencia: false });
      const vs = await listarVersoes(qual, docId);
      assert.deepEqual(vs.map((v) => [v.numero, v.status]), [[1, "PUBLICADA"], [0, "OBSOLETA"]]);
      assert.ok(vs[1].obsoletoEm);
      assert.equal((await obterDocumento(qual, docId))!.versaoVigente?.numero, 1);
      assert.ok((await listarHistorico(qual, docId)).some((h) => h.acao === "OBSOLESCENCIA"));
      // Rev. 00 obsoleta: o público não baixa mais o arquivo antigo; a nova (público todos) sim.
      assert.equal((await podeLerVersao(colab, vs[1].id)).ler, false);
      assert.equal((await podeLerVersao(inspetor, vs[0].id)).ler, true);
      assert.ok((await meusDocumentos(inspetor)).some((x) => x.id === docId));
    });

    await caso("cancelar: documento sem vigente vira CANCELADO; obsoletar retira de uso", async () => {
      const b = criados[1];
      await assert.rejects(cancelar(colab, b, "x"), erro(/DOCUMENTO_ELABORAR/));
      await cancelar(seg, b, "Duplicado.");
      assert.equal((await obterDocumento(qual, b))!.status, "CANCELADO");
      assert.ok(!(await listarMestra(qual)).some((x) => x.id === b), "fora da lista padrão");
      await assert.rejects(obsoletar(seg, docId, "x"), erro(/DOCUMENTO_GERENCIAR/));
      const d = (await obterDocumento(qual, docId))!;
      await assert.rejects(obsoletar(qual, docId, "x", d.versao - 1), (e: unknown) => e instanceof ErroConflito);
    });

    await caso("fonte de revisão periódica (REVISAO_DOCUMENTO_PROXIMA) e dashboard", async () => {
      await admin.documento.update({ where: { id: docId }, data: { proximaRevisaoEm: new Date("2026-01-01T00:00:00.000Z") } });
      const fonte = fontesReavaliacao(["DOCUMENTOS"]).find((f) => f.modulo === "DOCUMENTOS");
      assert.ok(fonte);
      assert.equal(fonte!.tipoNotificacao, "REVISAO_DOCUMENTO_PROXIMA");
      const itens = await fonte!.listarVencendo(qual.db, { id: qual.empresaId, fusoHorario: "America/Sao_Paulo", modulosAtivos: ["DOCUMENTOS"] }, "2026-09-26", 15);
      assert.ok(itens.some((i) => i.entidadeId === docId && i.usuarioIds.includes(seg.usuarioId)));
      assert.ok((await listarMestra(qual, { vencidas: true })).some((x) => x.id === docId));
      const r = (await resumoDocumentos(qual))!;
      assert.ok(r.mestra && r.revisoesVencidas >= 1);
      const rc = (await resumoDocumentos(colab))!;
      assert.equal(rc.mestra, false);
    });

    await caso("integração HIRA: com 'usar tramitação', aprovação registra revisão da planilha controlada (snapshot JSON)", async () => {
      await admin.empresa.update({
        where: { id: empresa.id },
        data: { config: mesclarConfigAprovacao(configOriginal, "hira", { exigir: true, aprovadorIds: [adm.usuarioId], modo: "SEQUENCIAL", usarTramitacao: true }) as Prisma.InputJsonValue },
      });
      const antes = await admin.documento.findFirst({ where: { empresaId: empresa.id, chavePlanilha: chavePlanilha("HIRA", obraAlfa) }, include: { versoes: true } });
      const r = await incluirHira(seg, {
        obraId: obraAlfa, setor: "Teste", processoId: null, atividade: "Atividade de teste (documentos)", rotineira: true, perigo: "Perigo teste", risco: "Risco teste",
        condicao: "NORMAL", controlesExistentes: null, hierarquiaControle: null, controlesPropostos: null, probabilidade: 2, severidade: 2,
        probabilidadeResidual: null, severidadeResidual: null, requisitoLegal: null, responsavelId: null, modoReavaliacao: "ITEM", periodicidadeMeses: 12,
      });
      try {
        assert.match(decidirPelaTela(r.fluxoId!, "admin@monto.com.br"), /APROVADO/);
        const doc = await admin.documento.findFirstOrThrow({ where: { empresaId: empresa.id, chavePlanilha: chavePlanilha("HIRA", obraAlfa) }, include: { versoes: { orderBy: { numero: "desc" } }, tipo: true } });
        assert.equal(doc.tipo.sigla, "PL");
        assert.equal(doc.versoes.length, (antes?.versoes.length ?? 0) + 1);
        const v = doc.versoes[0];
        assert.equal(v.status, "PUBLICADA");
        assert.equal(v.fluxoAprovacaoId, r.fluxoId);
        assert.equal(doc.versaoVigenteId, v.id);
        const conteudo = v.conteudo as { linhas: { atividade: string }[] };
        assert.ok(conteudo.linhas.some((l) => l.atividade === "Atividade de teste (documentos)"));
        if (doc.versoes[1]) assert.equal(doc.versoes[1].status, "OBSOLETA", "revisão anterior da planilha obsoleta");
      } finally {
        await admin.linhaHira.updateMany({ where: { id: r.id }, data: { status: "INATIVA" } });
      }
    });

    await caso("gating: Demo sem DOCUMENTOS → negado; dashboard null", async () => {
      await assert.rejects(listarMestra(adminDemo), erro(/não contratado/));
      await assert.rejects(meusDocumentos(adminDemo), erro(/não contratado/));
      assert.equal(await resumoDocumentos(adminDemo), null);
    });

    await caso("isolamento: Demo (com o módulo) não vê, não baixa, não altera documento da Monto", async () => {
      const demo = await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } });
      await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: [...demo.modulosAtivos, "DOCUMENTOS"] } });
      try {
        assert.equal(await obterDocumento(adminDemo, docId), null);
        assert.ok(!(await listarMestra(adminDemo, { todos: true })).some((x) => x.id === docId));
        assert.ok(!(await meusDocumentos(adminDemo)).some((x) => x.id === docId));
        const an = (await obterDocumento(qual, docId))!.versaoVigente!.anexo!.id;
        assert.equal(await abrirAnexo(adminDemo, an), null);
        await assert.rejects(registrarCiencia(adminDemo, docId), erro(/sem revisão vigente/));
        await assert.rejects(novaRevisao(adminDemo, docId, { motivo: "x", arquivo: pdf("z.pdf") }), erro(/não encontrado/));
        await assert.rejects(criarDocumento(adminDemo, { tipoId, titulo: "Cruzado", responsavelId: adminDemo.usuarioId, arquivo: pdf("c.pdf") }), erro(/Tipo de documento inválido/));
        assert.deepEqual(await listarHistorico(adminDemo, docId), []);
      } finally {
        await admin.empresa.update({ where: { id: demo.id }, data: { modulosAtivos: demo.modulosAtivos } });
      }
    });
  } finally {
    await admin.empresa.update({ where: { id: empresa.id }, data: { config: configOriginal as Prisma.InputJsonValue } });
    // Documentos e histórico são imutáveis: os de teste ficam obsoletos/cancelados e o tipo TST inativo.
    for (const id of criados) {
      const d = await admin.documento.findUnique({ where: { id } });
      if (d?.status === "PUBLICADO") await obsoletar(qual, id, "Documento de teste automatizado.").catch(() => undefined);
    }
    if (tipoId) await admin.tipoDocumentoEmpresa.update({ where: { id: tipoId }, data: { ativo: false } });
    await admin.$disconnect();
  }
  console.log(`\n${ok} casos OK (Documentos).`);
}

const i = process.argv.indexOf("--decidir");
(i > 0 ? modoFilho(process.argv[i + 1], process.argv[i + 2], process.argv[i + 3] as "APROVAR" | "REJEITAR") : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
