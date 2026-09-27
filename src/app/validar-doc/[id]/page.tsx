import { notFound } from "next/navigation";
import { prismaAdmin } from "@/lib/prisma";
import { formatarData } from "@/lib/datas";
import { rotuloRevisao } from "@/lib/documentos/regras";

export const dynamic = "force-dynamic";

/**
 * Página pública (sem sessão) para onde o QR Code da "cópia controlada" aponta: mostra se a
 * revisão impressa/baixada ainda é a vigente (verde) ou já ficou obsoleta (vermelho). Não usa
 * getAtor()/getContexto() — consulta o Prisma direto pelo id (UUID) da VersaoDocumento, sem
 * expor nada alem do necessário para a tela semafórica.
 */
export default async function ValidarDocumentoPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const versao = await prismaAdmin.versaoDocumento.findFirst({
    where: { id },
    select: {
      numero: true,
      status: true,
      publicadoEm: true,
      documento: { select: { codigo: true, titulo: true, versaoVigenteId: true, versaoVigente: { select: { numero: true } } } },
    },
  });

  if (!versao) {
    return (
      <Tela cor="neutro" titulo="Documento não encontrado" mensagem="Este código não corresponde a nenhuma revisão de documento válida." />
    );
  }

  const vigente = versao.status === "PUBLICADA" && versao.documento.versaoVigenteId === id;

  if (vigente) {
    return (
      <Tela cor="verde" titulo="✅ Documento vigente" mensagem={`${versao.documento.codigo} — ${versao.documento.titulo}`}>
        <p>
          {rotuloRevisao(versao.numero)} · publicada em {formatarData(versao.publicadoEm)}
        </p>
      </Tela>
    );
  }

  const revisaoAtual = versao.documento.versaoVigente ? rotuloRevisao(versao.documento.versaoVigente.numero) : null;
  return (
    <Tela cor="vermelho" titulo="🔴 Versão obsoleta ou não vigente" mensagem={`${versao.documento.codigo} — ${versao.documento.titulo}`}>
      <p>Esta cópia corresponde à {rotuloRevisao(versao.numero)}, que não é a revisão vigente.</p>
      {revisaoAtual && <p>A revisão vigente atual é a {revisaoAtual} — acesse o sistema para a versão correta.</p>}
    </Tela>
  );
}

function Tela({ cor, titulo, mensagem, children }: { cor: "verde" | "vermelho" | "neutro"; titulo: string; mensagem?: string; children?: React.ReactNode }) {
  const cores = {
    verde: { fundo: "#e6f6ec", texto: "#0f5132", borda: "#0f5132" },
    vermelho: { fundo: "#fdecec", texto: "#7a1620", borda: "#7a1620" },
    neutro: { fundo: "#f1f1f1", texto: "#333", borda: "#999" },
  }[cor];
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        gap: "12px",
        background: cores.fundo,
        color: cores.texto,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", margin: 0, border: `2px solid ${cores.borda}`, borderRadius: "12px", padding: "16px 24px" }}>{titulo}</h1>
      {mensagem && <p style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>{mensagem}</p>}
      <div style={{ fontSize: "1rem" }}>{children}</div>
      <p style={{ marginTop: "24px", fontSize: "0.85rem", opacity: 0.7 }}>Vigen — validação de cópia controlada</p>
    </main>
  );
}
