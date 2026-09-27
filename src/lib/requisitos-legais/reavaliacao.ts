/**
 * Fonte de reavaliação do módulo REQUISITOS_LEGAIS (alerta REAVALIACAO_PROXIMA pelo cron): um alerta por
 * requisito com verificação próxima/vencida, para o responsável (ou quem cadastrou). Não aplicável fica fora.
 * Registrada por efeito colateral: src/lib/notificacoes/cron.ts importa este arquivo.
 */
import { dataIso, paraDataDb, somarDias } from "@/lib/datas";
import { registrarFonteReavaliacao } from "@/lib/reavaliacao/fontes";
import { linkRequisito } from "./acesso";

registrarFonteReavaliacao({
  modulo: "REQUISITOS_LEGAIS",
  async listarVencendo(db, _empresa, hoje, dias) {
    const rs = await db.requisitoLegal.findMany({
      where: { ativo: true, status: { not: "NAO_APLICAVEL" }, proximaVerificacaoEm: { lte: paraDataDb(somarDias(hoje, dias)) } },
      select: { id: true, codigo: true, numero: true, proximaVerificacaoEm: true, responsavelId: true, criadoPorId: true },
    });
    return rs.map((r) => ({
      entidadeId: r.id,
      modo: "ITEM" as const,
      dataReavaliacao: dataIso(r.proximaVerificacaoEm!),
      titulo: `requisito legal ${r.codigo} (${r.numero})`,
      link: linkRequisito(r.id),
      usuarioIds: [r.responsavelId ?? r.criadoPorId],
    }));
  },
});
