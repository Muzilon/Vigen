import { cache } from "react";
import { redirect } from "next/navigation";
import type { Permissao } from "@prisma/client";
import { auth } from "@/auth";
import { criarDbTenant, type DbTenant } from "@/lib/db-tenant";

export { prismaAdmin } from "@/lib/prisma";

export interface Contexto {
  usuario: { id: string; nome: string; email: string | null | undefined; papel: string; empresaNome: string };
  empresaId: string;
  permissoes: Permissao[];
  /** null = todas as obras da empresa. */
  obrasPermitidas: string[] | null;
}

export class ErroPermissao extends Error {}

/** Contexto do usuário logado (redireciona para /login se não houver sessão). */
export const getContexto = cache(async (): Promise<Contexto> => {
  const session = await auth();
  const u = session?.user;
  if (!u?.userId || !u.empresaId) redirect("/login");
  const todas = u.escopoObras === "TODAS" || u.permissoes.includes("VER_TODAS_OBRAS");
  return {
    usuario: { id: u.userId, nome: u.nome, email: u.email, papel: u.papel, empresaNome: u.empresaNome },
    empresaId: u.empresaId,
    permissoes: u.permissoes,
    obrasPermitidas: todas ? null : (u.obrasIds ?? []),
  };
});

export function temPermissao(ctx: Contexto, p: Permissao) {
  return ctx.permissoes.includes(p);
}

export async function exigirPermissao(p: Permissao): Promise<Contexto> {
  const ctx = await getContexto();
  if (!temPermissao(ctx, p)) throw new ErroPermissao(`Permissão necessária: ${p}`);
  return ctx;
}

const dbPorEmpresa = cache((empresaId: string) => criarDbTenant(empresaId));

/** Prisma com empresaId injetado automaticamente. */
export async function getDb(): Promise<DbTenant> {
  const ctx = await getContexto();
  return dbPorEmpresa(ctx.empresaId);
}

/** Filtro de obra para modelos com obraId (ex.: Rnc). */
export function filtroObras(ctx: Pick<Contexto, "obrasPermitidas">): { obraId?: { in: string[] } } {
  return ctx.obrasPermitidas === null ? {} : { obraId: { in: ctx.obrasPermitidas } };
}

