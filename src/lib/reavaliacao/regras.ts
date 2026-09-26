/** Regras puras de reavaliação periódica (docs/06-desenho-modulos.md, decisão 4). */
import { hojeNoFuso } from "@/lib/datas";

/** ITEM: cada linha tem sua própria data. GERAL: a planilha inteira é revista de uma vez. */
export type ModoReavaliacao = "ITEM" | "GERAL";
export const MODOS_REAVALIACAO: readonly ModoReavaliacao[] = ["ITEM", "GERAL"];

/**
 * Próxima reavaliação = dataBase + `meses`, em YYYY-MM-DD. `dataBase` string (YYYY-MM-DD) é
 * usada como está; Date é convertida para o dia civil no `fuso` da empresa. Dia inexistente
 * no mês de destino é ajustado para o último dia (31/01 + 1 mês → 28 ou 29/02).
 */
export function calcularProximaReavaliacao(dataBase: string | Date, meses: number, fuso = "America/Sao_Paulo"): string {
  if (!Number.isInteger(meses) || meses <= 0) throw new Error("Periodicidade de reavaliação deve ser um inteiro positivo de meses.");
  const iso = typeof dataBase === "string" ? dataBase.slice(0, 10) : hojeNoFuso(fuso, dataBase);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data inválida: ${iso}`);
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const totalMeses = ano * 12 + (mes - 1) + meses;
  const a2 = Math.floor(totalMeses / 12);
  const m2 = (totalMeses % 12) + 1;
  const ultimo = new Date(Date.UTC(a2, m2, 0)).getUTCDate();
  const d2 = Math.min(dia, ultimo);
  return `${a2}-${String(m2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
}

/** Deve alertar: vence até hoje + diasAntecedencia (inclui as já vencidas). Datas YYYY-MM-DD. */
export function deveAlertarReavaliacao(dataReavaliacao: string, hoje: string, diasAntecedencia: number) {
  const limite = new Date(`${hoje}T00:00:00.000Z`);
  limite.setUTCDate(limite.getUTCDate() + diasAntecedencia);
  return dataReavaliacao <= limite.toISOString().slice(0, 10);
}
