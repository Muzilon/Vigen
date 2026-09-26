/* Executar: npm run test:plano-manual (requer seed). Planos de ação avulsos (origem MANUAL). */
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { hojeNoFuso, somarDias } from "../src/lib/datas";
import { criarDbTenant } from "../src/lib/db-tenant";
import { ErroConflito, ErroNegocio } from "../src/lib/erros";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { podeEnviarAnexo } from "../src/lib/anexos/servico";
import { criarInteracao } from "../src/lib/interacoes/servico";
import {
  adicionarItensPlanoManual,
  cancelarItem,
  concluirItem,
  criarPlanoManual,
  editarItem,
  editarPlanoManual,
  marcarEmAndamento,
  obterPlanoManual,
  type DadosItem,
} from "../src/lib/plano-acao/servico";
import { filtroAcessoItem } from "../src/lib/rnc/servico";
import { garantirUsuarioSemObra } from "./util-teste";

const admin = new PrismaClient();
process.env.EMAIL_DRIVER = "arquivo";
process.env.EMAIL_DIR = path.join(tmpdir(), "vigen-emails-teste-plano-manual");
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

async function main() {
  const qualidade = await ator("qualidade@monto.com.br"); // PLANO_GERENCIAR, todas as obras
  const inspetor = await ator("inspetor@monto.com.br"); // sem PLANO_GERENCIAR, Obra Alfa
  const semObra = await ator((await garantirUsuarioSemObra(admin, "colab-sem-obra.teste@monto.com.br")).email);
  const inativoU = await garantirUsuarioSemObra(admin, "inativo-plano.teste@monto.com.br");
  await admin.usuario.update({ where: { id: inativoU.id }, data: { ativo: false } });
  const adminDemo = await ator("admin@demo.com.br");
  const alfa = inspetor.obrasPermitidas![0];
  const beta = (await admin.obraUnidade.findFirstOrThrow({ where: { empresaId: qualidade.empresaId, id: { not: alfa } } })).id;
  // Gestor sintético: PLANO_GERENCIAR mas só com acesso à Obra Beta.
  const gestorBeta: Ator = { ...semObra, permissoes: ["PLANO_GERENCIAR"], obrasPermitidas: [beta] };
  const hoje = hojeNoFuso("America/Sao_Paulo");
  const item = (quemId: string, oQue = "Ação de teste", quando = somarDias(hoje, 10)): DadosItem => ({ oQue, quemId, quando, porQue: "Melhoria" });

  console.log("Planos de ação avulsos (MANUAL):");
  let planoId = "";
  let itemInspetor = "";
  let itemQualidade = "";
  await caso("criar plano (título, objetivo, obra, 2 itens) — origem MANUAL, sem origemId, status PENDENTE", async () => {
    const r = await criarPlanoManual(qualidade, {
      titulo: `Plano avulso teste ${Date.now()}`,
      descricao: "Reduzir retrabalho na concretagem",
      obraId: alfa,
      itens: [item(inspetor.usuarioId, "Treinar equipe"), item(qualidade.usuarioId, "Revisar procedimento")],
    });
    planoId = r.id;
    const p = await admin.planoAcao.findUniqueOrThrow({ where: { id: planoId }, include: { itens: { orderBy: { ordem: "asc" } } } });
    assert.equal(p.origemTipo, "MANUAL");
    assert.equal(p.origemId, null);
    assert.equal(p.obraId, alfa);
    assert.equal(p.descricao, "Reduzir retrabalho na concretagem");
    assert.deepEqual(p.itens.map((i) => i.ordem), [1, 2]);
    itemInspetor = p.itens[0].id;
    itemQualidade = p.itens[1].id;
    const v = await obterPlanoManual(qualidade, planoId);
    assert.equal(v?.statusGeral, "PENDENTE");
    assert.equal(v?.podeGerenciar, true);
    assert.equal(v?.itens.length, 2);
  });

  await caso("notificação ITEM_ATRIBUIDO ao quem com link para a página do plano (não ao próprio criador)", async () => {
    const n = await admin.notificacao.findFirstOrThrow({ where: { tipo: "ITEM_ATRIBUIDO", entidadeId: itemInspetor } });
    assert.equal(n.usuarioId, inspetor.usuarioId);
    assert.equal(n.link, `/plano-acao/planos/${planoId}`);
    assert.match(n.corpo, /Treinar equipe \(Plano: /);
    assert.equal(await admin.notificacao.count({ where: { tipo: "ITEM_ATRIBUIDO", entidadeId: itemQualidade } }), 0);
  });

  await caso("sem PLANO_GERENCIAR não cria plano", async () => {
    await assert.rejects(criarPlanoManual(inspetor, { titulo: "Não pode", itens: [item(inspetor.usuarioId)] }), erroNegocio(/permissão/));
  });

  await caso("validações: ao menos 1 item, título mínimo", async () => {
    await assert.rejects(criarPlanoManual(qualidade, { titulo: "Sem itens", itens: [] }), erroNegocio(/ao menos um item/));
    await assert.rejects(criarPlanoManual(qualidade, { titulo: "ab", itens: [item(qualidade.usuarioId)] }), erroNegocio(/título/));
  });

  await caso("quem: só usuário ativo e, com obra, só quem acessa a obra", async () => {
    await assert.rejects(
      criarPlanoManual(qualidade, { titulo: "Quem sem obra", obraId: alfa, itens: [item(semObra.usuarioId)] }),
      erroNegocio(/acesso à obra/),
    );
    await assert.rejects(criarPlanoManual(qualidade, { titulo: "Quem inativo", itens: [item(inativoU.id)] }), erroNegocio(/inválido/));
    await assert.rejects(adicionarItensPlanoManual(qualidade, planoId, [item(semObra.usuarioId)]), erroNegocio(/acesso à obra/));
    await assert.rejects(editarItem(qualidade, itemInspetor, item(semObra.usuarioId, "Treinar equipe")), erroNegocio(/acesso à obra/));
    // Sem obra no plano: qualquer usuário ativo da empresa serve.
    const r = await criarPlanoManual(qualidade, { titulo: `Plano sem obra ${Date.now()}`, itens: [item(semObra.usuarioId)] });
    assert.ok(r.id);
  });

  await caso("o quem vê o plano só com os próprios itens e não gerencia", async () => {
    const v = await obterPlanoManual(inspetor, planoId);
    assert.ok(v);
    assert.equal(v.podeGerenciar, false);
    assert.deepEqual(v.itens.map((i) => i.id), [itemInspetor]);
    await assert.rejects(editarItem(inspetor, itemInspetor, item(inspetor.usuarioId, "Mudado")), erroNegocio(/permissão/));
    await assert.rejects(cancelarItem(inspetor, itemInspetor), erroNegocio(/permissão/));
    await assert.rejects(adicionarItensPlanoManual(inspetor, planoId, [item(inspetor.usuarioId)]), erroNegocio(/não encontrado/));
    await assert.rejects(editarPlanoManual(inspetor, planoId, { titulo: "Hack" }), erroNegocio(/não encontrado/));
  });

  await caso("só o quem executa o próprio item (iniciar/concluir); status geral acompanha", async () => {
    await assert.rejects(marcarEmAndamento(qualidade, itemInspetor), erroNegocio(/Somente o responsável/));
    await marcarEmAndamento(inspetor, itemInspetor);
    assert.equal((await obterPlanoManual(qualidade, planoId))?.statusGeral, "EM_ANDAMENTO");
    await concluirItem(inspetor, itemInspetor, { dataConclusao: hoje, evidencia: "Lista de presença" });
    await assert.rejects(concluirItem(inspetor, itemQualidade, { dataConclusao: hoje, evidencia: "x" }), erroNegocio(/não encontrado|Somente/));
    await concluirItem(qualidade, itemQualidade, { dataConclusao: hoje, evidencia: "Procedimento rev. 2" });
    assert.equal((await obterPlanoManual(qualidade, planoId))?.statusGeral, "CONCLUIDO");
  });

  await caso("gestor adiciona, edita (troca de quem notifica) e cancela itens; versão do plano sobe", async () => {
    const antes = (await admin.planoAcao.findUniqueOrThrow({ where: { id: planoId } })).versao;
    const { itemIds } = await adicionarItensPlanoManual(qualidade, planoId, [item(qualidade.usuarioId, "Auditar", somarDias(hoje, -1))]);
    assert.equal((await obterPlanoManual(qualidade, planoId))?.statusGeral, "ATRASADO");
    await editarItem(qualidade, itemIds[0], item(inspetor.usuarioId, "Auditar"));
    const n = await admin.notificacao.findFirstOrThrow({ where: { tipo: "ITEM_ATRIBUIDO", entidadeId: itemIds[0] } });
    assert.equal(n.usuarioId, inspetor.usuarioId);
    assert.equal(n.link, `/plano-acao/planos/${planoId}`);
    await cancelarItem(qualidade, itemIds[0]);
    assert.equal((await obterPlanoManual(qualidade, planoId))?.statusGeral, "CONCLUIDO");
    const depois = (await admin.planoAcao.findUniqueOrThrow({ where: { id: planoId } })).versao;
    assert.equal(depois, antes + 3);
  });

  await caso("editar título/objetivo; versão desatualizada gera conflito", async () => {
    const p = await admin.planoAcao.findUniqueOrThrow({ where: { id: planoId } });
    await editarPlanoManual(qualidade, planoId, { titulo: `${p.titulo} (rev)`, descricao: "Objetivo revisado" }, p.versao);
    await assert.rejects(editarPlanoManual(qualidade, planoId, { titulo: "Outro" }, p.versao), (e) => e instanceof ErroConflito);
    const d = await admin.planoAcao.findUniqueOrThrow({ where: { id: planoId } });
    assert.equal(d.descricao, "Objetivo revisado");
    assert.equal(d.versao, p.versao + 1);
  });

  await caso("concorrência: adições simultâneas não duplicam a ordem (trava pela versão do plano)", async () => {
    const rs = await Promise.allSettled(
      [1, 2, 3].map((n) => adicionarItensPlanoManual(qualidade, planoId, [item(qualidade.usuarioId, `Paralelo ${n}`)])),
    );
    assert.ok(rs.some((r) => r.status === "fulfilled"));
    for (const r of rs) if (r.status === "rejected") assert.ok(r.reason instanceof ErroConflito, String(r.reason));
    const ordens = (await admin.itemAcao.findMany({ where: { planoAcaoId: planoId }, select: { ordem: true } })).map((i) => i.ordem);
    assert.equal(new Set(ordens).size, ordens.length);
  });

  await caso("PLANO_GERENCIAR sem acesso à obra do plano não vê nem gerencia", async () => {
    assert.equal(await obterPlanoManual(gestorBeta, planoId), null);
    assert.equal(await gestorBeta.db.itemAcao.count({ where: { AND: [{ id: itemInspetor }, filtroAcessoItem(gestorBeta)] } }), 0);
    await assert.rejects(cancelarItem(gestorBeta, itemQualidade), erroNegocio(/não encontrado/));
    await assert.rejects(criarPlanoManual(gestorBeta, { titulo: "Obra alheia", obraId: alfa, itens: [item(qualidade.usuarioId)] }), erroNegocio(/Obra/));
  });

  await caso("anexos e interações de item de plano manual", async () => {
    const [novo] = (await adicionarItensPlanoManual(qualidade, planoId, [item(inspetor.usuarioId, "Com evidência")])).itemIds;
    assert.equal(await podeEnviarAnexo(inspetor, { tipo: "ITEM_ACAO", entidadeId: novo }), true);
    assert.equal(await podeEnviarAnexo(gestorBeta, { tipo: "ITEM_ACAO", entidadeId: novo }), false);
    assert.equal(await podeEnviarAnexo(qualidade, { tipo: "PLANO_ACAO", entidadeId: planoId }), true);
    assert.equal(await podeEnviarAnexo(gestorBeta, { tipo: "PLANO_ACAO", entidadeId: planoId }), false);
    // O quem fala, por padrão, com quem criou o plano.
    const m = await criarInteracao(inspetor, { tipo: "ITEM_ACAO", entidadeId: novo }, "Iniciado?");
    const n = await admin.notificacao.findFirstOrThrow({ where: { chaveIdempotencia: `interacao:${m.id}` } });
    assert.equal(n.usuarioId, qualidade.usuarioId);
  });

  await caso("isolamento entre empresas: Demo não vê, não altera e não usa dados da Monto", async () => {
    assert.equal(await obterPlanoManual(adminDemo, planoId), null);
    assert.equal(await adminDemo.db.planoAcao.count({ where: { id: planoId } }), 0);
    await assert.rejects(editarItem(adminDemo, itemInspetor, item(adminDemo.usuarioId)), erroNegocio(/não encontrado/));
    await assert.rejects(editarPlanoManual(adminDemo, planoId, { titulo: "Invasão" }), erroNegocio(/não encontrado/));
    await assert.rejects(adicionarItensPlanoManual(adminDemo, planoId, [item(adminDemo.usuarioId)]), erroNegocio(/não encontrado/));
    // Quem ou obra de outra empresa são rejeitados.
    await assert.rejects(criarPlanoManual(adminDemo, { titulo: "Quem alheio", itens: [item(inspetor.usuarioId)] }), erroNegocio(/inválido/));
    await assert.rejects(
      criarPlanoManual(adminDemo, { titulo: "Obra alheia", obraId: alfa, itens: [item(adminDemo.usuarioId)] }),
      erroNegocio(/Obra/),
    );
    const t = (await admin.planoAcao.findUniqueOrThrow({ where: { id: planoId } })).titulo;
    assert.ok(!t.includes("Invasão"));
  });

  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
