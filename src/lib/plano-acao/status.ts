import type { StatusItemAcao } from "@prisma/client";
import { dataIso } from "@/lib/datas";

export type StatusEfetivoItem = StatusItemAcao | "ATRASADO";
export type StatusGeralPlano = "SEM_ITENS" | "PENDENTE" | "EM_ANDAMENTO" | "ATRASADO" | "CONCLUIDO";

/** ATRASADO se prazo < hoje (fuso da empresa) e ainda pendente/em andamento. */
export function statusEfetivoItem(item: { status: StatusItemAcao; quando: Date }, hoje: string): StatusEfetivoItem {
  if ((item.status === "PENDENTE" || item.status === "EM_ANDAMENTO") && dataIso(item.quando) < hoje) {
    return "ATRASADO";
  }
  return item.status;
}

/**
 * Item concluído DEPOIS do prazo (data de conclusão > "quando"). Não vira um status novo: o item continua CONCLUIDO
 * (contagens, filtros e indicadores seguem iguais); a tela só mostra a etiqueta "Concluído fora do prazo".
 */
export function concluidoForaDoPrazo(item: { status: StatusItemAcao; quando: Date; dataConclusao?: Date | null }): boolean {
  return item.status === "CONCLUIDO" && !!item.dataConclusao && dataIso(item.dataConclusao) > dataIso(item.quando);
}

export function statusGeralPlano(itens: readonly { status: StatusItemAcao; quando: Date }[], hoje: string): StatusGeralPlano {
  const ativos = itens.filter((i) => i.status !== "CANCELADO");
  if (ativos.length === 0) return "SEM_ITENS";
  const ef = ativos.map((i) => statusEfetivoItem(i, hoje));
  if (ef.includes("ATRASADO")) return "ATRASADO";
  if (ef.every((s) => s === "CONCLUIDO")) return "CONCLUIDO";
  if (ef.some((s) => s === "EM_ANDAMENTO" || s === "CONCLUIDO")) return "EM_ANDAMENTO";
  return "PENDENTE";
}
