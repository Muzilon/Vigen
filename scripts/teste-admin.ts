/* Executar: npm run test:admin (requer seed). Administração: usuários, perfis, obras e setores. Limpa o que criou. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  atualizarPerfil,
  atualizarUsuario,
  criarPerfil,
  criarUsuario,
  definirUsuarioAtivo,
  excluirPerfil,
  redefinirSenha,
  salvarObra,
  salvarSetor,
} from "../src/lib/admin/servico";
import type { Ator } from "../src/lib/ator";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { sessaoValida } from "../src/lib/usuario-sessao";

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
  return {
    db: criarDbTenant(u.empresaId, admin),
    empresaId: u.empresaId,
    usuarioId: u.id,
    permissoes,
    obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId),
  };
}

const sufixo = Date.now();
const emailNovo = `admin-teste-${sufixo}@monto.com.br`;
const versao = async (id: string) => (await admin.usuario.findUniqueOrThrow({ where: { id } })).tokenVersao;

async function main() {
  const adm = await ator("admin@monto.com.br");
  const inspetor = await ator("inspetor@monto.com.br");
  const obras = await admin.obraUnidade.findMany({ where: { empresaId: adm.empresaId }, orderBy: { nome: "asc" } });
  const criados = { usuarios: [] as string[], perfis: [] as string[], obras: [] as string[], setores: [] as string[] };

  try {
    console.log("Administração:");
    await caso("somente ADMIN_CONFIG administra", async () => {
      await assert.rejects(criarUsuario(inspetor, {}), /Sem permissão/);
      await assert.rejects(salvarSetor(inspetor, null, { nome: "X" }), /Sem permissão/);
    });

    let novoId = "";
    await caso("cria usuário (zod) com escopo SELECIONADAS e obras; e-mail único global", async () => {
      await assert.rejects(criarUsuario(adm, { nome: "A", email: "x", papel: "COLABORADOR", escopoObras: "TODAS", senha: "1" }), /nome|E-mail|senha/i);
      const u = await criarUsuario(adm, {
        nome: "Usuário de Teste", email: emailNovo.toUpperCase(), papel: "COLABORADOR", escopoObras: "SELECIONADAS",
        obraIds: [obras[0].id], senha: "senhaforte1",
      });
      novoId = u.id;
      criados.usuarios.push(u.id);
      const db = await admin.usuario.findUniqueOrThrow({ where: { id: u.id }, include: { acessosObra: true } });
      assert.equal(db.email, emailNovo); // normalizado
      assert.deepEqual(db.acessosObra.map((x) => x.obraId), [obras[0].id]);
      // e-mail já usado em OUTRA empresa também é rejeitado (único global)
      await assert.rejects(
        criarUsuario(adm, { nome: "Dup", email: "admin@demo.com.br", papel: "COLABORADOR", escopoObras: "TODAS", senha: "senhaforte1" }),
        /Já existe um usuário com este e-mail/,
      );
    });

    await caso("mudança de acesso incrementa tokenVersao (sessão cai); só nome não", async () => {
      const base = { nome: "Usuário de Teste", email: emailNovo, papel: "COLABORADOR", escopoObras: "SELECIONADAS", obraIds: [obras[0].id] };
      const v0 = await versao(novoId);
      assert.equal(await sessaoValida(novoId, v0), true);
      assert.equal((await atualizarUsuario(adm, novoId, { ...base, nome: "Usuário Renomeado" })).mudouAcesso, false);
      assert.equal(await versao(novoId), v0);
      await atualizarUsuario(adm, novoId, { ...base, papel: "INSPETOR" });
      const v1 = await versao(novoId);
      assert.equal(v1, v0 + 1);
      assert.equal(await sessaoValida(novoId, v0), false);
      await atualizarUsuario(adm, novoId, { ...base, papel: "INSPETOR", obraIds: obras.map((o) => o.id) });
      assert.equal(await versao(novoId), v1 + 1);
      await redefinirSenha(adm, novoId, "outrasenha1");
      assert.equal(await versao(novoId), v1 + 2);
      await definirUsuarioAtivo(adm, novoId, false);
      assert.equal(await versao(novoId), v1 + 3);
      assert.equal((await admin.usuario.findUniqueOrThrow({ where: { id: novoId } })).ativo, false);
      await definirUsuarioAtivo(adm, novoId, true);
    });

    await caso("admin não remove o próprio ADMIN nem desativa a si mesmo", async () => {
      const eu = await admin.usuario.findUniqueOrThrow({ where: { id: adm.usuarioId } });
      const v = eu.tokenVersao;
      await assert.rejects(
        atualizarUsuario(adm, adm.usuarioId, { nome: eu.nome, email: eu.email, papel: "GESTOR_SGI", escopoObras: "TODAS" }),
        /próprio papel de administrador/,
      );
      await assert.rejects(definirUsuarioAtivo(adm, adm.usuarioId, false), /desativar a si mesmo/);
      assert.equal(await versao(adm.usuarioId), v);
      assert.equal((await admin.usuario.findUniqueOrThrow({ where: { id: adm.usuarioId } })).papel, "ADMIN");
    });

    await caso("perfis: cria/edita permissões (incrementa tokenVersao dos usuários); sistema não é excluível", async () => {
      await assert.rejects(criarPerfil(adm, { nome: "P", permissoes: ["NAO_EXISTE"] }), /Permissão inválida|nome/);
      const p = await criarPerfil(adm, { nome: `Perfil teste ${sufixo}`, permissoes: ["RNC_TRATAR"] });
      criados.perfis.push(p.id);
      const base = { nome: "Usuário Renomeado", email: emailNovo, papel: "INSPETOR", escopoObras: "SELECIONADAS", obraIds: obras.map((o) => o.id) };
      await atualizarUsuario(adm, novoId, { ...base, perfilId: p.id });
      const v = await versao(novoId);
      await atualizarPerfil(adm, p.id, { nome: `Perfil teste ${sufixo}`, permissoes: ["RNC_TRATAR", "PLANO_GERENCIAR"] });
      assert.equal(await versao(novoId), v + 1);
      assert.deepEqual((await admin.perfil.findUniqueOrThrow({ where: { id: p.id } })).permissoes.sort(), ["PLANO_GERENCIAR", "RNC_TRATAR"]);
      await assert.rejects(excluirPerfil(adm, p.id), /Há usuários/);
      await atualizarUsuario(adm, novoId, { ...base, perfilId: null });
      await excluirPerfil(adm, p.id);
      criados.perfis.pop();
      const sistema = await admin.perfil.findFirstOrThrow({ where: { empresaId: adm.empresaId, sistema: true } });
      await assert.rejects(excluirPerfil(adm, sistema.id), /sistema não podem ser excluídos/);
    });

    await caso("obras e setores: CRUD com ativo/inativo e nome único na empresa", async () => {
      const o = await salvarObra(adm, null, { nome: `Obra Teste ${sufixo}`, codigo: "TST" });
      criados.obras.push(o.id);
      await assert.rejects(salvarObra(adm, null, { nome: `Obra Teste ${sufixo}` }), /Já existe/);
      await salvarObra(adm, o.id, { nome: `Obra Teste ${sufixo}`, ativo: false });
      assert.equal((await admin.obraUnidade.findUniqueOrThrow({ where: { id: o.id } })).ativo, false);
      const s = await salvarSetor(adm, null, { nome: `Setor Teste ${sufixo}` });
      criados.setores.push(s.id);
      await salvarSetor(adm, s.id, { nome: `Setor Teste ${sufixo} B`, ativo: false });
      const sd = await admin.setor.findUniqueOrThrow({ where: { id: s.id } });
      assert.equal(sd.ativo, false);
      assert.equal(sd.nome, `Setor Teste ${sufixo} B`);
      // Outra empresa não enxerga/edita.
      const demo = await ator("admin@demo.com.br");
      await assert.rejects(salvarSetor(demo, s.id, { nome: "hack" }), /não encontrado/);
    });
  } finally {
    await admin.usuarioAcessoObra.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
    await admin.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
    await admin.perfil.deleteMany({ where: { id: { in: criados.perfis } } });
    await admin.obraUnidade.deleteMany({ where: { id: { in: criados.obras } } });
    await admin.setor.deleteMany({ where: { id: { in: criados.setores } } });
  }
  console.log(`\n${ok} casos OK`);
}

main()
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exitCode = 1;
  })
  .finally(() => admin.$disconnect());
