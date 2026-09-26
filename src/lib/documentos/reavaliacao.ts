/**
 * Fonte de revisão periódica dos documentos (alerta REVISAO_DOCUMENTO_PROXIMA pelo cron): um alerta por
 * documento com revisão vigente cuja próxima revisão vence em até N dias (inclui vencidas), para o
 * responsável. Registrada por efeito colateral: src/lib/notificacoes/cron.ts importa este arquivo.
 */
import { dataIso, paraDataDb, somarDias } from "@/lib/datas";
import { registrarFonteReavaliacao } from "@/lib/reavaliacao/fontes";

registrarFonteReavaliacao({
  modulo: "DOCUMENTOS",
  tipoNotificacao: "REVISAO_DOCUMENTO_PROXIMA",
  async listarVencendo(db, _empresa, hoje, dias) {
    const docs = await db.documento.findMany({
      where: { status: { notIn: ["OBSOLETO", "CANCELADO"] }, versaoVigenteId: { not: null }, proximaRevisaoEm: { lte: paraDataDb(somarDias(hoje, dias)) } },
      select: { id: true, codigo: true, titulo: true, proximaRevisaoEm: true, responsavelId: true },
    });
    return docs.map((d) => ({
      entidadeId: d.id,
      modo: "ITEM" as const,
      dataReavaliacao: dataIso(d.proximaRevisaoEm!),
      titulo: `${d.codigo} — ${d.titulo}`,
      link: `/documentos/${d.id}`,
      usuarioIds: [d.responsavelId],
    }));
  },
});
