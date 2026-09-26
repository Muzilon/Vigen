import { auth } from "@/auth";
import { getAtor } from "@/lib/ator-servidor";
import { podeLerVersao } from "@/lib/documentos/acesso";

export const dynamic = "force-dynamic";

const naoEncontrado = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Snapshot JSON de uma revisão sem arquivo (planilha controlada HIRA/LAIA gerada pela tramitação).
 * Revalida sessão, empresa (DbTenant) e o acesso à revisão a cada requisição.
 */
export async function GET(_req: Request, ctx: RouteContext<"/documentos/[id]/versoes/[versaoId]/conteudo">) {
  const session = await auth();
  if (!session?.user?.userId) return new Response("Não autenticado", { status: 401 });
  const { id, versaoId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(versaoId)) return naoEncontrado();
  const a = await getAtor();
  const acesso = await podeLerVersao(a, versaoId);
  if (!acesso.ler || acesso.documentoId !== id) return naoEncontrado();
  const v = await a.db.versaoDocumento.findFirst({ where: { id: versaoId }, select: { numero: true, conteudo: true, documento: { select: { codigo: true } } } });
  if (!v?.conteudo) return naoEncontrado();
  const nome = `${v.documento.codigo}_Rev${String(v.numero).padStart(2, "0")}.json`;
  return new Response(JSON.stringify(v.conteudo, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
