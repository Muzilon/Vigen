/* Executar: npm run test:incidentes (requer seed). Incidentes e acidentes: gating, permissão, escopo por obra, restrição
 * LGPD (quem não tem INCIDENTE_VER_RESTRITOS não vê o restrito nem os dados sensíveis — nem sabe que existem), ciclo
 * aberto → investigação → concluído, plano de ação de investigação, histórico imutável, isolamento e código sequencial. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { abrirAnexo, enviarAnexos, listarAnexos } from "../src/lib/anexos/servico";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroNegocio } from "../src/lib/erros";
import {
  concluirIncidente,
  definirResponsavel,
  editarIncidente,
  gerarPlanoIncidente,
  iniciarInvestigacao,
  listarHistoricoIncidente,
  listarIncidentes,
  obterIncidente,
  registrarIncidente,
  resumoIncidentes,
  salvarInvestigacao,
} from "../src/lib/incidentes/servico";
import { criarInteracao } from "../src/lib/interacoes/servico";
import { permissoesEfetivas } from "../src/lib/permissoes";
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
const prazo = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);
const ontem = () => new Date(Date.now() - 86_400_000);

async function main() {
  const seg = await ator("seguranca@monto.com.br"); // GERENCIAR + VER_RESTRITOS
  const q = await ator("qualidade@monto.com.br"); // GERENCIAR, sem VER_RESTRITOS
  const inspetor = await ator("inspetor@monto.com.br"); // só Obra Alfa
  const colab = await ator("colaborador@monto.com.br"); // só Obra Alfa, sem permissões de incidente
  const demo = await ator("admin@demo.com.br");
  const e = seg.empresaId;
  const alfa = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Alfa" } })).id;
  const beta = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: e, nome: "Obra Beta" } })).id;
  const base = { tipo: "QUASE_ACIDENTE" as const, gravidade: "SEM_AFASTAMENTO" as const, dataHora: ontem(), obraId: alfa, descricaoFatos: "Teste automatizado de incidente." };

  await caso("gating: Demo sem o módulo", async () => {
    await assert.rejects(listarIncidentes(demo), erro(/não contratado/));
    await assert.rejects(registrarIncidente(demo, base), erro(/não contratado/));
    assert.equal(await resumoIncidentes(demo), null);
  });

  await caso("registro aberto a quem tem a obra; escopo por obra (inspetor não registra nem vê a Beta)", async () => {
    const i = await registrarIncidente(colab, base);
    assert.match(i.codigo, /^INC-\d{3}-\d{2}$/);
    assert.equal(i.restrita, false);
    await assert.rejects(registrarIncidente(inspetor, { ...base, obraId: beta }), erro(/Obra/));
    const b = await registrarIncidente(seg, { ...base, obraId: beta });
    assert.equal(await obterIncidente(inspetor, b.id), null);
    assert.ok(!(await listarIncidentes(inspetor)).some((x) => x.id === b.id));
    assert.ok(await obterIncidente(inspetor, i.id));
    await assert.rejects(registrarIncidente(seg, { ...base, dataHora: new Date(Date.now() + 86_400_000) }), erro(/futura/));
    await assert.rejects(registrarIncidente(seg, { ...base, envolvidoId: colab.usuarioId, terceiroNome: "Fulano" }), erro(/não os dois/));
  });

  await caso("permissão: colaborador não investiga nem gera plano; gestor investiga", async () => {
    const i = await registrarIncidente(colab, base);
    await assert.rejects(iniciarInvestigacao(colab, i.id), erro(/INCIDENTE_GERENCIAR/));
    await assert.rejects(gerarPlanoIncidente(colab, i.id, { itens: [{ oQue: "x", quemId: colab.usuarioId, quando: prazo }] }), erro(/INCIDENTE_GERENCIAR/));
    await assert.rejects(definirResponsavel(colab, i.id, seg.usuarioId), erro(/INCIDENTE_GERENCIAR/));
    await iniciarInvestigacao(q, i.id);
    assert.equal((await obterIncidente(q, i.id))!.responsavelId, q.usuarioId);
  });

  let restritoId = "";
  let anexoSensivelId = "";
  await caso("LGPD: com envolvido/dados sensíveis fica restrito; sem permissão não vê o registro nem os dados", async () => {
    const i = await registrarIncidente(inspetor, {
      ...base,
      tipo: "ACIDENTE_TIPICO",
      envolvidoId: colab.usuarioId,
      testemunhas: "Testemunha Teste",
      sensiveis: { nomeEnvolvido: "Pessoa Sigilosa", documentoEnvolvido: "999.888.777-66", relato: "Relato sigiloso do envolvido" },
    });
    restritoId = i.id;
    assert.equal(i.restrita, true);
    assert.equal(i.contemDadosPessoais, true);
    // Quem pode ver restritos vê tudo.
    const s = (await obterIncidente(seg, i.id))!;
    assert.equal(s.dadosSensiveis?.documentoEnvolvido, "999.888.777-66");
    assert.equal(s.envolvido?.id, colab.usuarioId);
    // Gestor sem INCIDENTE_VER_RESTRITOS e colaborador: não veem o registro (nem na lista).
    assert.equal(await obterIncidente(q, i.id), null);
    assert.ok(!(await listarIncidentes(q)).some((x) => x.id === i.id));
    assert.equal(await obterIncidente(colab, i.id), null);
    // Quem registrou (sem a permissão) vê o fato, mas nada pessoal — nem sinal de que existe.
    const r = (await obterIncidente(inspetor, i.id))!;
    assert.equal(r.dadosSensiveis, null);
    assert.equal(r.envolvido, null);
    assert.equal(r.testemunhas, null);
    assert.equal(r.contemDadosPessoais, false);
    const json = JSON.stringify(r);
    assert.ok(!json.includes("999.888.777-66") && !json.includes("Pessoa Sigilosa") && !json.includes("Testemunha Teste"));
    // Anexo sensível: só quem vê restritos envia/lê/baixa.
    const [an] = await enviarAnexos(seg, { tipo: "INCIDENTE_DADOS_SENSIVEIS", entidadeId: i.id }, [{ nome: "atestado.png", dados: gerarPngExemplo() }]);
    anexoSensivelId = an.id;
    assert.equal(an.sensivel, true);
    assert.equal((await listarAnexos(seg, { tipo: "INCIDENTE_DADOS_SENSIVEIS", entidadeId: i.id })).length, 1);
    assert.equal((await listarAnexos(inspetor, { tipo: "INCIDENTE_DADOS_SENSIVEIS", entidadeId: i.id })).length, 0);
    assert.equal(await abrirAnexo(inspetor, anexoSensivelId), null);
    assert.equal(await abrirAnexo(q, anexoSensivelId), null);
    await assert.rejects(enviarAnexos(inspetor, { tipo: "INCIDENTE_DADOS_SENSIVEIS", entidadeId: i.id }, [{ nome: "x.png", dados: gerarPngExemplo() }]), erro(/não encontrado|sem acesso/));
    // Comentários: quem não vê o registro não comenta.
    await assert.rejects(criarInteracao(q, { tipo: "INCIDENTE", entidadeId: i.id }, "oi"), erro(/sem acesso/));
    // Responsável de incidente restrito precisa da permissão de ver restritos.
    await assert.rejects(definirResponsavel(seg, i.id, q.usuarioId), erro(/restrito/));
    // Notificação de registro só para quem pode ver (sem dados pessoais no texto).
    const ns = await admin.notificacao.findMany({ where: { entidadeTipo: "INCIDENTE", entidadeId: i.id } });
    assert.ok(ns.length > 0);
    assert.ok(!ns.some((n) => n.usuarioId === q.usuarioId));
    assert.ok(!ns.some((n) => /Sigilosa|999\.888/.test(n.titulo + n.corpo)));
  });

  await caso("ciclo com plano de investigação: concluir exige causa raiz; título do plano neutro no restrito; concluído não muda", async () => {
    await iniciarInvestigacao(seg, restritoId);
    await assert.rejects(concluirIncidente(seg, restritoId, { conclusao: "cedo demais" }), erro(/causa raiz/));
    await salvarInvestigacao(seg, restritoId, { metodo: "CINCO_PORQUES", analise: { porques: ["a", "b"] }, causaRaiz: "Luva danificada sem reposição." });
    await assert.rejects(salvarInvestigacao(seg, restritoId, { metodo: "ISHIKAWA", analise: { invalido: 1 }, causaRaiz: "x x x" }), ErroNegocio);
    const p = await gerarPlanoIncidente(seg, restritoId, { titulo: "Título com Pessoa Sigilosa", itens: [{ oQue: "Repor luvas", quemId: seg.usuarioId, quando: prazo }] });
    const plano = await admin.planoAcao.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(plano.origemTipo, "INCIDENTE");
    assert.equal(plano.origemId, restritoId);
    assert.equal(plano.obraId, alfa);
    assert.ok(!plano.titulo.includes("Sigilosa"));
    await assert.rejects(gerarPlanoIncidente(seg, restritoId, { itens: [{ oQue: "x", quemId: seg.usuarioId, quando: prazo }] }), erro(/já tem plano/));
    await concluirIncidente(seg, restritoId, { conclusao: "Investigação concluída." });
    await assert.rejects(editarIncidente(seg, restritoId, { ...base, tipo: "ACIDENTE_TIPICO" }), erro(/concluído/));
    const h = await listarHistoricoIncidente(seg, restritoId);
    assert.deepEqual(h.map((x) => x.acao).reverse(), ["REGISTRO", "STATUS", "INVESTIGACAO", "PLANO", "STATUS"]);
    assert.equal(h[0].statusNovo, "CONCLUIDO");
  });

  await caso("histórico imutável (trigger bloqueia UPDATE/DELETE)", async () => {
    const h = await admin.historicoIncidente.findFirstOrThrow({ where: { empresaId: e } });
    await assert.rejects(admin.historicoIncidente.update({ where: { id: h.id }, data: { observacao: "adulterado" } }), /imutável/);
    await assert.rejects(admin.historicoIncidente.delete({ where: { id: h.id } }), /imutável/);
  });

  await caso("isolamento: Demo não vê incidente, dados sensíveis nem anexo da Monto", async () => {
    assert.equal(await demo.db.incidente.findFirst({ where: { id: restritoId } }), null);
    assert.equal(await demo.db.incidenteDadosSensiveis.count({ where: { incidenteId: restritoId } }), 0);
    assert.equal(await abrirAnexo(demo, anexoSensivelId), null);
  });

  await caso("código sequencial sem duplicata em paralelo", async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, () => registrarIncidente(seg, base)));
    assert.equal(new Set(rs.map((r) => r.codigo)).size, 6);
  });

  await caso("dashboard: contagem por gravidade e taxa mensal (só o que o ator vê)", async () => {
    const rs = await resumoIncidentes(seg);
    const rq = await resumoIncidentes(q);
    assert.ok(rs && rq);
    assert.equal(rs.total, rs.porGravidade.SEM_AFASTAMENTO + rs.porGravidade.COM_AFASTAMENTO + rs.porGravidade.FATALIDADE);
    assert.ok(rs.total > rq.total, "quem não vê restritos conta menos");
    assert.equal(rs.taxaMensal, Math.round((rs.total / 12) * 10) / 10);
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
