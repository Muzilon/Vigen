/** Requisitos legais (P6) — regras puras: rótulos, exigência de plano, vencimento e % de atendimento. */
import type { AcaoHistoricoRequisito, EsferaRequisito, StatusRequisitoLegal, TemaRequisito, TipoRequisitoLegal } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const ROTULO_TIPO_REQUISITO: Record<TipoRequisitoLegal, string> = {
  LEI: "Lei",
  NORMA: "Norma",
  PORTARIA: "Portaria",
  RESOLUCAO: "Resolução",
  OUTRO: "Outro",
};
export const TIPOS_REQUISITO = Object.keys(ROTULO_TIPO_REQUISITO) as TipoRequisitoLegal[];

export const ROTULO_ESFERA: Record<EsferaRequisito, string> = { FEDERAL: "Federal", ESTADUAL: "Estadual", MUNICIPAL: "Municipal" };
export const ESFERAS = Object.keys(ROTULO_ESFERA) as EsferaRequisito[];

export const ROTULO_TEMA: Record<TemaRequisito, string> = { QUALIDADE: "Qualidade", SSO: "Saúde e segurança", MEIO_AMBIENTE: "Meio ambiente" };
export const TEMAS = Object.keys(ROTULO_TEMA) as TemaRequisito[];

export const ROTULO_STATUS_REQUISITO: Record<StatusRequisitoLegal, string> = {
  ATENDE: "Atende",
  ATENDE_PARCIAL: "Atende parcialmente",
  NAO_ATENDE: "Não atende",
  NAO_APLICAVEL: "Não aplicável",
  EM_ANALISE: "Em análise",
};
export const STATUS_REQUISITO = Object.keys(ROTULO_STATUS_REQUISITO) as StatusRequisitoLegal[];

export const ROTULO_ACAO_REQUISITO: Record<AcaoHistoricoRequisito, string> = {
  CRIACAO: "Cadastro",
  ALTERACAO: "Alteração",
  VERIFICACAO: "Verificação de atendimento",
  REVISAO_GERAL: "Revisão geral",
  PLANO: "Plano de ação",
  EXCLUSAO: "Exclusão",
};

export const MAX_TEXTO_REQUISITO = 4000;

/** Não atende / atende parcialmente exigem plano de ação (ISO 14001 6.1.4 / 45001 6.1.4). */
export function statusExigePlano(s: StatusRequisitoLegal) {
  return s === "NAO_ATENDE" || s === "ATENDE_PARCIAL";
}

/** Lança se o status exige plano e não há plano vinculado nem primeira ação informada. */
export function exigirPlanoSeNecessario(s: StatusRequisitoLegal, temPlanoOuAcao: boolean) {
  if (statusExigePlano(s) && !temPlanoOuAcao) {
    throw new ErroNegocio(`"${ROTULO_STATUS_REQUISITO[s]}" exige plano de ação: informe a primeira ação ou gere o plano antes.`);
  }
}

/** Verificação vencida: data (YYYY-MM-DD) anterior a hoje. Não aplicável nunca vence. */
export function verificacaoVencida(proxima: string | null, hoje: string, status?: StatusRequisitoLegal) {
  if (status === "NAO_APLICAVEL") return false;
  return !!proxima && proxima < hoje;
}

/**
 * % de atendimento = atende / (atende + parcial + não atende). Não aplicável e em análise ficam fora.
 * null quando não há requisito avaliado.
 */
export function percentualAtendimento(status: readonly StatusRequisitoLegal[]): number | null {
  let atende = 0;
  let avaliados = 0;
  for (const s of status) {
    if (s === "NAO_APLICAVEL" || s === "EM_ANALISE") continue;
    avaliados++;
    if (s === "ATENDE") atende++;
  }
  return avaliados === 0 ? null : Math.round((atende / avaliados) * 100);
}

export function contarPorStatus(status: readonly StatusRequisitoLegal[]): Record<StatusRequisitoLegal, number> {
  const out: Record<StatusRequisitoLegal, number> = { ATENDE: 0, ATENDE_PARCIAL: 0, NAO_ATENDE: 0, NAO_APLICAVEL: 0, EM_ANALISE: 0 };
  for (const s of status) out[s]++;
  return out;
}

const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function tituloPlanoRequisito(r: { codigo: string; numero: string; titulo: string }) {
  return cortar(`Atendimento ${r.codigo} — ${r.numero}: ${r.titulo}`, 200);
}
