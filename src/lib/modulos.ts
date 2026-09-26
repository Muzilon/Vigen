import type { Modulo } from "@prisma/client";
import { notFound } from "next/navigation";
import type { Contexto } from "@/lib/tenant";

/**
 * Gating por módulo contratado (Empresa.modulosAtivos). Um módulo desligado (ou nunca
 * ligado) para a empresa não deve aparecer no menu nem ser acessível por URL direta.
 */

export function temModulo(ctx: Pick<Contexto, "modulosAtivos">, modulo: Modulo): boolean {
  return ctx.modulosAtivos.includes(modulo);
}

/** Usado no topo de uma página/route: 404 se o módulo não estiver ativo para a empresa. */
export function exigirModulo(ctx: Pick<Contexto, "modulosAtivos">, modulo: Modulo): void {
  if (!temModulo(ctx, modulo)) notFound();
}

/** Rótulos em português para exibição (ex.: aba "Módulos" em Configurações). */
export const ROTULO_MODULO: Record<Modulo, string> = {
  RNC: "Não conformidades (RNC)",
  PLANO_ACAO: "Plano de ação",
  MAPA_PROCESSOS: "Mapa de processos",
  RISCOS_OPORTUNIDADES: "Riscos e oportunidades",
  SWOT: "SWOT",
  HIRA: "HIRA (perigos e riscos ocupacionais)",
  LAIA: "LAIA (aspectos e impactos ambientais)",
  INSPECOES: "Inspeções / checklists",
  AUDITORIAS: "Auditorias internas",
  DOCUMENTOS: "Documentos (tramitação e aprovação)",
  REQUISITOS_LEGAIS: "Requisitos legais",
  INCIDENTES: "Incidentes e acidentes",
  INDICADORES: "Indicadores",
  TREINAMENTOS: "Treinamentos e competências",
};

/** Agrupamento por área, para exibição na aba "Módulos" e no menu lateral. */
export const GRUPO_MODULO = {
  QUALIDADE: "Qualidade",
  SEGURANCA: "Segurança",
  MEIO_AMBIENTE: "Meio Ambiente",
  GESTAO: "Gestão",
} as const;
export type GrupoModulo = (typeof GRUPO_MODULO)[keyof typeof GRUPO_MODULO];

export const GRUPO_POR_MODULO: Record<Modulo, GrupoModulo> = {
  RNC: GRUPO_MODULO.QUALIDADE,
  PLANO_ACAO: GRUPO_MODULO.GESTAO,
  MAPA_PROCESSOS: GRUPO_MODULO.QUALIDADE,
  RISCOS_OPORTUNIDADES: GRUPO_MODULO.GESTAO,
  SWOT: GRUPO_MODULO.GESTAO,
  HIRA: GRUPO_MODULO.SEGURANCA,
  LAIA: GRUPO_MODULO.MEIO_AMBIENTE,
  INSPECOES: GRUPO_MODULO.QUALIDADE,
  AUDITORIAS: GRUPO_MODULO.QUALIDADE,
  DOCUMENTOS: GRUPO_MODULO.GESTAO,
  REQUISITOS_LEGAIS: GRUPO_MODULO.MEIO_AMBIENTE,
  INCIDENTES: GRUPO_MODULO.SEGURANCA,
  INDICADORES: GRUPO_MODULO.GESTAO,
  TREINAMENTOS: GRUPO_MODULO.GESTAO,
};

/** Todos os módulos, na ordem em que devem aparecer na aba "Módulos". */
export const TODOS_MODULOS = Object.keys(ROTULO_MODULO) as Modulo[];
