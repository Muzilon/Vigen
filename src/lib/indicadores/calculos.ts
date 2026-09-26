/** Cálculos puros dos indicadores do módulo RNC (sem acesso a banco; testáveis). */
import type { Gravidade, StatusItemAcao, StatusRnc, TipoRnc } from "@prisma/client";
import { hojeNoFuso, somarDias } from "@/lib/datas";
import { statusEfetivoItem, type StatusEfetivoItem } from "@/lib/plano-acao/status";

export interface RncIndicador {
  id: string;
  tipo: TipoRnc;
  gravidade: Gravidade;
  status: StatusRnc;
  obraId: string;
  obraNome: string;
  dataAbertura: Date;
  encerradoEm: Date | null;
  canceladoEm: Date | null;
  /** Resultado da 1ª verificação de eficácia, se houver. */
  primeiraVerificacao: { eficaz: boolean; verificadoEm: Date } | null;
}

export interface ItemIndicador {
  status: StatusItemAcao;
  quando: Date;
  quemId: string;
  quemNome: string;
}

export interface Periodo {
  /** YYYY-MM-DD inclusivo, no fuso da empresa. */
  inicio: string;
  fim: string;
}

export interface Contagem {
  chave: string;
  rotulo: string;
  valor: number;
}

export interface Indicadores {
  kpis: {
    abertas: number;
    encerradasPeriodo: number;
    canceladasPeriodo: number;
    itensAtrasados: number;
    tempoMedioFechamentoDias: number | null;
    eficaciaPrimeiraVerificacaoPct: number | null;
  };
  porMes: { mes: string; abertas: number; encerradas: number }[];
  porTipo: Contagem[];
  porObra: Contagem[];
  porGravidade: Contagem[];
  itensPorStatus: Contagem[];
  topAtrasados: Contagem[];
}

const DIA_MS = 86_400_000;
const FINAIS: StatusRnc[] = ["ENCERRADO", "CANCELADO"];

/** Dia (YYYY-MM-DD) de um instante no fuso. */
export const diaNoFuso = (d: Date, fuso: string) => hojeNoFuso(fuso, d);

/** Período padrão: do 1º dia do mês de 11 meses atrás até hoje (12 meses corridos). */
export function periodoPadrao(hoje: string): Periodo {
  const [a, m] = hoje.split("-").map(Number);
  const total = a * 12 + (m - 1) - 11;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return { inicio: `${ano}-${String(mes).padStart(2, "0")}-01`, fim: hoje };
}

/** Meses YYYY-MM entre inicio e fim (inclusive). */
export function mesesDoPeriodo(p: Periodo): string[] {
  const out: string[] = [];
  let [a, m] = p.inicio.split("-").map(Number);
  const [af, mf] = p.fim.split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; a++; }
    if (out.length > 120) break;
  }
  return out;
}

const noPeriodo = (dia: string, p: Periodo) => dia >= p.inicio && dia <= p.fim;

function contar<T>(lista: readonly T[], chave: (x: T) => string, rotulo: (k: string, x: T) => string, ordem?: readonly string[]): Contagem[] {
  const mapa = new Map<string, Contagem>();
  for (const x of lista) {
    const k = chave(x);
    const c = mapa.get(k) ?? { chave: k, rotulo: rotulo(k, x), valor: 0 };
    c.valor++;
    mapa.set(k, c);
  }
  const res = [...mapa.values()];
  if (ordem) return ordem.map((k) => mapa.get(k)).filter((c): c is Contagem => !!c);
  return res.sort((x, y) => y.valor - x.valor || x.rotulo.localeCompare(y.rotulo));
}

export const ORDEM_TIPO: TipoRnc[] = ["QUALIDADE", "MEIO_AMBIENTE", "SSO"];
export const ORDEM_GRAVIDADE: Gravidade[] = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
export const ORDEM_STATUS_ITEM: StatusEfetivoItem[] = ["PENDENTE", "EM_ANDAMENTO", "ATRASADO", "CONCLUIDO", "CANCELADO"];

export function calcularIndicadores(args: {
  rncs: readonly RncIndicador[];
  itens: readonly ItemIndicador[];
  periodo: Periodo;
  fuso: string;
  hoje: string;
  rotulos?: { tipo?: Record<string, string>; gravidade?: Record<string, string>; statusItem?: Record<string, string> };
  topN?: number;
}): Indicadores {
  const { rncs, itens, periodo, fuso, hoje, rotulos = {}, topN = 5 } = args;
  const rot = (m: Record<string, string> | undefined) => (k: string) => m?.[k] ?? k;

  const abertasNoPeriodo = rncs.filter((r) => noPeriodo(diaNoFuso(r.dataAbertura, fuso), periodo));
  const encerradas = rncs.filter((r) => r.status === "ENCERRADO" && r.encerradoEm && noPeriodo(diaNoFuso(r.encerradoEm, fuso), periodo));
  const canceladas = rncs.filter((r) => r.status === "CANCELADO" && r.canceladoEm && noPeriodo(diaNoFuso(r.canceladoEm, fuso), periodo));

  const tempos = encerradas.map((r) => (r.encerradoEm!.getTime() - r.dataAbertura.getTime()) / DIA_MS);
  const tempoMedio = tempos.length ? Math.round((tempos.reduce((s, t) => s + t, 0) / tempos.length) * 10) / 10 : null;

  const verif = rncs.filter((r) => r.primeiraVerificacao && noPeriodo(diaNoFuso(r.primeiraVerificacao.verificadoEm, fuso), periodo));
  const eficazes = verif.filter((r) => r.primeiraVerificacao!.eficaz).length;
  const eficaciaPct = verif.length ? Math.round((eficazes / verif.length) * 1000) / 10 : null;

  const meses = mesesDoPeriodo(periodo);
  const porMesMapa = new Map(meses.map((m) => [m, { mes: m, abertas: 0, encerradas: 0 }]));
  for (const r of abertasNoPeriodo) porMesMapa.get(diaNoFuso(r.dataAbertura, fuso).slice(0, 7))!.abertas++;
  for (const r of encerradas) porMesMapa.get(diaNoFuso(r.encerradoEm!, fuso).slice(0, 7))!.encerradas++;

  const itensEf = itens.map((i) => ({ ...i, ef: statusEfetivoItem(i, hoje) }));
  const atrasados = itensEf.filter((i) => i.ef === "ATRASADO");

  return {
    kpis: {
      abertas: rncs.filter((r) => !FINAIS.includes(r.status)).length,
      encerradasPeriodo: encerradas.length,
      canceladasPeriodo: canceladas.length,
      itensAtrasados: atrasados.length,
      tempoMedioFechamentoDias: tempoMedio,
      eficaciaPrimeiraVerificacaoPct: eficaciaPct,
    },
    porMes: [...porMesMapa.values()],
    porTipo: contar(abertasNoPeriodo, (r) => r.tipo, rot(rotulos.tipo), ORDEM_TIPO),
    porObra: contar(abertasNoPeriodo, (r) => r.obraId, (_k, r) => r.obraNome),
    porGravidade: contar(abertasNoPeriodo, (r) => r.gravidade, rot(rotulos.gravidade), ORDEM_GRAVIDADE),
    itensPorStatus: contar(itensEf, (i) => i.ef, rot(rotulos.statusItem), ORDEM_STATUS_ITEM),
    topAtrasados: contar(atrasados, (i) => i.quemId, (_k, i) => i.quemNome).slice(0, topN),
  };
}

/** Converte período (dias no fuso) em limites UTC aproximados para pré-filtrar no banco (folga de 1 dia). */
export function limitesUtc(p: Periodo): { desde: Date; ate: Date } {
  return { desde: new Date(`${somarDias(p.inicio, -1)}T00:00:00Z`), ate: new Date(`${somarDias(p.fim, 2)}T00:00:00Z`) };
}
