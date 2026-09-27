/**
 * Indicadores (P7) — regras puras: períodos por periodicidade, atingimento da meta e situação do indicador.
 * Formato do período: "2026" (anual), "2026-01" (mensal), "2026-T1" (trimestral), "2026-S1" (semestral).
 */
import type { DirecaoIndicador, FonteIndicador, PeriodicidadeIndicador } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const ROTULO_PERIODICIDADE: Record<PeriodicidadeIndicador, string> = {
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};
export const PERIODICIDADES = Object.keys(ROTULO_PERIODICIDADE) as PeriodicidadeIndicador[];

export const ROTULO_DIRECAO: Record<DirecaoIndicador, string> = {
  MAIOR_MELHOR: "Quanto maior, melhor",
  MENOR_MELHOR: "Quanto menor, melhor",
};
export const DIRECOES = Object.keys(ROTULO_DIRECAO) as DirecaoIndicador[];

export const ROTULO_FONTE: Record<FonteIndicador, string> = {
  MANUAL: "Manual (lançado pelo responsável)",
  RNC_EFICACIA_PRIMEIRA_VERIFICACAO: "Automático — % de RNCs eficazes na 1ª verificação",
  PLANO_ITENS_ATRASADOS: "Automático — % de itens de ação atrasados",
};
export const FONTES = Object.keys(ROTULO_FONTE) as FonteIndicador[];

/** Dias após o fim do período para lançar o resultado antes de o período contar como "sem lançamento" vencido. */
export const DIAS_PRAZO_LANCAMENTO = 15;

const MESES_POR: Record<PeriodicidadeIndicador, number> = { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };
const RE: Record<PeriodicidadeIndicador, RegExp> = {
  MENSAL: /^(\d{4})-(0[1-9]|1[0-2])$/,
  TRIMESTRAL: /^(\d{4})-T([1-4])$/,
  SEMESTRAL: /^(\d{4})-S([12])$/,
  ANUAL: /^(\d{4})$/,
};

/** Índice absoluto do período (ano*n + posição) para aritmética. */
function indice(periodo: string, p: PeriodicidadeIndicador): number {
  const m = RE[p].exec(periodo);
  if (!m) throw new ErroNegocio(`Período "${periodo}" inválido para periodicidade ${ROTULO_PERIODICIDADE[p].toLowerCase()}.`);
  const porAno = 12 / MESES_POR[p];
  const pos = p === "ANUAL" ? 0 : Number(m[2]) - 1;
  return Number(m[1]) * porAno + pos;
}

function deIndice(i: number, p: PeriodicidadeIndicador): string {
  const porAno = 12 / MESES_POR[p];
  const ano = Math.floor(i / porAno);
  const pos = (i % porAno) + 1;
  if (p === "ANUAL") return String(ano);
  if (p === "MENSAL") return `${ano}-${String(pos).padStart(2, "0")}`;
  return `${ano}-${p === "TRIMESTRAL" ? "T" : "S"}${pos}`;
}

export function periodoValido(periodo: string, p: PeriodicidadeIndicador): boolean {
  return RE[p].test(periodo);
}

/** Período que contém a data (YYYY-MM-DD). */
export function periodoDaData(dia: string, p: PeriodicidadeIndicador): string {
  const [ano, mes] = dia.split("-").map(Number);
  const pos = Math.floor((mes - 1) / MESES_POR[p]);
  return deIndice(ano * (12 / MESES_POR[p]) + pos, p);
}

export function somarPeriodos(periodo: string, p: PeriodicidadeIndicador, n: number): string {
  return deIndice(indice(periodo, p) + n, p);
}

/** Último período já encerrado em relação a hoje (o anterior ao período corrente). */
export function ultimoPeriodoFechado(hoje: string, p: PeriodicidadeIndicador): string {
  return somarPeriodos(periodoDaData(hoje, p), p, -1);
}

/** Os `n` últimos períodos terminando em `ate` (inclusive), em ordem cronológica. */
export function ultimosPeriodos(ate: string, p: PeriodicidadeIndicador, n: number): string[] {
  const fim = indice(ate, p);
  return Array.from({ length: n }, (_, k) => deIndice(fim - (n - 1) + k, p));
}

/** Primeiro e último dia (YYYY-MM-DD) do período. */
export function limitesPeriodo(periodo: string, p: PeriodicidadeIndicador): { inicio: string; fim: string } {
  const i = indice(periodo, p);
  const meses = MESES_POR[p];
  const porAno = 12 / meses;
  const ano = Math.floor(i / porAno);
  const mesIni = (i % porAno) * meses + 1;
  const mesFim = mesIni + meses - 1;
  const ultimo = new Date(Date.UTC(ano, mesFim, 0)).getUTCDate();
  return { inicio: `${ano}-${String(mesIni).padStart(2, "0")}-01`, fim: `${ano}-${String(mesFim).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}` };
}

/** Rótulo curto: "jan/26", "1º tri/26", "1º sem/26", "2026". */
export function rotuloPeriodo(periodo: string): string {
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [ano, parte] = periodo.split("-");
  if (!parte) return ano;
  const aa = ano.slice(2);
  if (parte.startsWith("T")) return `${parte.slice(1)}º tri/${aa}`;
  if (parte.startsWith("S")) return `${parte.slice(1)}º sem/${aa}`;
  return `${MESES[Number(parte) - 1]}/${aa}`;
}

/** Não aceita lançamento para período que ainda não começou. */
export function validarPeriodoLancamento(periodo: string, p: PeriodicidadeIndicador, hoje: string) {
  if (indice(periodo, p) > indice(periodoDaData(hoje, p), p)) throw new ErroNegocio("Não é possível lançar resultado de um período futuro.");
}

/** Meta atingida: MAIOR_MELHOR → valor ≥ meta; MENOR_MELHOR → valor ≤ meta. */
export function atingido(valor: number, meta: number, direcao: DirecaoIndicador): boolean {
  return direcao === "MAIOR_MELHOR" ? valor >= meta : valor <= meta;
}

export type SituacaoIndicador = "ATINGIDO" | "NAO_ATINGIDO" | "SEM_LANCAMENTO";
export const ROTULO_SITUACAO: Record<SituacaoIndicador, string> = {
  ATINGIDO: "Meta atingida",
  NAO_ATINGIDO: "Meta não atingida",
  SEM_LANCAMENTO: "Sem lançamento",
};

export interface ResultadoLancado {
  periodo: string;
  valor: number;
  meta: number;
  direcao: DirecaoIndicador;
  criadoEm: Date;
}

/** Resultado vigente de cada período = o lançamento mais recente (correções são novos lançamentos). */
export function vigentesPorPeriodo<T extends Pick<ResultadoLancado, "periodo" | "criadoEm">>(resultados: readonly T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of resultados) {
    const atual = m.get(r.periodo);
    if (!atual || r.criadoEm.getTime() >= atual.criadoEm.getTime()) m.set(r.periodo, r);
  }
  return m;
}

/**
 * Situação do indicador no período de referência (último fechado): atingido/não atingido pelo resultado vigente
 * (comparado à meta gravada no lançamento) ou "sem lançamento".
 */
export function situacaoNoPeriodo(resultados: readonly ResultadoLancado[], periodo: string): { situacao: SituacaoIndicador; resultado: ResultadoLancado | null } {
  const r = vigentesPorPeriodo(resultados).get(periodo) ?? null;
  if (!r) return { situacao: "SEM_LANCAMENTO", resultado: null };
  return { situacao: atingido(r.valor, r.meta, r.direcao) ? "ATINGIDO" : "NAO_ATINGIDO", resultado: r };
}

/** Formata número em pt-BR com até 2 casas + unidade ("%" colado, demais com espaço). */
export function formatarValor(v: number | null | undefined, unidade: string): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const n = v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unidade === "%" ? `${n}%` : `${n} ${unidade}`;
}
