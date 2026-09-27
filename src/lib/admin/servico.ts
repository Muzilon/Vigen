/**
 * Administração da empresa (ADMIN_CONFIG): usuários, perfis, obras/unidades e setores.
 * Tudo via DbTenant (empresaId injetado). Toda mudança de acesso de um usuário (papel, perfil,
 * escopo de obras, obras, ativo, senha) incrementa tokenVersao — as sessões dele caem.
 */
import bcrypt from "bcryptjs";
import { Prisma, type Modulo, type Permissao } from "@prisma/client";
import { z } from "zod";
import { atorTem, type Ator, type Tx } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";
import { TODOS_MODULOS } from "@/lib/modulos";
import { permissoesEfetivas, TODAS_PERMISSOES } from "@/lib/permissoes";

export const PAPEIS = ["ADMIN", "GESTOR_SGI", "INSPETOR", "COLABORADOR"] as const;
export const MIN_SENHA = 8;

function exigirAdmin(a: Ator) {
  if (!atorTem(a, "ADMIN_CONFIG")) throw new ErroNegocio("Sem permissão para administrar a empresa.");
}

function mensagemZod(e: z.ZodError) {
  return e.issues.map((i) => i.message).join(" ");
}

function validar<T extends z.ZodType>(esquema: T, dados: unknown): z.output<T> {
  const r = esquema.safeParse(dados);
  if (!r.success) throw new ErroNegocio(mensagemZod(r.error));
  return r.data;
}

/** Converte violação de unicidade em mensagem de negócio. */
async function unico<T>(fn: () => Promise<T>, msg: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ErroNegocio(msg);
    throw e;
  }
}

const uuidOpcional = z
  .string()
  .nullish()
  .transform((s) => s || null)
  .pipe(z.uuid("Seleção inválida.").nullable());

const textoOpcional = z
  .string()
  .trim()
  .max(300, "Texto muito longo.")
  .nullish()
  .transform((s) => s || null);

// ---------------------------------------------------------------- usuários

export const esquemaAcessoUsuario = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  papel: z.enum(PAPEIS, "Papel inválido."),
  perfilId: uuidOpcional,
  setorId: uuidOpcional,
  escopoObras: z.enum(["TODAS", "SELECIONADAS"], "Escopo de unidades inválido."),
  obraIds: z.array(z.uuid("Unidade inválida.")).default([]),
});

export const esquemaSenha = z.string().min(MIN_SENHA, `A senha deve ter ao menos ${MIN_SENHA} caracteres.`).max(200);

export const esquemaNovoUsuario = esquemaAcessoUsuario.extend({ senha: esquemaSenha });

export type DadosUsuario = z.input<typeof esquemaAcessoUsuario>;

async function validarReferencias(tx: Tx, d: z.output<typeof esquemaAcessoUsuario>) {
  if (d.perfilId && !(await tx.perfil.findFirst({ where: { id: d.perfilId }, select: { id: true } }))) {
    throw new ErroNegocio("Perfil inválido.");
  }
  if (d.setorId && !(await tx.setor.findFirst({ where: { id: d.setorId }, select: { id: true } }))) {
    throw new ErroNegocio("Setor inválido.");
  }
  const obraIds = d.escopoObras === "SELECIONADAS" ? [...new Set(d.obraIds)] : [];
  if (obraIds.length && (await tx.obraUnidade.count({ where: { id: { in: obraIds } } })) !== obraIds.length) {
    throw new ErroNegocio("Unidade inválida.");
  }
  return obraIds;
}

async function permissoesDoPerfil(tx: Tx, perfilId: string | null): Promise<Permissao[]> {
  if (!perfilId) return [];
  return (await tx.perfil.findFirst({ where: { id: perfilId }, select: { permissoes: true } }))?.permissoes ?? [];
}

export async function criarUsuario(a: Ator, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaNovoUsuario, dados);
  const senhaHash = await bcrypt.hash(d.senha, 10);
  return unico(
    () =>
      a.db.$transaction(async (tx) => {
        const obraIds = await validarReferencias(tx, d);
        const u = await tx.usuario.create({
          data: {
            empresaId: a.empresaId,
            nome: d.nome,
            email: d.email,
            senhaHash,
            papel: d.papel,
            perfilId: d.perfilId,
            setorId: d.setorId,
            escopoObras: d.escopoObras,
          },
          select: { id: true },
        });
        if (obraIds.length) {
          await tx.usuarioAcessoObra.createMany({
            data: obraIds.map((obraId) => ({ empresaId: a.empresaId, usuarioId: u.id, obraId })),
          });
        }
        return u;
      }),
    "Já existe um usuário com este e-mail.",
  );
}

/** Atualiza dados e acesso. Qualquer mudança de acesso incrementa tokenVersao. */
export async function atualizarUsuario(a: Ator, id: string, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaAcessoUsuario, dados);
  return unico(
    () =>
      a.db.$transaction(async (tx) => {
        const atual = await tx.usuario.findFirst({
          where: { id },
          select: { id: true, papel: true, perfilId: true, escopoObras: true, email: true, acessosObra: { select: { obraId: true } } },
        });
        if (!atual) throw new ErroNegocio("Usuário não encontrado.");
        const obraIds = await validarReferencias(tx, d);
        if (id === a.usuarioId) {
          if (atual.papel === "ADMIN" && d.papel !== "ADMIN") {
            throw new ErroNegocio("Você não pode remover o próprio papel de administrador.");
          }
          if (!permissoesEfetivas(d.papel, await permissoesDoPerfil(tx, d.perfilId)).includes("ADMIN_CONFIG")) {
            throw new ErroNegocio("Você não pode remover a própria permissão de administração.");
          }
        }
        const antes = [...atual.acessosObra.map((x) => x.obraId)].sort().join(",");
        const depois = [...obraIds].sort().join(",");
        const mudouAcesso =
          atual.papel !== d.papel ||
          atual.perfilId !== d.perfilId ||
          atual.escopoObras !== d.escopoObras ||
          antes !== depois ||
          atual.email !== d.email;
        await tx.usuario.update({
          where: { id },
          data: {
            nome: d.nome,
            email: d.email,
            papel: d.papel,
            perfilId: d.perfilId,
            setorId: d.setorId,
            escopoObras: d.escopoObras,
            ...(mudouAcesso ? { tokenVersao: { increment: 1 } } : {}),
          },
        });
        if (antes !== depois) {
          await tx.usuarioAcessoObra.deleteMany({ where: { usuarioId: id } });
          if (obraIds.length) {
            await tx.usuarioAcessoObra.createMany({
              data: obraIds.map((obraId) => ({ empresaId: a.empresaId, usuarioId: id, obraId })),
            });
          }
        }
        return { mudouAcesso };
      }),
    "Já existe um usuário com este e-mail.",
  );
}

export async function definirUsuarioAtivo(a: Ator, id: string, ativo: boolean) {
  exigirAdmin(a);
  if (id === a.usuarioId && !ativo) throw new ErroNegocio("Você não pode desativar a si mesmo.");
  const r = await a.db.usuario.updateMany({
    where: { id, ativo: !ativo },
    data: { ativo, tokenVersao: { increment: 1 } },
  });
  if (r.count === 0) {
    if (!(await a.db.usuario.findFirst({ where: { id }, select: { id: true } }))) throw new ErroNegocio("Usuário não encontrado.");
  }
}

export async function redefinirSenha(a: Ator, id: string, senha: unknown) {
  exigirAdmin(a);
  const s = validar(esquemaSenha, senha);
  const senhaHash = await bcrypt.hash(s, 10);
  const r = await a.db.usuario.updateMany({ where: { id }, data: { senhaHash, tokenVersao: { increment: 1 } } });
  if (r.count === 0) throw new ErroNegocio("Usuário não encontrado.");
}

// ---------------------------------------------------------------- perfis

export const esquemaPerfil = z.object({
  nome: z.string().trim().min(2, "Informe o nome do perfil.").max(80, "Nome muito longo."),
  descricao: textoOpcional,
  permissoes: z.array(z.enum(TODAS_PERMISSOES, "Permissão inválida.")).default([]),
});

export async function criarPerfil(a: Ator, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaPerfil, dados);
  return unico(
    () =>
      a.db.perfil.create({
        data: { empresaId: a.empresaId, nome: d.nome, descricao: d.descricao, permissoes: [...new Set(d.permissoes)] },
        select: { id: true },
      }),
    "Já existe um perfil com este nome.",
  );
}

export async function atualizarPerfil(a: Ator, id: string, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaPerfil, dados);
  const permissoes = [...new Set(d.permissoes)];
  return unico(
    () =>
      a.db.$transaction(async (tx) => {
        const p = await tx.perfil.findFirst({ where: { id }, select: { id: true, permissoes: true } });
        if (!p) throw new ErroNegocio("Perfil não encontrado.");
        const eu = await tx.usuario.findFirst({ where: { id: a.usuarioId }, select: { papel: true, perfilId: true } });
        if (eu?.perfilId === id && !permissoesEfetivas(eu.papel, permissoes).includes("ADMIN_CONFIG")) {
          throw new ErroNegocio("Você não pode remover a própria permissão de administração.");
        }
        await tx.perfil.update({ where: { id }, data: { nome: d.nome, descricao: d.descricao, permissoes } });
        const mudou = [...p.permissoes].sort().join(",") !== [...permissoes].sort().join(",");
        if (mudou) await tx.usuario.updateMany({ where: { perfilId: id }, data: { tokenVersao: { increment: 1 } } });
      }),
    "Já existe um perfil com este nome.",
  );
}

export async function excluirPerfil(a: Ator, id: string) {
  exigirAdmin(a);
  const p = await a.db.perfil.findFirst({ where: { id }, select: { sistema: true, _count: { select: { usuarios: true } } } });
  if (!p) throw new ErroNegocio("Perfil não encontrado.");
  if (p.sistema) throw new ErroNegocio("Perfis do sistema não podem ser excluídos.");
  if (p._count.usuarios > 0) throw new ErroNegocio("Há usuários com este perfil. Troque o perfil deles antes de excluir.");
  await a.db.perfil.deleteMany({ where: { id, sistema: false } });
}

// ---------------------------------------------------------------- obras / setores

export const esquemaObra = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  codigo: textoOpcional,
  endereco: textoOpcional,
  ativo: z.boolean().default(true),
});

export const esquemaSetor = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  ativo: z.boolean().default(true),
});

export async function salvarObra(a: Ator, id: string | null, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaObra, dados);
  return unico(async () => {
    if (!id) return a.db.obraUnidade.create({ data: { empresaId: a.empresaId, ...d }, select: { id: true } });
    const r = await a.db.obraUnidade.updateMany({ where: { id }, data: d });
    if (r.count === 0) throw new ErroNegocio("Unidade não encontrada.");
    return { id };
  }, "Já existe uma unidade com este nome.");
}

export async function salvarSetor(a: Ator, id: string | null, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaSetor, dados);
  return unico(async () => {
    if (!id) return a.db.setor.create({ data: { empresaId: a.empresaId, ...d }, select: { id: true } });
    const r = await a.db.setor.updateMany({ where: { id }, data: d });
    if (r.count === 0) throw new ErroNegocio("Setor não encontrado.");
    return { id };
  }, "Já existe um setor com este nome.");
}

// ---------------------------------------------------------------- módulos contratados

/** Liga/desliga os módulos contratados da empresa (Empresa.modulosAtivos). */
export async function salvarModulosAtivos(a: Ator, modulos: unknown) {
  exigirAdmin(a);
  const lista = z.array(z.enum(TODOS_MODULOS as [Modulo, ...Modulo[]])).parse(modulos);
  // RNC e Plano de Ação são a base do sistema: sempre ativos.
  const modulosAtivos = [...new Set(["RNC", "PLANO_ACAO", ...lista] as Modulo[])];
  await a.db.empresa.update({ where: { id: a.empresaId }, data: { modulosAtivos } });
  return modulosAtivos;
}

export async function dadosModulos(a: Ator) {
  exigirAdmin(a);
  const empresa = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return { modulosAtivos: empresa?.modulosAtivos ?? [] };
}

// ---------------------------------------------------------------- configuração de escala

export const esquemaEscala = z.object({
  tipo: z.enum(["RISCO_OPORTUNIDADE", "HIRA", "ASPECTO_IMPACTO"]),
  obraId: z
    .string()
    .nullish()
    .transform((s) => s || null)
    .pipe(z.uuid("Unidade inválida.").nullable()),
  tamanho: z.coerce.number().refine((n) => n === 3 || n === 5, "Tamanho deve ser 3 ou 5."),
  eixos: z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "JSON inválido em Eixos." });
      return z.NEVER;
    }
  }),
  faixas: z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "JSON inválido em Faixas." });
      return z.NEVER;
    }
  }),
  criteriosExtras: z
    .string()
    .nullish()
    .transform((s, ctx) => {
      if (!s) return undefined;
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: "JSON inválido em Critérios extras." });
        return z.NEVER;
      }
    }),
});

export async function salvarConfiguracaoEscala(a: Ator, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaEscala, dados);
  if (d.obraId && !(await a.db.obraUnidade.findFirst({ where: { id: d.obraId }, select: { id: true } }))) {
    throw new ErroNegocio("Unidade inválida.");
  }
  // Não usa upsert com a chave composta [empresaId, tipo, obraId]: o Prisma não aceita
  // `null` no tipo do compound-unique input para uma coluna nullable — resolve à mão.
  return unico(async () => {
    const existente = await a.db.configuracaoEscala.findFirst({ where: { tipo: d.tipo, obraId: d.obraId }, select: { id: true } });
    const dadosSalvos = { tamanho: d.tamanho, eixos: d.eixos, faixas: d.faixas, criteriosExtras: d.criteriosExtras };
    if (existente) return a.db.configuracaoEscala.update({ where: { id: existente.id }, data: dadosSalvos });
    return a.db.configuracaoEscala.create({ data: { empresaId: a.empresaId, tipo: d.tipo, obraId: d.obraId, ...dadosSalvos } });
  }, "Já existe uma configuração para este tipo/unidade.");
}

export async function excluirConfiguracaoEscala(a: Ator, id: string) {
  exigirAdmin(a);
  await a.db.configuracaoEscala.deleteMany({ where: { id } });
}

export async function dadosEscalas(a: Ator) {
  exigirAdmin(a);
  const [configuracoes, obras] = await Promise.all([
    a.db.configuracaoEscala.findMany({ orderBy: [{ tipo: "asc" }, { criadoEm: "asc" }] }),
    a.db.obraUnidade.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  return { configuracoes, obras };
}

// ---------------------------------------------------------------- leitura

export async function dadosAdministracao(a: Ator) {
  exigirAdmin(a);
  const [usuarios, perfis, obras, setores] = await Promise.all([
    a.db.usuario.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true, nome: true, email: true, papel: true, perfilId: true, setorId: true, escopoObras: true, ativo: true, ultimoLogin: true,
        acessosObra: { select: { obraId: true } },
      },
    }),
    a.db.perfil.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { usuarios: true } } } }),
    a.db.obraUnidade.findMany({ orderBy: { nome: "asc" } }),
    a.db.setor.findMany({ orderBy: { nome: "asc" } }),
  ]);
  return { usuarios, perfis, obras, setores };
}
