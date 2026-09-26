/** Auditorias internas (P5) — regras puras: rótulos, máquina de status, origem/tipo da RNC gerada. */
import type { OrigemRnc, StatusAuditoria, TipoAuditoria, TipoConstatacao, TipoRnc } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const ROTULO_TIPO_AUDITORIA: Record<TipoAuditoria, string> = {
  INTERNA: "Interna",
  EXTERNA_CERTIFICACAO: "Externa (certificação)",
};
export const TIPOS_AUDITORIA = Object.keys(ROTULO_TIPO_AUDITORIA) as TipoAuditoria[];

export const ROTULO_STATUS_AUDITORIA: Record<StatusAuditoria, string> = {
  PLANEJADA: "Planejada",
  EM_EXECUCAO: "Em execução",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};
export const STATUS_AUDITORIA = Object.keys(ROTULO_STATUS_AUDITORIA) as StatusAuditoria[];

export const ROTULO_TIPO_CONSTATACAO: Record<TipoConstatacao, string> = {
  NAO_CONFORMIDADE: "Não conformidade",
  OBSERVACAO: "Observação",
  OPORTUNIDADE_MELHORIA: "Oportunidade de melhoria",
  PONTO_FORTE: "Ponto forte",
};
export const TIPOS_CONSTATACAO = Object.keys(ROTULO_TIPO_CONSTATACAO) as TipoConstatacao[];

export type AcaoAuditoria = "INICIAR" | "CONCLUIR" | "CANCELAR" | "EDITAR_PLANO" | "CONSTATAR" | "GERAR_RNC";

const PERMITIDO: Record<AcaoAuditoria, StatusAuditoria[]> = {
  INICIAR: ["PLANEJADA"],
  CONCLUIR: ["EM_EXECUCAO"],
  CANCELAR: ["PLANEJADA", "EM_EXECUCAO"],
  EDITAR_PLANO: ["PLANEJADA", "EM_EXECUCAO"],
  CONSTATAR: ["EM_EXECUCAO"],
  GERAR_RNC: ["EM_EXECUCAO", "CONCLUIDA"],
};

const MENSAGEM: Record<AcaoAuditoria, string> = {
  INICIAR: "Só é possível iniciar uma auditoria planejada.",
  CONCLUIR: "Só é possível concluir uma auditoria em execução.",
  CANCELAR: "Auditoria concluída ou cancelada não pode ser cancelada.",
  EDITAR_PLANO: "O plano só pode ser alterado com a auditoria planejada ou em execução.",
  CONSTATAR: "Constatações são registradas com a auditoria em execução.",
  GERAR_RNC: "RNC só pode ser aberta com a auditoria em execução ou concluída.",
};

export function permitido(status: StatusAuditoria, acao: AcaoAuditoria) {
  return PERMITIDO[acao].includes(status);
}

export function exigirStatus(status: StatusAuditoria, acao: AcaoAuditoria) {
  if (!permitido(status, acao)) throw new ErroNegocio(MENSAGEM[acao]);
}

/** Auditoria interna → AUDITORIA_INTERNA; externa (certificação) → AUDITORIA_EXTERNA (enum OrigemRnc). */
export function origemRncDaAuditoria(t: TipoAuditoria): OrigemRnc {
  return t === "INTERNA" ? "AUDITORIA_INTERNA" : "AUDITORIA_EXTERNA";
}

/** Tipo sugerido da RNC pela norma: 45001 → SSO, 14001 → meio ambiente, demais → qualidade. */
export function tipoRncDaNorma(norma: string): TipoRnc {
  if (/45001/.test(norma)) return "SSO";
  if (/14001/.test(norma)) return "MEIO_AMBIENTE";
  return "QUALIDADE";
}

const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function tituloRncDaConstatacao(codigo: string, descricao: string) {
  return cortar(`Auditoria ${codigo}: ${descricao}`, 200);
}

export function descricaoRncDaConstatacao(c: {
  codigo: string;
  tipoAuditoria: TipoAuditoria;
  norma: string;
  requisito: string | null;
  descricao: string;
  evidencia: string | null;
  auditor: string;
}) {
  return [
    `Não conformidade registrada na auditoria ${c.codigo} (${ROTULO_TIPO_AUDITORIA[c.tipoAuditoria].toLowerCase()}, ${c.norma}) — auditor líder: ${c.auditor}.`,
    c.requisito ? `Requisito: ${c.requisito}` : null,
    `Constatação: ${c.descricao}`,
    c.evidencia ? `Evidência: ${c.evidencia}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function contarPorTipo(cs: readonly { tipo: TipoConstatacao }[]): Record<TipoConstatacao, number> {
  const out: Record<TipoConstatacao, number> = { NAO_CONFORMIDADE: 0, OBSERVACAO: 0, OPORTUNIDADE_MELHORIA: 0, PONTO_FORTE: 0 };
  for (const c of cs) out[c.tipo]++;
  return out;
}
