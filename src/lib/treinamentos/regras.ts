/**
 * Treinamentos e competências (P7) — regras puras: validade, status por pessoa × treinamento, obrigatoriedade e a
 * matriz de competências (ISO 9001 7.2, ISO 45001 7.2).
 */
import type { TipoTreinamento } from "@prisma/client";
import { somarDias } from "@/lib/datas";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";

export const ROTULO_TIPO_TREINAMENTO: Record<TipoTreinamento, string> = {
  INTEGRACAO: "Integração",
  NR: "Norma regulamentadora (NR)",
  RECICLAGEM: "Reciclagem",
  TECNICO: "Técnico",
  OUTRO: "Outro",
};
export const TIPOS_TREINAMENTO = Object.keys(ROTULO_TIPO_TREINAMENTO) as TipoTreinamento[];

/** Antecedência para "a vencer" (e para o alerta do cron). */
export const DIAS_A_VENCER = 30;

export type StatusCompetencia = "EM_DIA" | "A_VENCER" | "VENCIDO" | "NAO_REALIZADO";
export const ROTULO_STATUS_COMPETENCIA: Record<StatusCompetencia, string> = {
  EM_DIA: "Em dia",
  A_VENCER: "A vencer",
  VENCIDO: "Vencido",
  NAO_REALIZADO: "Não realizado",
};

/** Validade = data de realização + validadeMeses (YYYY-MM-DD). null = não vence. */
export function calcularValidade(dataRealizacao: string, validadeMeses: number | null | undefined): string | null {
  return validadeMeses ? calcularProximaReavaliacao(dataRealizacao, validadeMeses) : null;
}

/**
 * Status de uma competência a partir da última realização válida (presente):
 * sem realização → NAO_REALIZADO; sem validade → EM_DIA; validade < hoje → VENCIDO;
 * validade até hoje + `dias` → A_VENCER; senão EM_DIA. (Vence no próprio dia = ainda válido.)
 */
export function statusCompetencia(realizado: { dataValidade: string | null } | null, hoje: string, dias = DIAS_A_VENCER): StatusCompetencia {
  if (!realizado) return "NAO_REALIZADO";
  const v = realizado.dataValidade;
  if (!v) return "EM_DIA";
  if (v < hoje) return "VENCIDO";
  if (v <= somarDias(hoje, dias)) return "A_VENCER";
  return "EM_DIA";
}

export interface RegraObrigatoriedade {
  obrigatorioTodos: boolean;
  obrigatorioSetorIds: readonly string[];
}

/** Decisão: obrigatório para todos os usuários ativos OU para os setores listados (Usuario.setorId). */
export function ehObrigatorio(t: RegraObrigatoriedade, u: { setorId: string | null }): boolean {
  return t.obrigatorioTodos || (!!u.setorId && t.obrigatorioSetorIds.includes(u.setorId));
}

export interface ParticipacaoMatriz {
  usuarioId: string;
  treinamentoId: string;
  presente: boolean;
  /** YYYY-MM-DD */
  dataRealizacao: string;
  dataValidade: string | null;
}

/** Última realização (presente) por usuário×treinamento: maior data de realização; empate → maior validade. */
export function ultimasRealizacoes(ps: readonly ParticipacaoMatriz[]): Map<string, ParticipacaoMatriz> {
  const m = new Map<string, ParticipacaoMatriz>();
  for (const p of ps) {
    if (!p.presente) continue;
    const k = `${p.usuarioId}:${p.treinamentoId}`;
    const a = m.get(k);
    if (!a || p.dataRealizacao > a.dataRealizacao || (p.dataRealizacao === a.dataRealizacao && (p.dataValidade ?? "9999") > (a.dataValidade ?? "9999"))) m.set(k, p);
  }
  return m;
}

export interface CelulaMatriz {
  treinamentoId: string;
  obrigatorio: boolean;
  /** null = não obrigatório e nunca realizado (célula vazia na matriz). */
  status: StatusCompetencia | null;
  dataRealizacao: string | null;
  dataValidade: string | null;
}

export interface LinhaMatriz<U> {
  usuario: U;
  celulas: CelulaMatriz[];
}

/** Matriz usuário × treinamento com status por célula e o resumo (% em dia entre as obrigatórias). */
export function montarMatriz<U extends { id: string; setorId: string | null }, T extends RegraObrigatoriedade & { id: string }>(
  usuarios: readonly U[],
  treinamentos: readonly T[],
  participacoes: readonly ParticipacaoMatriz[],
  hoje: string,
  dias = DIAS_A_VENCER,
) {
  const ultimas = ultimasRealizacoes(participacoes);
  const linhas: LinhaMatriz<U>[] = usuarios.map((u) => ({
    usuario: u,
    celulas: treinamentos.map((t) => {
      const r = ultimas.get(`${u.id}:${t.id}`) ?? null;
      const obrigatorio = ehObrigatorio(t, u);
      return {
        treinamentoId: t.id,
        obrigatorio,
        status: r || obrigatorio ? statusCompetencia(r, hoje, dias) : null,
        dataRealizacao: r?.dataRealizacao ?? null,
        dataValidade: r?.dataValidade ?? null,
      };
    }),
  }));
  return { linhas, resumo: resumirMatriz(linhas.flatMap((l) => l.celulas)) };
}

/** % em dia = obrigatórias EM_DIA ou A_VENCER ÷ obrigatórias. Contagens de a vencer/vencidos consideram todas as células. */
export function resumirMatriz(celulas: readonly Pick<CelulaMatriz, "obrigatorio" | "status">[]) {
  const obrig = celulas.filter((c) => c.obrigatorio);
  const validas = obrig.filter((c) => c.status === "EM_DIA" || c.status === "A_VENCER").length;
  return {
    obrigatorias: obrig.length,
    emDia: validas,
    percentualEmDia: obrig.length ? Math.round((validas / obrig.length) * 100) : null,
    aVencer: celulas.filter((c) => c.status === "A_VENCER").length,
    vencidos: celulas.filter((c) => c.status === "VENCIDO").length,
    naoRealizados: obrig.filter((c) => c.status === "NAO_REALIZADO").length,
  };
}
