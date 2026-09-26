/* Executar: npm run test:fluxo-rnc (requer seed). Cria dados reais (histórico é append-only). */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { hojeNoFuso } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { adicionarItensRnc, concluirItem, marcarEmAndamento } from "../src/lib/plano-acao/servico";
import {
  assumirAnalise,
  criarRnc,
  decidirCancelamento,
  enviarParaVerificacao,
  iniciarExecucao,
  salvarCausaRaiz,
  solicitarCancelamento,
  verificarEficacia,
} from "../src/lib/rnc/servico";

const admin = new PrismaClient();
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
  const colaborador = await ator("colaborador@monto.com.br");
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
    await marcarEmAndamento(colaborador, doColab.id); // colaborador enxerga por ser 'quem'
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

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
