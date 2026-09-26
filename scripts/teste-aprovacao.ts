/* Executar: npm run test:aprovacao (requer seed). Motor de aprovação multi-assinante + reavaliação no cron. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroConflito, ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import {
  cancelar,
  decidir,
  listarAguardandoMim,
  listarSolicitadasPorMim,
  obterFluxo,
  registrarHandlerAprovacao,
  solicitarAprovacao,
  type DadosSolicitacao,
} from "../src/lib/aprovacao";
import { executarCronDiario } from "../src/lib/notificacoes/cron";
import { registrarFonteReavaliacao, removerFonteReavaliacao } from "../src/lib/reavaliacao";
import { hojeNoFuso, somarDias } from "../src/lib/datas";

const admin = new PrismaClient();
process.env.EMAIL_DRIVER = "arquivo";
process.env.EMAIL_DIR = path.join(tmpdir(), "vigen-emails-teste-aprovacao");
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
  return {
    db: criarDbTenant(u.empresaId, admin),
    empresaId: u.empresaId,
    usuarioId: u.id,
    permissoes,
    obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId),
  };
}

const erroNegocio = (re: RegExp) => (e: unknown) => e instanceof ErroNegocio && re.test(e.message);

// Handler TESTE: aplica marcando o resumo (efeito observável e transacional). payload.falhar → erro.
registrarHandlerAprovacao("TESTE", {
  async aoAprovar(tx, fluxo) {
    if ((fluxo.payload as { falhar?: boolean }).falhar) throw new ErroNegocio("falha simulada no handler");
    await tx.fluxoAprovacao.updateMany({ where: { id: fluxo.id }, data: { resumo: `${fluxo.resumo} [aplicado]` } });
  },
  async aoRejeitar(tx, fluxo) {
    await tx.fluxoAprovacao.updateMany({ where: { id: fluxo.id }, data: { resumo: `${fluxo.resumo} [rejeitado]` } });
  },
});

async function main() {
  const qualidade = await ator("qualidade@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const adminMonto = await ator("admin@monto.com.br");
  const colab = await ator("colaborador@monto.com.br");
  const adminDemo = await ator("admin@demo.com.br");
  const pedido = (aprovadorIds: string[], modo: "SEQUENCIAL" | "PARALELO", extra: Partial<DadosSolicitacao> = {}): DadosSolicitacao => ({
    entidadeTipo: "TESTE",
    entidadeId: randomUUID(),
    tipoAlteracao: "ALTERACAO",
    modo,
    aprovadorIds,
    payload: { campo: "valor" },
    resumo: `Teste aprovação ${Date.now()}`,
    ...extra,
  });
  const fluxo = (id: string) => admin.fluxoAprovacao.findUniqueOrThrow({ where: { id }, include: { etapas: { orderBy: { ordem: "asc" } } } });
  const notifs = (usuarioId: string, entidadeId: string, tipo: "APROVACAO_PENDENTE" | "APROVACAO_DECIDIDA") =>
    admin.notificacao.count({ where: { usuarioId, entidadeId, tipo } });

  console.log("Motor de aprovação:");

  await caso("sequencial: um por vez, notifica o da vez, callback aplicado ao final", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId, adminMonto.usuarioId], "SEQUENCIAL"));
    let f = await fluxo(id);
    assert.deepEqual(f.etapas.map((e) => e.status), ["PENDENTE", "AGUARDANDO"]);
    assert.equal(await notifs(inspetor.usuarioId, id, "APROVACAO_PENDENTE"), 1);
    assert.equal(await notifs(adminMonto.usuarioId, id, "APROVACAO_PENDENTE"), 0);
    assert.ok((await listarAguardandoMim(inspetor)).some((x) => x.id === id));
    assert.ok(!(await listarAguardandoMim(adminMonto)).some((x) => x.id === id));
    await assert.rejects(decidir(adminMonto, id, { decisao: "APROVAR" }), erroNegocio(/pendente de decisão sua/));
    assert.equal((await decidir(inspetor, id, { decisao: "APROVAR", comentario: "ok" })).status, "PENDENTE");
    f = await fluxo(id);
    assert.deepEqual(f.etapas.map((e) => e.status), ["APROVADA", "PENDENTE"]);
    assert.equal(f.etapas[0].comentario, "ok");
    assert.equal(await notifs(adminMonto.usuarioId, id, "APROVACAO_PENDENTE"), 1);
    assert.equal(await notifs(qualidade.usuarioId, id, "APROVACAO_DECIDIDA"), 0);
    assert.equal((await decidir(adminMonto, id, { decisao: "APROVAR" })).status, "APROVADO");
    f = await fluxo(id);
    assert.equal(f.status, "APROVADO");
    assert.ok(f.concluidoEm);
    assert.ok(f.resumo.endsWith("[aplicado]"), "handler aoAprovar aplicado");
    assert.equal(await notifs(qualidade.usuarioId, id, "APROVACAO_DECIDIDA"), 1);
    const det = await obterFluxo(qualidade, id);
    assert.deepEqual(det!.historico.map((h) => h.acao), ["SOLICITADO", "APROVADO", "APROVADO", "CONCLUIDO"]);
    assert.ok((await listarSolicitadasPorMim(qualidade, { status: ["APROVADO"] })).some((x) => x.id === id));
  });

  await caso("paralelo: todos notificados, qualquer ordem, conclui na última", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId, adminMonto.usuarioId], "PARALELO"));
    assert.deepEqual((await fluxo(id)).etapas.map((e) => e.status), ["PENDENTE", "PENDENTE"]);
    assert.equal(await notifs(inspetor.usuarioId, id, "APROVACAO_PENDENTE"), 1);
    assert.equal(await notifs(adminMonto.usuarioId, id, "APROVACAO_PENDENTE"), 1);
    assert.equal((await decidir(adminMonto, id, { decisao: "APROVAR" })).status, "PENDENTE");
    assert.equal((await decidir(inspetor, id, { decisao: "APROVAR" })).status, "APROVADO");
    assert.ok((await fluxo(id)).resumo.endsWith("[aplicado]"));
  });

  await caso("rejeição: comentário obrigatório, demais IGNORADA, callback de rejeição, solicitante notificado", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId, adminMonto.usuarioId], "SEQUENCIAL"));
    await assert.rejects(decidir(inspetor, id, { decisao: "REJEITAR", comentario: " " }), erroNegocio(/motivo/));
    assert.equal((await decidir(inspetor, id, { decisao: "REJEITAR", comentario: "Faltou evidência" })).status, "REJEITADO");
    const f = await fluxo(id);
    assert.deepEqual(f.etapas.map((e) => e.status), ["REJEITADA", "IGNORADA"]);
    assert.ok(f.resumo.endsWith("[rejeitado]"));
    assert.equal(await notifs(qualidade.usuarioId, id, "APROVACAO_DECIDIDA"), 1);
    await assert.rejects(decidir(adminMonto, id, { decisao: "APROVAR" }), erroNegocio(/encerrado/));
  });

  await caso("autoaprovação, repetidos, lista vazia e aprovador de outra empresa proibidos", async () => {
    await assert.rejects(solicitarAprovacao(qualidade, pedido([qualidade.usuarioId], "PARALELO")), erroNegocio(/solicitante/));
    await assert.rejects(solicitarAprovacao(qualidade, pedido([inspetor.usuarioId, inspetor.usuarioId], "PARALELO")), erroNegocio(/repetido/));
    await assert.rejects(solicitarAprovacao(qualidade, pedido([], "PARALELO")), erroNegocio(/ao menos um/));
    await assert.rejects(solicitarAprovacao(qualidade, pedido([adminDemo.usuarioId], "PARALELO")), erroNegocio(/inativo/));
  });

  await caso("aprovador inativo recusado", async () => {
    await admin.usuario.update({ where: { id: colab.usuarioId }, data: { ativo: false } });
    try {
      await assert.rejects(solicitarAprovacao(qualidade, pedido([colab.usuarioId], "PARALELO")), erroNegocio(/inativo/));
    } finally {
      await admin.usuario.update({ where: { id: colab.usuarioId }, data: { ativo: true } });
    }
  });

  await caso("cancelamento: só o solicitante e só PENDENTE", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId, adminMonto.usuarioId], "SEQUENCIAL"));
    await assert.rejects(cancelar(inspetor, id), erroNegocio(/não encontrado/));
    await cancelar(qualidade, id, "Desisti");
    const f = await fluxo(id);
    assert.equal(f.status, "CANCELADO");
    assert.deepEqual(f.etapas.map((e) => e.status), ["IGNORADA", "IGNORADA"]);
    await assert.rejects(cancelar(qualidade, id), erroNegocio(/pendentes/));
    await assert.rejects(decidir(inspetor, id, { decisao: "APROVAR" }), erroNegocio(/encerrado/));
  });

  await caso("falha no callback desfaz a aprovação final", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId], "PARALELO", { payload: { falhar: true } }));
    await assert.rejects(decidir(inspetor, id, { decisao: "APROVAR" }), erroNegocio(/falha simulada/));
    const f = await fluxo(id);
    assert.equal(f.status, "PENDENTE");
    assert.equal(f.etapas[0].status, "PENDENTE");
    assert.equal(await admin.historicoAprovacao.count({ where: { fluxoId: id } }), 1);
    await cancelar(qualidade, id);
  });

  await caso("duplo fluxo pendente na mesma entidade bloqueado (e liberado após encerrar)", async () => {
    const p = pedido([inspetor.usuarioId], "PARALELO");
    const { id } = await solicitarAprovacao(qualidade, p);
    await assert.rejects(solicitarAprovacao(adminMonto, { ...p, aprovadorIds: [inspetor.usuarioId] }), erroNegocio(/Já existe/));
    await cancelar(qualidade, id);
    const outro = await solicitarAprovacao(adminMonto, { ...p, aprovadorIds: [inspetor.usuarioId] });
    await cancelar(adminMonto, outro.id);
  });

  await caso("duas decisões simultâneas na mesma etapa: só uma vence", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId, adminMonto.usuarioId], "SEQUENCIAL"));
    const rs = await Promise.allSettled([
      decidir(inspetor, id, { decisao: "APROVAR" }),
      decidir(inspetor, id, { decisao: "REJEITAR", comentario: "não" }),
      decidir(inspetor, id, { decisao: "APROVAR" }),
    ]);
    const vencedores = rs.filter((r) => r.status === "fulfilled");
    assert.equal(vencedores.length, 1, JSON.stringify(rs.map((r) => r.status)));
    for (const r of rs) if (r.status === "rejected") assert.ok(r.reason instanceof ErroNegocio, String(r.reason));
    assert.equal(await admin.historicoAprovacao.count({ where: { fluxoId: id, acao: { in: ["APROVADO", "REJEITADO"] } } }), 1);
    const f = await fluxo(id);
    if (f.status === "PENDENTE") await cancelar(qualidade, id);
  });

  await caso("versão desatualizada → conflito", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId, adminMonto.usuarioId], "PARALELO"));
    await decidir(inspetor, id, { decisao: "APROVAR", versao: 0 });
    await assert.rejects(decidir(adminMonto, id, { decisao: "APROVAR", versao: 0 }), (e) => e instanceof ErroConflito);
    await cancelar(qualidade, id, null, 1);
  });

  await caso("visibilidade e isolamento entre empresas", async () => {
    const { id } = await solicitarAprovacao(qualidade, pedido([inspetor.usuarioId], "PARALELO"));
    assert.ok(await obterFluxo(inspetor, id));
    assert.equal(await obterFluxo(colab, id), null, "terceiro sem handler.podeVer não vê");
    assert.equal(await obterFluxo(adminDemo, id), null);
    assert.ok(!(await listarSolicitadasPorMim(adminDemo)).some((x) => x.id === id));
    await assert.rejects(decidir(adminDemo, id, { decisao: "APROVAR" }), erroNegocio(/não encontrado/));
    await assert.rejects(cancelar(adminDemo, id), erroNegocio(/não encontrado/));
    assert.equal(await adminDemo.db.fluxoAprovacao.count({ where: { id } }), 0);
    await cancelar(qualidade, id);
  });

  await caso("histórico imutável (trigger bloqueia UPDATE/DELETE)", async () => {
    const h = await admin.historicoAprovacao.findFirstOrThrow({ where: { empresaId: qualidade.empresaId } });
    await assert.rejects(admin.historicoAprovacao.update({ where: { id: h.id }, data: { comentario: "x" } }), /imutável/);
    await assert.rejects(admin.historicoAprovacao.delete({ where: { id: h.id } }), /imutável/);
  });

  console.log("Reavaliação no cron diário:");
  await caso("fonte registrada gera REAVALIACAO_PROXIMA idempotente, só para módulo ativo", async () => {
    const empresa = await admin.empresa.findUniqueOrThrow({ where: { id: qualidade.empresaId } });
    const hoje = hojeNoFuso(empresa.fusoHorario);
    const entidadeId = randomUUID();
    const chamadas: string[] = [];
    registrarFonteReavaliacao(
      {
        modulo: "HIRA",
        async listarVencendo(_db, e, h, dias) {
          chamadas.push(e.id);
          assert.equal(h, hoje);
          return [{ entidadeId, modo: "ITEM", dataReavaliacao: somarDias(h, Math.min(dias, 5)), titulo: "Perigo teste", link: "/hira", usuarioIds: [inspetor.usuarioId] }];
        },
      },
      "teste-aprovacao",
    );
    try {
      const ids = [qualidade.empresaId, adminDemo.empresaId];
      await executarCronDiario({ base: admin, empresaIds: ids });
      await executarCronDiario({ base: admin, empresaIds: ids });
      const n = await admin.notificacao.count({ where: { usuarioId: inspetor.usuarioId, tipo: "REAVALIACAO_PROXIMA", chaveIdempotencia: { contains: entidadeId } } });
      assert.equal(n, 1);
      const demoTemHira = (await admin.empresa.findUniqueOrThrow({ where: { id: adminDemo.empresaId } })).modulosAtivos.includes("HIRA");
      assert.equal(chamadas.includes(adminDemo.empresaId), demoTemHira);
      assert.ok(chamadas.includes(qualidade.empresaId));
    } finally {
      removerFonteReavaliacao("teste-aprovacao");
    }
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
