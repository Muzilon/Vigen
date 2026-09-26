/* Executar: npm run test:fluxo-rnc (requer seed). Cria dados reais (histórico é append-only). */
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { hojeNoFuso } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { garantirUsuarioSemObra } from "./util-teste";
import { autenticar, LIMITE_LOGIN } from "../src/lib/auth/limite-login";
import { contarNaoLidas, criarInteracao, listarInteracoes, listarNaoLidas, marcarLidas } from "../src/lib/interacoes/servico";
import { adicionarItensRnc, cancelarItem, concluirItem, marcarEmAndamento } from "../src/lib/plano-acao/servico";
import { contarNotificacoesNaoLidas } from "../src/lib/notificacoes/servico";
import {
  alterarResponsavel,
  assumirAnalise,
  criarRnc,
  filtroAcessoItem,
  filtroAcessoRnc,
  decidirCancelamento,
  enviarParaVerificacao,
  iniciarExecucao,
  salvarCausaRaiz,
  solicitarCancelamento,
  verificarEficacia,
} from "../src/lib/rnc/servico";

const admin = new PrismaClient();
// E-mails das notificações vão para um diretório temporário (driver arquivo).
process.env.EMAIL_DRIVER = "arquivo";
process.env.EMAIL_DIR = path.join(tmpdir(), "vigen-emails-teste-fluxo");
let ok = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log("  OK", nome);
}

async function ator(email: string): Promise<Ator> {
  const u = await admin.usuario.findUniqueOrThrow({
    where: { email },
    include: { perfil: true, acessosObra: true },
  });
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

async function main() {
  const inspetor = await ator("inspetor@monto.com.br");
  const qualidade = await ator("qualidade@monto.com.br");
  // Colaborador SEM obra (usuário de teste): o seed dá Obra Alfa ao colaborador@monto.
  const colaborador = await ator((await garantirUsuarioSemObra(admin, "colab-sem-obra.teste@monto.com.br")).email);
  const adminMonto = await ator("admin@monto.com.br");
  const obra = inspetor.obrasPermitidas![0];
  const prazo = hojeNoFuso("America/Sao_Paulo");
  const rncDb = (id: string) => admin.rnc.findUniqueOrThrow({ where: { id }, include: { planoAcao: { include: { itens: true } } } });

  console.log("Fluxo completo da RNC:");
  let id = "";
  await caso("abrir RNC (numeração RNC-NNN-AA, status ABERTO)", async () => {
    const r = await criarRnc(inspetor, {
      titulo: "Teste E2E — concreto fora de especificação",
      descricao: "Slump acima do especificado",
      tipo: "QUALIDADE",
      origem: "INSPECAO",
      gravidade: "ALTA",
      obraId: obra,
    });
    id = r.id;
    assert.match(r.codigo, /^RNC-\d{3,}-\d{2}$/);
    assert.equal(r.status, "ABERTO");
  });

  await caso("colaborador (sem obra) não vê a RNC", async () => {
    await assert.rejects(assumirAnalise(colaborador, id), /não encontrada|permissão/);
  });

  await caso("assumir -> EM_ANALISE; versão obsoleta gera conflito", async () => {
    await assert.rejects(assumirAnalise(inspetor, id, 99), /alterado por outra pessoa/);
    await assumirAnalise(inspetor, id, 0);
    const r = await rncDb(id);
    assert.equal(r.status, "EM_ANALISE");
    assert.equal(r.responsavelId, inspetor.usuarioId);
  });

  await caso("não executa sem causa raiz e plano", async () => {
    await assert.rejects(iniciarExecucao(inspetor, id), /causa raiz/);
  });

  await caso("causa raiz (5 porquês) + plano com 2 itens -> PLANO_EM_EXECUCAO", async () => {
    await salvarCausaRaiz(inspetor, id, {
      metodo: "CINCO_PORQUES",
      analise: { porques: ["a", "b", "c", "d", "e"] },
      causaRaiz: "Falta de controle de água na usina",
    });
    await adicionarItensRnc(inspetor, id, [
      { oQue: "Treinar equipe", quemId: colaborador.usuarioId, quando: prazo },
      { oQue: "Revisar traço", quemId: inspetor.usuarioId, quando: prazo },
    ]);
    await iniciarExecucao(inspetor, id);
    const r = await rncDb(id);
    assert.equal(r.status, "PLANO_EM_EXECUCAO");
    assert.equal(r.planoAcao?.itens.length, 2);
    assert.ok(r.planoAcao!.itens.every((i) => i.ciclo === 1));
  });

  await caso("não envia à verificação com itens abertos; quem conclui seus itens", async () => {
    await assert.rejects(enviarParaVerificacao(inspetor, id), /concluídos ou cancelados/);
    const itens = (await rncDb(id)).planoAcao!.itens;
    const doColab = itens.find((i) => i.quemId === colaborador.usuarioId)!;
    const doInsp = itens.find((i) => i.quemId === inspetor.usuarioId)!;
    await assert.rejects(concluirItem(inspetor, doColab.id, { dataConclusao: prazo, evidencia: "x" }), /Somente o responsável/);
    // B4: "quem" de outra obra não abre a RNC, mas vê e executa o próprio item.
    assert.equal(await colaborador.db.rnc.findFirst({ where: { AND: [{ id }, filtroAcessoRnc(colaborador)] } }), null);
    const visiveis = await colaborador.db.itemAcao.findMany({
      where: { AND: [{ planoAcao: { rnc: { is: { id } } } }, filtroAcessoItem(colaborador)] },
    });
    assert.deepEqual(visiveis.map((i) => i.id), [doColab.id]); // só o próprio item
    await assert.rejects(listarInteracoes(colaborador, { tipo: "RNC", entidadeId: id }), /sem acesso/);
    await marcarEmAndamento(colaborador, doColab.id);
    await concluirItem(colaborador, doColab.id, { dataConclusao: prazo, evidencia: "Lista de presença" });
    await concluirItem(inspetor, doInsp.id, { dataConclusao: prazo, evidencia: "Traço revisado" });
    await enviarParaVerificacao(inspetor, id);
    assert.equal((await rncDb(id)).status, "EM_VERIFICACAO");
  });

  await caso("inspetor não pode verificar; qualidade verifica INEFICAZ -> REABERTO", async () => {
    await assert.rejects(verificarEficacia(inspetor, id, { eficaz: true, comentario: "x" }), /permissão/);
    const { aviso } = await verificarEficacia(qualidade, id, { eficaz: false, comentario: "Reincidência" });
    assert.equal(aviso, null);
    const r = await rncDb(id);
    assert.equal(r.status, "REABERTO");
    assert.equal(r.eficaz, false);
  });

  await caso("reabrir -> EM_ANALISE; novo ciclo (2) no mesmo plano", async () => {
    await assumirAnalise(inspetor, id);
    const antes = await rncDb(id);
    await adicionarItensRnc(inspetor, id, [{ oQue: "Instalar hidrômetro", quemId: qualidade.usuarioId, quando: prazo }]);
    const r = await rncDb(id);
    assert.equal(r.planoAcaoId, antes.planoAcaoId);
    const novo = r.planoAcao!.itens.find((i) => i.oQue === "Instalar hidrômetro")!;
    assert.equal(novo.ciclo, 2);
    await iniciarExecucao(inspetor, id);
    await concluirItem(qualidade, novo.id, { dataConclusao: prazo, evidencia: "Instalado" });
    await enviarParaVerificacao(inspetor, id);
  });

  await caso("verificação EFICAZ -> ENCERRADO (com aviso de conflito ao verificador executor)", async () => {
    const { aviso } = await verificarEficacia(qualidade, id, { eficaz: true, comentario: "Sem reincidência" });
    assert.ok(aviso);
    const r = await admin.rnc.findUniqueOrThrow({ where: { id }, include: { verificacoes: true, historicoStatus: true } });
    assert.equal(r.status, "ENCERRADO");
    assert.equal(r.eficaz, true);
    assert.equal(r.verificacoes.length, 2);
    assert.deepEqual(
      r.historicoStatus.sort((a, b) => +a.criadoEm - +b.criadoEm).map((h) => h.statusNovo),
      ["ABERTO", "EM_ANALISE", "PLANO_EM_EXECUCAO", "EM_VERIFICACAO", "REABERTO", "EM_ANALISE", "PLANO_EM_EXECUCAO", "EM_VERIFICACAO", "ENCERRADO"],
    );
  });

  console.log("Cancelamento:");
  await caso("solicitar (motivo) + aprovar -> CANCELADO", async () => {
    const r = await criarRnc(inspetor, {
      titulo: "Teste E2E — cancelamento",
      descricao: "Aberta em duplicidade",
      tipo: "MEIO_AMBIENTE",
      origem: "AUTO_IDENTIFICADA",
      gravidade: "BAIXA",
      obraId: obra,
    });
    await assert.rejects(solicitarCancelamento(inspetor, r.id, "  "), /Motivo/);
    const s = await solicitarCancelamento(inspetor, r.id, "Duplicada");
    assert.equal(s.statusRncNaSolicitacao, "ABERTO");
    await assert.rejects(solicitarCancelamento(inspetor, r.id, "de novo"), /pendente/);
    await assert.rejects(decidirCancelamento(inspetor, s.id, true), /permissão/);
    await decidirCancelamento(qualidade, s.id, true, "Ok");
    const f = await admin.rnc.findUniqueOrThrow({ where: { id: r.id }, include: { historicoStatus: true } });
    assert.equal(f.status, "CANCELADO");
    assert.ok(f.historicoStatus.some((h) => (h.metadados as { evento?: string })?.evento === "CANCELAMENTO_APROVADO"));
  });

  console.log("Restrição / LGPD:");
  await caso("SSO com dados pessoais é restrita automaticamente", async () => {
    const r = await criarRnc(inspetor, {
      titulo: "Teste E2E — incidente SSO",
      descricao: "Corte na mão",
      tipo: "SSO",
      origem: "AUTO_IDENTIFICADA",
      gravidade: "MEDIA",
      obraId: obra,
      contemDadosPessoais: true,
      sensiveis: { nomeEnvolvido: "Fulano", relato: "..." },
    });
    assert.equal(r.restrita, true);
  });

  console.log("Concorrência da numeração:");
  await caso("10 criações paralelas sem duplicatas", async () => {
    const rs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        criarRnc(inspetor, {
          titulo: `Teste E2E — paralela ${i}`,
          descricao: "concorrência",
          tipo: "QUALIDADE",
          origem: "INSPECAO",
          gravidade: "BAIXA",
          obraId: obra,
        }),
      ),
    );
    const cods = rs.map((r) => r.codigo);
    assert.equal(new Set(cods).size, 10);
    const seqs = rs.map((r) => r.sequencia).sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i++) assert.equal(seqs[i], seqs[i - 1] + 1);
  });

  console.log("Concorrência de itens do plano (M1):");
  const novaRncEmExecucao = async (titulo: string) => {
    const r = await criarRnc(inspetor, { titulo, descricao: "m1", tipo: "QUALIDADE", origem: "INSPECAO", gravidade: "BAIXA", obraId: obra });
    await assumirAnalise(inspetor, r.id);
    await salvarCausaRaiz(inspetor, r.id, { metodo: "OUTRO", analise: { texto: "x" }, causaRaiz: "Causa" });
    await adicionarItensRnc(inspetor, r.id, [{ oQue: "Ação", quemId: inspetor.usuarioId, quando: prazo }]);
    await iniciarExecucao(inspetor, r.id);
    return r.id;
  };
  await caso("escrita em item incrementa rnc.versao; versão obsoleta gera conflito", async () => {
    const rid = await novaRncEmExecucao("Teste E2E — M1 versão");
    const antes = await rncDb(rid);
    await concluirItem(inspetor, antes.planoAcao!.itens[0].id, { dataConclusao: prazo, evidencia: "ok" });
    const depois = await rncDb(rid);
    assert.equal(depois.versao, antes.versao + 1);
    await assert.rejects(enviarParaVerificacao(inspetor, rid, antes.versao), /alterado por outra pessoa/);
    await enviarParaVerificacao(inspetor, rid, depois.versao);
  });
  await caso("adicionar item x enviar para verificação em paralelo: só um vence, sem item pendente em verificação", async () => {
    for (let n = 0; n < 3; n++) {
      const rid = await novaRncEmExecucao(`Teste E2E — M1 corrida ${n}`);
      const item = (await rncDb(rid)).planoAcao!.itens[0];
      await concluirItem(inspetor, item.id, { dataConclusao: prazo, evidencia: "ok" });
      const rs = await Promise.allSettled([
        adicionarItensRnc(inspetor, rid, [{ oQue: "Nova ação", quemId: inspetor.usuarioId, quando: prazo }]),
        enviarParaVerificacao(inspetor, rid),
      ]);
      assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1, JSON.stringify(rs.map((r) => r.status)));
      const f = await rncDb(rid);
      if (f.status === "EM_VERIFICACAO") assert.ok(f.planoAcao!.itens.every((i) => i.status === "CONCLUIDO" || i.status === "CANCELADO"));
    }
  });
  await caso("cancelar item em paralelo duas vezes: um vence, outro recebe conflito/erro de negócio", async () => {
    const rid = await novaRncEmExecucao("Teste E2E — M1 cancelar");
    const item = (await rncDb(rid)).planoAcao!.itens[0];
    const rs = await Promise.allSettled([cancelarItem(qualidade, item.id), cancelarItem(qualidade, item.id)]);
    assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
    const erro = rs.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.match(String(erro.reason?.message), /alterado por outra pessoa|já finalizado/);
  });

  console.log("Permissões de tratativa (B3):");
  let rncColab = "";
  await caso("responsável sem RNC_TRATAR não trata a RNC nem gerencia itens", async () => {
    const r = await criarRnc(inspetor, {
      titulo: "Teste E2E — responsável sem permissão",
      descricao: "b3",
      tipo: "QUALIDADE",
      origem: "INSPECAO",
      gravidade: "BAIXA",
      obraId: obra,
    });
    // B2 impede designar responsável sem RNC_TRATAR; simula dado legado (permissão removida depois).
    await admin.rnc.update({ where: { id: r.id }, data: { responsavelId: colaborador.usuarioId } });
    rncColab = r.id;
    await assert.rejects(assumirAnalise(colaborador, r.id), /permissão/);
    await admin.rnc.update({ where: { id: r.id }, data: { status: "EM_ANALISE" } }); // simula análise já iniciada
    await assert.rejects(
      salvarCausaRaiz(colaborador, r.id, { metodo: "OUTRO", analise: { texto: "x" }, causaRaiz: "Causa" }),
      /permissão/,
    );
    await assert.rejects(adicionarItensRnc(colaborador, r.id, [{ oQue: "x", quemId: colaborador.usuarioId, quando: prazo }]), /permissão/);
    await assert.rejects(iniciarExecucao(colaborador, r.id), /permissão/);
    // ...mas, como responsável, abre o detalhe (fora da sua obra).
    assert.ok(await colaborador.db.rnc.findFirst({ where: { AND: [{ id: r.id }, filtroAcessoRnc(colaborador)] } }));
  });
  await caso("análise de causa com estrutura inválida é rejeitada (B5)", async () => {
    await assert.rejects(
      salvarCausaRaiz(qualidade, rncColab, { metodo: "CINCO_PORQUES", analise: { porques: ["x".repeat(3000)] }, causaRaiz: "c" }),
      /excede/,
    );
  });

  console.log("Interações:");
  await caso("quem do item e responsável sem RNC_TRATAR conversam; mensagem criada, recebida e lida", async () => {
    const itemColab = (await rncDb(id)).planoAcao!.itens.find((i) => i.quemId === colaborador.usuarioId)!;
    const t = { tipo: "ITEM_ACAO" as const, entidadeId: itemColab.id };
    const antes = await contarNaoLidas(inspetor);
    const m = await criarInteracao(colaborador, t, "Concluí o treinamento, segue lista.");
    assert.equal(m.destinatarioId, inspetor.usuarioId); // padrão: responsável da RNC
    assert.equal(await contarNaoLidas(inspetor), antes + 1);
    assert.ok((await listarNaoLidas(inspetor)).some((x) => x.id === m.id));
    await criarInteracao(inspetor, t, "Obrigado!"); // responsável responde ao quem
    assert.ok((await listarInteracoes(colaborador, t)).length >= 2);
    assert.equal(await marcarLidas(inspetor, t), 1);
    assert.equal(await contarNaoLidas(inspetor), antes);
    assert.equal(await marcarLidas(colaborador, t), 1);
    // responsável sem RNC_TRATAR lê e responde a thread da RNC
    const tr = { tipo: "RNC" as const, entidadeId: rncColab };
    const r = await criarInteracao(colaborador, tr, "Preciso de apoio na análise.");
    assert.equal(r.destinatarioId, inspetor.usuarioId); // padrão: quem abriu
    await assert.rejects(criarInteracao(colaborador, tr, "   "), /Escreva/);
  });

  console.log("Notificações (gatilhos):");
  const notifs = (usuarioId: string, entidadeId: string, tipo?: string) =>
    admin.notificacao.findMany({ where: { usuarioId, entidadeId, ...(tipo ? { tipo: tipo as never } : {}) } });
  await caso("envio para verificação notifica quem tem RNC_VERIFICAR_EFICACIA (não o autor)", async () => {
    assert.ok((await notifs(qualidade.usuarioId, id, "RNC_EM_VERIFICACAO")).length >= 2); // 2 ciclos
    assert.equal((await notifs(inspetor.usuarioId, id, "RNC_EM_VERIFICACAO")).length, 0);
  });
  await caso("item atribuído notifica o 'quem' (não quem atribuiu a si mesmo)", async () => {
    const itens = (await rncDb(id)).planoAcao!.itens;
    const doColab = itens.find((i) => i.quemId === colaborador.usuarioId)!;
    const doInsp = itens.find((i) => i.quemId === inspetor.usuarioId)!;
    assert.equal((await notifs(colaborador.usuarioId, doColab.id, "ITEM_ATRIBUIDO")).length, 1);
    assert.equal((await notifs(inspetor.usuarioId, doInsp.id, "ITEM_ATRIBUIDO")).length, 0);
  });
  await caso("RNC atribuída na criação e na troca de responsável", async () => {
    const r = await criarRnc(qualidade, {
      titulo: "Teste E2E — atribuição",
      descricao: "Notificação de responsável",
      tipo: "QUALIDADE",
      origem: "INSPECAO",
      gravidade: "BAIXA",
      obraId: obra,
      responsavelId: inspetor.usuarioId,
    });
    const n = await notifs(inspetor.usuarioId, r.id, "RNC_ATRIBUIDA");
    assert.equal(n.length, 1);
    assert.equal(n[0].link, `/rncs/${r.id}`);
    assert.ok(n[0].emailEnviadoEm);
    await assert.rejects(alterarResponsavel(inspetor, r.id, qualidade.usuarioId), /permissão/);
    await alterarResponsavel(qualidade, r.id, adminMonto.usuarioId);
    assert.equal((await notifs(adminMonto.usuarioId, r.id, "RNC_ATRIBUIDA")).length, 1);
    assert.equal((await admin.rnc.findUniqueOrThrow({ where: { id: r.id } })).responsavelId, adminMonto.usuarioId);
  });
  await caso("cancelamento: solicitação -> aprovadores; decisão -> solicitante", async () => {
    const r = await criarRnc(inspetor, {
      titulo: "Teste E2E — notificação de cancelamento",
      descricao: "x",
      tipo: "QUALIDADE",
      origem: "INSPECAO",
      gravidade: "BAIXA",
      obraId: obra,
    });
    const s = await solicitarCancelamento(inspetor, r.id, "Duplicada");
    assert.equal((await notifs(qualidade.usuarioId, r.id, "CANCELAMENTO_SOLICITADO")).length, 1);
    assert.equal((await notifs(colaborador.usuarioId, r.id, "CANCELAMENTO_SOLICITADO")).length, 0);
    await decidirCancelamento(qualidade, s.id, false, "Não é duplicada");
    const d = await notifs(inspetor.usuarioId, r.id, "CANCELAMENTO_DECIDIDO");
    assert.equal(d.length, 1);
    assert.match(d[0].titulo, /rejeitado/);
  });
  await caso("cancelamento: solicitante não aprova o próprio pedido (pode rejeitar); outro aprovador aprova", async () => {
    const r = await criarRnc(qualidade, {
      titulo: "Teste E2E — autoaprovação de cancelamento",
      descricao: "x",
      tipo: "QUALIDADE",
      origem: "INSPECAO",
      gravidade: "BAIXA",
      obraId: obra,
    });
    const s = await solicitarCancelamento(qualidade, r.id, "Aberta por engano");
    await assert.rejects(decidirCancelamento(qualidade, s.id, true), /não pode aprová-lo/);
    assert.equal((await admin.solicitacaoCancelamento.findUniqueOrThrow({ where: { id: s.id } })).status, "PENDENTE");
    await decidirCancelamento(adminMonto, s.id, true);
    assert.equal((await rncDb(r.id)).status, "CANCELADO");
  });

  console.log("Novo responsável (B2):");
  await caso("exige RNC_TRATAR, acesso à obra e, se restrita, RNC_VER_RESTRITAS (troca e criação)", async () => {
    const inspSemObra = await ator(
      (await garantirUsuarioSemObra(admin, "insp-sem-obra.teste@monto.com.br", "inspetor@monto.com.br", "INSPETOR")).email,
    );
    const base = { descricao: "b2", tipo: "QUALIDADE" as const, origem: "INSPECAO" as const, gravidade: "BAIXA" as const, obraId: obra };
    const r = await criarRnc(qualidade, { ...base, titulo: "Teste E2E — B2 comum" });
    await assert.rejects(alterarResponsavel(qualidade, r.id, colaborador.usuarioId), /tratar/);
    await assert.rejects(alterarResponsavel(qualidade, r.id, inspSemObra.usuarioId), /obra/);
    await alterarResponsavel(qualidade, r.id, inspetor.usuarioId);
    const restrita = await criarRnc(qualidade, { ...base, titulo: "Teste E2E — B2 restrita", restrita: true });
    await assert.rejects(alterarResponsavel(qualidade, restrita.id, inspetor.usuarioId), /restrita/);
    await assert.rejects(criarRnc(qualidade, { ...base, titulo: "Teste E2E — B2 criação", restrita: true, responsavelId: inspetor.usuarioId }), /restrita/);
    await assert.rejects(criarRnc(qualidade, { ...base, titulo: "Teste E2E — B2 criação 2", responsavelId: colaborador.usuarioId }), /tratar/);
    await alterarResponsavel(qualidade, restrita.id, adminMonto.usuarioId);
  });

  await caso("interação gera notificação ao destinatário; abrir a thread marca como lida", async () => {
    const t = { tipo: "RNC" as const, entidadeId: id };
    const antes = await contarNotificacoesNaoLidas(qualidade);
    const m = await criarInteracao(inspetor, t, "Pode verificar?", qualidade.usuarioId);
    const n = await admin.notificacao.findFirstOrThrow({ where: { chaveIdempotencia: `interacao:${m.id}` } });
    assert.equal(n.usuarioId, qualidade.usuarioId);
    assert.ok(!n.corpo.includes("Pode verificar")); // conteúdo não vai para notificação/e-mail
    assert.equal(await contarNotificacoesNaoLidas(qualidade), antes + 1);
    await marcarLidas(qualidade, t);
    assert.equal(await contarNotificacoesNaoLidas(qualidade), antes);
  });

  console.log("Rate limit de login (M2):");
  await caso("5 falhas por e-mail bloqueiam (inclusive e-mail inexistente) e tentativas são registradas", async () => {
    const ip = `test-${Date.now()}`;
    // e-mail inexistente: mesma regra (sem enumeração)
    const email = `naoexiste-${Date.now()}@teste.local`;
    for (let i = 0; i < LIMITE_LOGIN.falhasPorEmail; i++) {
      assert.deepEqual(await autenticar(admin, email, "errada", `${ip}-${i}`), { ok: false, motivo: "credenciais" });
    }
    assert.deepEqual(await autenticar(admin, email, "errada", `${ip}-x`), { ok: false, motivo: "bloqueado" });
    const tentativas = await admin.tentativaLogin.count({ where: { email } });
    assert.equal(tentativas, LIMITE_LOGIN.falhasPorEmail + 1);
    await admin.tentativaLogin.deleteMany({ where: { email } });
  });
  await caso("falhas por IP bloqueiam outros e-mails do mesmo IP; login válido de outro IP segue ok", async () => {
    const ip = `ip-${Date.now()}`;
    for (let i = 0; i < LIMITE_LOGIN.falhasPorIp; i++) await autenticar(admin, `x${i}-${ip}@teste.local`, "errada", ip);
    assert.deepEqual(await autenticar(admin, "colaborador@monto.com.br", "vigen123", ip), { ok: false, motivo: "bloqueado" });
    const ok = await autenticar(admin, "colaborador@monto.com.br", "vigen123", `${ip}-outro`);
    assert.equal(ok.ok, true);
    await admin.tentativaLogin.deleteMany({ where: { ip: { startsWith: ip } } });
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
