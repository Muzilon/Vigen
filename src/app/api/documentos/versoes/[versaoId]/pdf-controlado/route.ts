import QRCode from "qrcode";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { auth } from "@/auth";
import { abrirAnexo } from "@/lib/anexos/servico";
import { contentDisposition } from "@/lib/anexos/validacao";
import { getAtor } from "@/lib/ator-servidor";
import { podeLerVersao } from "@/lib/documentos/acesso";
import { formatarDataHora } from "@/lib/datas";
import { fusoDaEmpresa } from "@/lib/ator";
import { getContexto } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const naoEncontrado = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

const CABECALHOS_SEGURANCA = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
} as const;

/**
 * Download de uma revisão de documento como "cópia controlada": se o arquivo for PDF, injeta uma
 * tarja no topo da página 1 com QR Code (aponta para /validar-doc/{versaoId}) e o texto
 * "CÓPIA CONTROLADA — Impressa por {usuário} em {data}". Demais tipos de arquivo: proxy simples
 * para a rota de anexos (sem alteração). Revalida sessão, empresa (DbTenant) e acesso à revisão.
 */
export async function GET(req: Request, ctx: { params: Promise<{ versaoId: string }> }) {
  const session = await auth();
  if (!session?.user?.userId) return new Response("Não autenticado", { status: 401 });
  const { versaoId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(versaoId)) return naoEncontrado();

  const a = await getAtor();
  const acesso = await podeLerVersao(a, versaoId);
  if (!acesso.ler) return naoEncontrado();

  const versao = await a.db.versaoDocumento.findFirst({ where: { id: versaoId }, select: { anexoId: true } });
  if (!versao?.anexoId) return naoEncontrado();

  const r = await abrirAnexo(a, versao.anexoId);
  if (!r) return naoEncontrado();
  const { anexo, stream } = r;

  if (anexo.mimeType !== "application/pdf") {
    return new Response(null, { status: 302, headers: { Location: `/api/anexos/${anexo.id}` } });
  }

  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  try {
    const pdf = await PDFDocument.load(bytes);
    const ctx2 = await getContexto();
    const fuso = await fusoDaEmpresa(a);
    const origem = new URL(req.url).origin;
    const urlValidacao = `${origem}/validar-doc/${versaoId}`;
    const qrDataUrl = await QRCode.toDataURL(urlValidacao, { margin: 0, width: 200 });
    const qrPng = await pdf.embedPng(qrDataUrl);
    const fonte = await pdf.embedFont(StandardFonts.Helvetica);
    const texto = `CÓPIA CONTROLADA — Impressa por ${ctx2.usuario.nome} em ${formatarDataHora(new Date(), fuso)}`;

    const ALTURA_TARJA = 46;
    const TAMANHO_QR = 34;
    for (const pagina of pdf.getPages()) {
      const { width, height } = pagina.getSize();
      pagina.drawRectangle({ x: 0, y: height - ALTURA_TARJA, width, height: ALTURA_TARJA, color: rgb(1, 1, 0.85) });
      pagina.drawImage(qrPng, { x: 6, y: height - ALTURA_TARJA + 6, width: TAMANHO_QR, height: TAMANHO_QR });
      pagina.drawText(texto, {
        x: 6 + TAMANHO_QR + 8,
        y: height - ALTURA_TARJA / 2 - 4,
        size: 9,
        font: fonte,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: width - TAMANHO_QR - 20,
      });
    }

    const saida = await pdf.save();
    return new Response(Buffer.from(saida), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(anexo.nomeArquivo, false),
        ...CABECALHOS_SEGURANCA,
      },
    });
  } catch {
    // PDF corrompido/não suportado pelo pdf-lib: entrega o arquivo original sem a tarja.
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": anexo.mimeType,
        "Content-Disposition": contentDisposition(anexo.nomeArquivo, false),
        ...CABECALHOS_SEGURANCA,
      },
    });
  }
}
