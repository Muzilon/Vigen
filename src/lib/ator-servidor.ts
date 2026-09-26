import type { Ator } from "@/lib/ator";
import { getContexto, getDb } from "@/lib/tenant";

/** Ator a partir da sessão atual (server components / server actions). */
export async function getAtor(): Promise<Ator> {
  const ctx = await getContexto();
  return {
    db: await getDb(),
    empresaId: ctx.empresaId,
    usuarioId: ctx.usuario.id,
    permissoes: ctx.permissoes,
    obrasPermitidas: ctx.obrasPermitidas,
  };
}
