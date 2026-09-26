import type { StatusItemAcao, StatusRnc } from "@prisma/client";

export type AcaoRnc =
  | "ASSUMIR"
  | "INICIAR_EXECUCAO"
  | "ENVIAR_VERIFICACAO"
  | "VERIFICAR_EFICAZ"
  | "VERIFICAR_INEFICAZ"
  | "CANCELAR";

export const STATUS_FINAIS: readonly StatusRnc[] = ["ENCERRADO", "CANCELADO"];

export const TRANSICOES: Record<AcaoRnc, { de: readonly StatusRnc[]; para: StatusRnc }> = {
  ASSUMIR: { de: ["ABERTO", "REABERTO"], para: "EM_ANALISE" },
  INICIAR_EXECUCAO: { de: ["EM_ANALISE"], para: "PLANO_EM_EXECUCAO" },
  ENVIAR_VERIFICACAO: { de: ["PLANO_EM_EXECUCAO"], para: "EM_VERIFICACAO" },
  VERIFICAR_EFICAZ: { de: ["EM_VERIFICACAO"], para: "ENCERRADO" },
  VERIFICAR_INEFICAZ: { de: ["EM_VERIFICACAO"], para: "REABERTO" },
  CANCELAR: { de: ["ABERTO", "EM_ANALISE", "PLANO_EM_EXECUCAO", "EM_VERIFICACAO", "REABERTO"], para: "CANCELADO" },
};

export interface SnapshotRnc {
  status: StatusRnc;
  causaRaiz?: string | null;
  /** Status dos itens do ciclo atual do plano de ação. */
  itensCicloAtual?: readonly StatusItemAcao[];
}

export type ResultadoTransicao = { ok: true; para: StatusRnc } | { ok: false; erro: string };

/** Regras puras da máquina de estados (sem permissão/IO). */
export function avaliarTransicao(s: SnapshotRnc, acao: AcaoRnc): ResultadoTransicao {
  const t = TRANSICOES[acao];
  if (!t.de.includes(s.status)) {
    return { ok: false, erro: `Transição não permitida a partir do status ${s.status}.` };
  }
  const itens = s.itensCicloAtual ?? [];
  if (acao === "INICIAR_EXECUCAO") {
    if (!s.causaRaiz?.trim()) return { ok: false, erro: "Registre a causa raiz antes de executar o plano." };
    if (!itens.some((i) => i !== "CANCELADO")) {
      return { ok: false, erro: "O plano de ação precisa de ao menos 1 item neste ciclo." };
    }
  }
  if (acao === "ENVIAR_VERIFICACAO") {
    if (!itens.every((i) => i === "CONCLUIDO" || i === "CANCELADO")) {
      return { ok: false, erro: "Todos os itens do ciclo atual devem estar concluídos ou cancelados." };
    }
    if (!itens.includes("CONCLUIDO")) return { ok: false, erro: "Ao menos 1 item precisa estar concluído." };
  }
  return { ok: true, para: t.para };
}

export function acoesPossiveis(s: SnapshotRnc): AcaoRnc[] {
  return (Object.keys(TRANSICOES) as AcaoRnc[]).filter((a) => TRANSICOES[a].de.includes(s.status));
}

/** Ciclo atual = nº de verificações ineficazes + 1. */
export function cicloAtual(verificacoes: readonly { resultado: string }[]): number {
  return verificacoes.filter((v) => v.resultado === "INEFICAZ").length + 1;
}
