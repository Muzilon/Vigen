import { auth } from "@/auth";
import { abrirAnexo } from "@/lib/anexos/servico";
import { contentDisposition, MIMES_INLINE } from "@/lib/anexos/validacao";
import { getAtor } from "@/lib/ator-servidor";

export const dynamic = "force-dynamic";

const naoEncontrado = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Download de anexo: SEMPRE por aqui. Revalida sessão, empresa (DbTenant), acesso à entidade
 * e sensibilidade a cada requisição. ?inline=1 exibe no navegador apenas imagens seguras e PDF.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/anexos/[id]">) {
  const session = await auth();
  if (!session?.user?.userId) return new Response("Não autenticado", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return naoEncontrado();

  const r = await abrirAnexo(await getAtor(), id);
  if (!r) return naoEncontrado();
  const { anexo, stream } = r;
  const inline = new URL(req.url).searchParams.get("inline") === "1" && MIMES_INLINE.has(anexo.mimeType);

  return new Response(stream, {
    headers: {
      "Content-Type": anexo.mimeType,
      "Content-Length": String(anexo.tamanhoBytes),
      "Content-Disposition": contentDisposition(anexo.nomeArquivo, inline),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
