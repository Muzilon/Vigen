import type { Permissao } from "@prisma/client";
import type { DbTenant } from "@/lib/db-tenant";

/** Quem executa uma operação de domínio (independente de Next/Auth, para permitir scripts e testes). */
export interface Ator {
  db: DbTenant;
  empresaId: string;
  usuarioId: string;
  permissoes: readonly Permissao[];
  /** null = todas as obras. */
  obrasPermitidas: readonly string[] | null;
}

export function atorTem(a: Pick<Ator, "permissoes">, p: Permissao) {
  return a.permissoes.includes(p);
}

/** Cliente de transação do DbTenant. */
export type Tx = Parameters<Extract<Parameters<DbTenant["$transaction"]>[0], (...args: never[]) => unknown>>[0];

export async function fusoDaEmpresa(a: Pick<Ator, "db" | "empresaId">): Promise<string> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { fusoHorario: true } });
  return e?.fusoHorario ?? "America/Sao_Paulo";
}
