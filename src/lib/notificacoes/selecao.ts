import type { StatusItemAcao } from "@prisma/client";
import { dataIso, somarDias } from "@/lib/datas";

export interface ItemParaAlerta {
  id: string;
  status: StatusItemAcao;
  /** Coluna @db.Date (meia-noite UTC). */
  quando: Date;
  alertaEnviadoEm: Date | null;
  atrasoNotificadoEm: Date | null;
}

/**
 * Seleciona itens a alertar em "hoje" (YYYY-MM-DD no fuso da empresa — use hojeNoFuso):
 * - prazo: pendente/em andamento, hoje <= prazo <= hoje + dias, ainda sem alerta;
 * - atraso: pendente/em andamento, prazo < hoje, ainda sem aviso de atraso.
 * Idempotente: itens já marcados (alertaEnviadoEm/atrasoNotificadoEm) não voltam.
 */
export function selecionarAlertas<T extends ItemParaAlerta>(itens: readonly T[], hoje: string, diasAlerta: number) {
  const limite = somarDias(hoje, Math.max(0, diasAlerta));
  const prazo: T[] = [];
  const atraso: T[] = [];
  for (const i of itens) {
    if (i.status !== "PENDENTE" && i.status !== "EM_ANDAMENTO") continue;
    const q = dataIso(i.quando);
    if (q < hoje) {
      if (!i.atrasoNotificadoEm) atraso.push(i);
    } else if (q <= limite && !i.alertaEnviadoEm) {
      prazo.push(i);
    }
  }
  return { prazo, atraso };
}

/** Segunda-feira (YYYY-MM-DD) da semana de "hoje". */
export function segundaDaSemana(hoje: string) {
  const dow = new Date(`${hoje}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(hoje, -((dow + 6) % 7));
}

/** Dias entre hoje e o prazo (negativo = atrasado). */
export function diasAte(hoje: string, quando: Date) {
  return Math.round((Date.parse(`${dataIso(quando)}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
}
