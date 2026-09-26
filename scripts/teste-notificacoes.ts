/* Executar: npm run test:notificacoes (requer seed). Roda o cron diário 2x (sem duplicar), o
 * semanal 2x e confere isolamento entre empresas e o fuso de cada uma. Limpa o que criou. */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hojeNoFuso, paraDataDb, somarDias } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { definirDriverEmail } from "../src/lib/email";
import { executarCronDiario, executarCronSemanal } from "../src/lib/notificacoes/cron";
import { criarNotificacoes, MAX_TENTATIVAS_EMAIL, reenviarEmailsPendentes } from "../src/lib/notificacoes/servico";

const admin = new PrismaClient();
const dirEmails = mkdtempSync(path.join(tmpdir(), "vigen-emails-"));
process.env.EMAIL_DRIVER = "arquivo";
process.env.EMAIL_DIR = dirEmails;

let ok = 0;
async function caso(nome: string, fn: () => Promise<void>) {
  await fn();
  ok++;
  console.log("  OK", nome);
}
const emails = () => readdirSync(dirEmails).length;

async function main() {
  const monto = await admin.empresa.findUniqueOrThrow({ where: { cnpj: "00000000000100" } });
  const demo = await admin.empresa.findUniqueOrThrow({ where: { cnpj: "00000000000200" } });
  const qualidade = await admin.usuario.findUniqueOrThrow({ where: { email: "qualidade@monto.com.br" } });
  const adminMonto = await admin.usuario.findUniqueOrThrow({ where: { email: "admin@monto.com.br" } });
  const adminDemo = await admin.usuario.findUniqueOrThrow({ where: { email: "admin@demo.com.br" } });
  const empresaIds = [monto.id, demo.id];
  const fusoOriginalDemo = demo.fusoHorario;
  const agora = new Date();
  // Demo em outro fuso: "hoje" de cada empresa é calculado no fuso dela.
  const fusoDemo = "Asia/Tokyo";
  await admin.empresa.update({ where: { id: demo.id }, data: { fusoHorario: fusoDemo } });
  const hojeMonto = hojeNoFuso(monto.fusoHorario, agora);
  const hojeDemo = hojeNoFuso(fusoDemo, agora);

  const criarPlano = async (empresaId: string, criadoPorId: string, quemId: string, hoje: string, dias: number) => {
    const plano = await admin.planoAcao.create({
      data: { empresaId, origemTipo: "MANUAL", titulo: `Teste notificações ${Date.now()}`, criadoPorId },
    });
    const mk = (oQue: string, delta: number) =>
      admin.itemAcao.create({ data: { empresaId, planoAcaoId: plano.id, oQue, quemId, quando: paraDataDb(somarDias(hoje, delta)) } });
    const itens = {
      hoje: await mk("Vence hoje", 0),
      dentro: await mk("Vence dentro da janela", dias),
      fora: await mk("Vence fora da janela", dias + 5),
      atrasado: await mk("Atrasado", -2),
      concluido: await admin.itemAcao.create({
        data: { empresaId, planoAcaoId: plano.id, oQue: "Concluído", quemId, quando: paraDataDb(somarDias(hoje, -1)), status: "CONCLUIDO" },
      }),
    };
    return { plano, itens };
  };
  const pm = await criarPlano(monto.id, adminMonto.id, qualidade.id, hojeMonto, monto.diasAlertaPrazo);
  const pd = await criarPlano(demo.id, adminDemo.id, adminDemo.id, hojeDemo, demo.diasAlertaPrazo);
  const idsMonto = Object.values(pm.itens).map((i) => i.id);
  const idsDemo = Object.values(pd.itens).map((i) => i.id);
  const todosIds = [...idsMonto, ...idsDemo];

  const tentativaVelha = await admin.tentativaLogin.create({
    data: { email: "velha@teste.local", ip: "127.0.0.1", sucesso: false, criadoEm: new Date(agora.getTime() - 40 * 86_400_000) },
  });
  const tentativaNova = await admin.tentativaLogin.create({ data: { email: "nova@teste.local", ip: "127.0.0.1", sucesso: false } });

  const notifsDe = (ids: string[]) => admin.notificacao.findMany({ where: { entidadeId: { in: ids } } });

  try {
    console.log(`Cron diário (Monto hoje=${hojeMonto} ${monto.fusoHorario}; Demo hoje=${hojeDemo} ${fusoDemo}):`);
    const r1 = await executarCronDiario({ base: admin, agora, empresaIds });
    const n1 = await notifsDe(todosIds);
    const emails1 = emails();

    await caso("1ª execução alerta prazo (hoje/janela) e atraso; ignora fora da janela e concluído", async () => {
      assert.ok(r1.empresas.every((e) => !e.erro), JSON.stringify(r1.empresas));
      for (const [p, empresaId, gestorDiferente] of [[pm, monto.id, true], [pd, demo.id, false]] as const) {
        const de = (id: string) => n1.filter((n) => n.entidadeId === id);
        assert.deepEqual(de(p.itens.hoje.id).map((n) => n.tipo), ["ITEM_PRAZO_PROXIMO"]);
        assert.deepEqual(de(p.itens.dentro.id).map((n) => n.tipo), ["ITEM_PRAZO_PROXIMO"]);
        assert.equal(de(p.itens.fora.id).length, 0);
        assert.equal(de(p.itens.concluido.id).length, 0);
        // Atraso: executor + criador do plano (quando diferentes).
        assert.equal(de(p.itens.atrasado.id).filter((n) => n.tipo === "ITEM_ATRASADO").length, gestorDiferente ? 2 : 1);
        assert.ok(n1.filter((n) => n.empresaId === empresaId).length > 0);
      }
      const itens = await admin.itemAcao.findMany({ where: { id: { in: todosIds } } });
      const porId = new Map(itens.map((i) => [i.id, i]));
      assert.ok(porId.get(pm.itens.hoje.id)!.alertaEnviadoEm);
      assert.ok(porId.get(pm.itens.atrasado.id)!.atrasoNotificadoEm);
      assert.equal(porId.get(pm.itens.fora.id)!.alertaEnviadoEm, null);
    });

    await caso("e-mails gravados pelo driver arquivo e emailEnviadoEm preenchido", async () => {
      assert.ok(emails1 >= n1.length, `emails=${emails1} notifs=${n1.length}`);
      assert.ok(n1.every((n) => n.emailEnviadoEm));
      assert.ok(n1.every((n) => n.emailStatus === "ENVIADO" && n.emailTentativas === 1));
    });

    const r2 = await executarCronDiario({ base: admin, agora, empresaIds });
    await caso("2ª execução não duplica notificações nem e-mails", async () => {
      const n2 = await notifsDe(todosIds);
      assert.equal(n2.length, n1.length);
      for (const e of r2.empresas) {
        assert.equal(e.alertasPrazo, 0);
        assert.equal(e.avisosAtraso, 0);
        assert.equal(e.notificacoesCriadas, 0);
      }
      assert.equal(emails(), emails1);
    });

    await caso("isolamento: notificações de cada empresa só para usuários dela", async () => {
      const usuarios = await admin.usuario.findMany({ select: { id: true, empresaId: true } });
      const empresaDe = new Map(usuarios.map((u) => [u.id, u.empresaId]));
      for (const n of n1) {
        assert.equal(empresaDe.get(n.usuarioId), n.empresaId);
        assert.equal(n.empresaId, idsMonto.includes(n.entidadeId!) ? monto.id : demo.id);
      }
      // Rodar só a Demo não toca nos itens da Monto.
      await admin.itemAcao.updateMany({ where: { id: { in: idsMonto } }, data: { alertaEnviadoEm: null, atrasoNotificadoEm: null } });
      await executarCronDiario({ base: admin, agora, empresaIds: [demo.id] });
      const intactos = await admin.itemAcao.findMany({ where: { id: { in: idsMonto } } });
      assert.ok(intactos.every((i) => i.alertaEnviadoEm === null && i.atrasoNotificadoEm === null));
      // Reprocessar a Monto marca de novo, mas a chave de idempotência impede duplicar.
      await executarCronDiario({ base: admin, agora, empresaIds: [monto.id] });
      assert.equal((await notifsDe(todosIds)).length, n1.length);
    });

    await caso("prazo alterado reabre o alerta (nova chave)", async () => {
      await admin.itemAcao.update({
        where: { id: pm.itens.fora.id },
        data: { quando: paraDataDb(somarDias(hojeMonto, 1)), alertaEnviadoEm: null },
      });
      const r = await executarCronDiario({ base: admin, agora, empresaIds: [monto.id] });
      assert.ok(r.empresas[0].alertasPrazo >= 1);
      assert.equal((await notifsDe([pm.itens.fora.id])).length, 1);
    });

    await caso("limpeza de tentativa_login > 30 dias", async () => {
      assert.equal(await admin.tentativaLogin.count({ where: { id: tentativaVelha.id } }), 0);
      assert.equal(await admin.tentativaLogin.count({ where: { id: tentativaNova.id } }), 1);
    });

    console.log("Status de e-mail (M4):");
    const dbMonto = criarDbTenant(monto.id, admin);
    const chavesM4: string[] = [];
    const novaPendente = async (sufixo: string, criadoEm?: Date) => {
      const chave = `teste-m4:${Date.now()}:${sufixo}`;
      chavesM4.push(chave);
      return admin.notificacao.create({
        data: {
          empresaId: monto.id, usuarioId: qualidade.id, tipo: "RNC_ATRIBUIDA", titulo: "Teste M4", corpo: "x",
          chaveIdempotencia: chave, ...(criadoEm ? { criadoEm } : {}),
        },
      });
    };
    const estado = (id: string) => admin.notificacao.findUniqueOrThrow({ where: { id } });
    try {
      await caso("claim atômico: dois reenvios concorrentes enviam o e-mail uma única vez", async () => {
        let enviados = 0;
        definirDriverEmail({ nome: "contador", enviar: async () => { enviados++; await new Promise((r) => setTimeout(r, 50)); } });
        const n = await novaPendente("claim");
        const desde = new Date(Date.now() - 60_000);
        await Promise.all([reenviarEmailsPendentes(dbMonto, desde), reenviarEmailsPendentes(dbMonto, desde), reenviarEmailsPendentes(dbMonto, desde)]);
        assert.equal(enviados, 1);
        const e = await estado(n.id);
        assert.equal(e.emailStatus, "ENVIADO");
        assert.equal(e.emailTentativas, 1);
        assert.ok(e.emailEnviadoEm);
        await reenviarEmailsPendentes(dbMonto, desde);
        assert.equal(enviados, 1); // ENVIADO não volta à fila
      });

      await caso("falha vira FALHOU e é reenviada até o limite de tentativas", async () => {
        let chamadas = 0;
        definirDriverEmail({ nome: "falho", enviar: async () => { chamadas++; throw new Error("SMTP fora"); } });
        const n = await novaPendente("falha");
        const desde = new Date(Date.now() - 60_000);
        for (let i = 0; i < MAX_TENTATIVAS_EMAIL + 2; i++) await reenviarEmailsPendentes(dbMonto, desde);
        assert.equal(chamadas, MAX_TENTATIVAS_EMAIL);
        const e = await estado(n.id);
        assert.equal(e.emailStatus, "FALHOU");
        assert.equal(e.emailTentativas, MAX_TENTATIVAS_EMAIL);
      });

      await caso("e-mail desativado => IGNORADO (nunca reenviado); backlog antigo fora da janela não é reenviado", async () => {
        let enviados = 0;
        definirDriverEmail({ nome: "contador", enviar: async () => { enviados++; } });
        const configOriginal = monto.config ?? {};
        await admin.empresa.update({ where: { id: monto.id }, data: { config: { notificacoes: { email: false } } } });
        try {
          const chave = `teste-m4:${Date.now()}:ignorado`;
          chavesM4.push(chave);
          const [c] = await criarNotificacoes(dbMonto, monto.id, [
            { usuarioId: qualidade.id, tipo: "RNC_ATRIBUIDA", titulo: "Teste M4", corpo: "x", chave },
          ]);
          assert.equal((await estado(c.id)).emailStatus, "IGNORADO");
        } finally {
          await admin.empresa.update({ where: { id: monto.id }, data: { config: configOriginal as object } });
        }
        const velha = await novaPendente("velha", new Date(Date.now() - 5 * 86_400_000));
        await reenviarEmailsPendentes(dbMonto, new Date(Date.now() - 2 * 86_400_000));
        assert.equal(enviados, 0);
        assert.equal((await estado(velha.id)).emailStatus, "PENDENTE");
      });
    } finally {
      definirDriverEmail(null);
      await admin.notificacao.deleteMany({ where: { chaveIdempotencia: { in: chavesM4 } } });
    }

    console.log("Cron semanal:");
    // Resumos da semana que já existiam (ex.: execução manual anterior) não são apagados pelo teste.
    const resumosDaSemana = () =>
      admin.notificacao.findMany({ where: { tipo: "RESUMO_SEMANAL", empresaId: { in: empresaIds }, chaveIdempotencia: { startsWith: "resumo:" } } });
    const preExistentes = new Set((await resumosDaSemana()).map((r) => r.id));
    await caso("resumo semanal para gestores, idempotente e isolado", async () => {
      const s1 = await executarCronSemanal({ base: admin, agora, empresaIds });
      assert.ok(s1.empresas.every((e) => !e.erro), JSON.stringify(s1.empresas));
      const s2 = await executarCronSemanal({ base: admin, agora, empresaIds });
      assert.ok(s2.empresas.every((e) => e.notificacoesCriadas === 0));
      const resumos = await resumosDaSemana();
      const destinatarios = await admin.usuario.findMany({ where: { id: { in: resumos.map((r) => r.usuarioId) } } });
      assert.ok(destinatarios.some((u) => u.id === adminMonto.id));
      assert.ok(destinatarios.some((u) => u.id === adminDemo.id));
      for (const r of resumos) assert.equal(destinatarios.find((u) => u.id === r.usuarioId)!.empresaId, r.empresaId);
      assert.ok(resumos.every((r) => r.corpo.includes("RNCs abertas")));
      await admin.notificacao.deleteMany({ where: { id: { in: resumos.filter((r) => !preExistentes.has(r.id)).map((r) => r.id) } } });
    });

    await caso("resumo desativado nas preferências não é enviado", async () => {
      await admin.empresa.update({ where: { id: demo.id }, data: { config: { notificacoes: { resumoSemanal: false } } } });
      const s = await executarCronSemanal({ base: admin, agora, empresaIds: [demo.id] });
      assert.equal(s.empresas[0].pulada, "resumo semanal desativado");
    });
  } finally {
    await admin.notificacao.deleteMany({ where: { entidadeId: { in: todosIds } } });
    await admin.itemAcao.deleteMany({ where: { id: { in: todosIds } } });
    await admin.planoAcao.deleteMany({ where: { id: { in: [pm.plano.id, pd.plano.id] } } });
    await admin.tentativaLogin.deleteMany({ where: { id: { in: [tentativaVelha.id, tentativaNova.id] } } });
    await admin.empresa.update({ where: { id: demo.id }, data: { fusoHorario: fusoOriginalDemo, config: (demo.config ?? {}) as object } });
    rmSync(dirEmails, { recursive: true, force: true });
  }
  console.log(`\n${ok} casos OK.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
