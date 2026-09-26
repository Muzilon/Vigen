import { PrismaClient, type Permissao } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function empresa(nome: string, cnpj: string) {
  return prisma.empresa.upsert({ where: { cnpj }, update: { nome }, create: { nome, cnpj } });
}

async function main() {
  const senhaHash = await bcrypt.hash("vigen123", 10);

  // ---- Monto ----
  const monto = await empresa("Monto", "00000000000100");
  const e = monto.id;
  const obras = [];
  for (const [nome, codigo] of [
    ["Obra Alfa", "ALF"],
    ["Obra Beta", "BET"],
  ]) {
    obras.push(
      await prisma.obraUnidade.upsert({
        where: { empresaId_nome: { empresaId: e, nome } },
        update: {},
        create: { empresaId: e, nome, codigo },
      }),
    );
  }

  const setores: Record<string, { id: string }> = {};
  for (const nome of ["Qualidade", "Segurança", "Meio Ambiente"]) {
    setores[nome] = await prisma.setor.upsert({
      where: { empresaId_nome: { empresaId: e, nome } },
      update: {},
      create: { empresaId: e, nome },
    });
  }

  const perfisSemente: { nome: string; descricao: string; permissoes: Permissao[] }[] = [
    {
      nome: "Qualidade",
      descricao: "Equipe de Qualidade",
      permissoes: ["RNC_VERIFICAR_EFICACIA", "RNC_APROVAR_CANCELAMENTO", "PLANO_GERENCIAR", "RNC_VER_RESTRITAS"],
    },
    { nome: "Segurança", descricao: "Equipe de SSO", permissoes: ["RNC_TRATAR", "PLANO_GERENCIAR", "RNC_VER_RESTRITAS"] },
    { nome: "Meio Ambiente", descricao: "Equipe de Meio Ambiente", permissoes: ["RNC_TRATAR", "PLANO_GERENCIAR"] },
  ];
  const perfis: Record<string, { id: string }> = {};
  for (const p of perfisSemente) {
    perfis[p.nome] = await prisma.perfil.upsert({
      where: { empresaId_nome: { empresaId: e, nome: p.nome } },
      update: { permissoes: p.permissoes, descricao: p.descricao, sistema: true },
      create: { empresaId: e, ...p, sistema: true },
    });
  }

  const usuarios = [
    { email: "admin@monto.com.br", nome: "Administrador Monto", papel: "ADMIN", escopoObras: "TODAS" },
    {
      email: "qualidade@monto.com.br",
      nome: "Gestora da Qualidade",
      papel: "GESTOR_SGI",
      escopoObras: "TODAS",
      perfilId: perfis.Qualidade.id,
      setorId: setores.Qualidade.id,
    },
    {
      email: "inspetor@monto.com.br",
      nome: "Inspetor de Campo",
      papel: "INSPETOR",
      escopoObras: "SELECIONADAS",
      setorId: setores["Segurança"].id,
    },
    { email: "colaborador@monto.com.br", nome: "Colaborador Monto", papel: "COLABORADOR", escopoObras: "SELECIONADAS" },
  ] as const;

  for (const u of usuarios) {
    const criado = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { ...u, senhaHash, ativo: true },
      create: { ...u, senhaHash, empresaId: e },
    });
    if (u.email === "inspetor@monto.com.br" || u.email === "colaborador@monto.com.br") {
      await prisma.usuarioAcessoObra.upsert({
        where: { empresaId_usuarioId_obraId: { empresaId: e, usuarioId: criado.id, obraId: obras[0].id } },
        update: {},
        create: { empresaId: e, usuarioId: criado.id, obraId: obras[0].id },
      });
    }
  }

  // ---- Demo (para testar isolamento) ----
  const demo = await empresa("Demo", "00000000000200");
  await prisma.obraUnidade.upsert({
    where: { empresaId_nome: { empresaId: demo.id, nome: "Unidade Demo" } },
    update: {},
    create: { empresaId: demo.id, nome: "Unidade Demo" },
  });
  await prisma.usuario.upsert({
    where: { email: "admin@demo.com.br" },
    update: { senhaHash, ativo: true },
    create: {
      empresaId: demo.id,
      email: "admin@demo.com.br",
      nome: "Administrador Demo",
      papel: "ADMIN",
      escopoObras: "TODAS",
      senhaHash,
    },
  });

  console.log("Seed concluído: Monto", monto.id, "| Demo", demo.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
