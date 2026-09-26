/**
 * Fonte de reavaliação do módulo RISCOS_OPORTUNIDADES (alerta REAVALIACAO_PROXIMA pelo cron).
 * Registrada por efeito colateral: src/lib/notificacoes/cron.ts importa este arquivo.
 */
import { dataIso, somarDias, paraDataDb } from "@/lib/datas";
import { registrarFonteReavaliacao } from "@/lib/reavaliacao/fontes";
import { agruparReavaliacao } from "./regras";

registrarFonteReavaliacao({
  modulo: "RISCOS_OPORTUNIDADES",
  async listarVencendo(db, empresa, hoje, dias) {
    const limite = paraDataDb(somarDias(hoje, dias));
    const itens = await db.riscoOportunidade.findMany({
      where: { ativo: true, status: { not: "ENCERRADO" }, proximaReavaliacaoEm: { lte: limite } },
      select: {
        id: true,
        numero: true,
        tipo: true,
        descricao: true,
        modoReavaliacao: true,
        proximaReavaliacaoEm: true,
        processoId: true,
        responsavelId: true,
        criadoPorId: true,
        processo: { select: { codigo: true } },
      },
    });
    return agruparReavaliacao(
      itens.map((i) => ({
        ...i,
        proximaReavaliacaoEm: i.proximaReavaliacaoEm ? dataIso(i.proximaReavaliacaoEm) : null,
        processoCodigo: i.processo?.codigo ?? null,
      })),
      empresa.id,
    );
  },
});
