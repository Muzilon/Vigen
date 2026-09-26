/**
 * Fonte de reavaliação do módulo HIRA (alerta REAVALIACAO_PROXIMA pelo cron). ITEM: um alerta por
 * linha; GERAL: um por obra (revisão geral da planilha). Registrada por efeito colateral:
 * src/lib/notificacoes/cron.ts importa este arquivo.
 */
import { dataIso, paraDataDb, somarDias } from "@/lib/datas";
import { registrarFonteReavaliacao } from "@/lib/reavaliacao/fontes";
import { agruparReavaliacaoPorObra, codigoHira } from "./regras";

registrarFonteReavaliacao({
  modulo: "HIRA",
  async listarVencendo(db, _empresa, hoje, dias) {
    const itens = await db.linhaHira.findMany({
      where: { status: "VIGENTE", proximaReavaliacaoEm: { lte: paraDataDb(somarDias(hoje, dias)) } },
      select: {
        id: true,
        numero: true,
        atividade: true,
        modoReavaliacao: true,
        proximaReavaliacaoEm: true,
        obraId: true,
        responsavelId: true,
        criadoPorId: true,
        obra: { select: { nome: true } },
      },
    });
    return agruparReavaliacaoPorObra(
      itens.map((i) => ({ ...i, obraNome: i.obra.nome, proximaReavaliacaoEm: i.proximaReavaliacaoEm ? dataIso(i.proximaReavaliacaoEm) : null })),
      "/hira",
      "HIRA",
      codigoHira,
    );
  },
});
