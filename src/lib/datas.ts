/** Utilitários de data sensíveis ao fuso horário da empresa. */

function partes(fuso: string, agora: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(agora).map((x) => [x.type, x.value]));
  return { ano: Number(p.year), mes: p.month, dia: p.day };
}

/** Data de hoje no fuso, no formato YYYY-MM-DD. */
export function hojeNoFuso(fuso: string, agora: Date = new Date()): string {
  const p = partes(fuso, agora);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

export function anoNoFuso(fuso: string, agora: Date = new Date()): number {
  return partes(fuso, agora).ano;
}

/** Colunas @db.Date chegam como meia-noite UTC: converte para YYYY-MM-DD sem deslocamento. */
export function dataIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD -> Date (meia-noite UTC), para gravar em colunas @db.Date. */
export function paraDataDb(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function formatarData(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const iso = typeof d === "string" ? d : dataIso(d);
  const [a, m, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

export function formatarDataHora(d: Date | null | undefined, fuso = "America/Sao_Paulo"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, dateStyle: "short", timeStyle: "short" }).format(d);
}

/** Soma dias a uma data YYYY-MM-DD. */
export function somarDias(iso: string, dias: number): string {
  const d = paraDataDb(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return dataIso(d);
}

/** Dia da semana de uma data civil YYYY-MM-DD (0 = domingo ... 6 = sábado), sem depender do fuso. */
function diaDaSemana(iso: string): number {
  return paraDataDb(iso).getUTCDay();
}

/** Garante que `iso` é uma data civil real YYYY-MM-DD; sem isso os laços de dias úteis poderiam não terminar. */
function exigirDataCivil(iso: string, nome: string): void {
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(iso) && dataIso(paraDataDb(iso)) === iso;
  if (!valida) throw new RangeError(`${nome} deve ser uma data válida no formato YYYY-MM-DD`);
}

/** Dia útil = não é sábado nem domingo e não consta em `feriados` (conjunto de YYYY-MM-DD). */
export function ehDiaUtil(iso: string, feriados: ReadonlySet<string> = new Set()): boolean {
  const d = diaDaSemana(iso);
  return d !== 0 && d !== 6 && !feriados.has(iso);
}

/**
 * Soma `n` dias úteis a uma data civil (YYYY-MM-DD). O dia de `inicio` não conta, mesmo que seja útil;
 * `n = 0` devolve `inicio`. Sábado, domingo e os `feriados` informados são pulados. Sem feriados
 * cadastrados vale só o fim de semana.
 *
 * O resultado é FIXADO por quem chama (ex.: `prazoEm` gravado na criação da atividade): cadastrar,
 * editar ou inativar um feriado depois NÃO recalcula prazos já gravados.
 * `inicio` deve vir de `hojeNoFuso(fusoDaEmpresa)` ou `dataIso`, nunca de `toISOString().slice(0,10)`.
 */
export function somarDiasUteis(inicio: string, n: number, feriados: ReadonlySet<string> = new Set()): string {
  exigirDataCivil(inicio, "inicio");
  if (!Number.isInteger(n) || n < 0) throw new RangeError("n deve ser um inteiro >= 0");
  let atual = inicio;
  let restam = n;
  while (restam > 0) {
    atual = somarDias(atual, 1);
    if (ehDiaUtil(atual, feriados)) restam--;
  }
  return atual;
}

/**
 * Quantidade de dias úteis a contar de `a` (exclusivo) até `b` (inclusivo), coerente com
 * `somarDiasUteis`: `somarDiasUteis(a, diasUteisEntre(a, b, f), f)` cai no último dia útil <= b.
 * Se `b <= a` devolve 0. Mesma regra: fim de semana e feriados não contam; sem feriados só o fim de semana.
 */
export function diasUteisEntre(a: string, b: string, feriados: ReadonlySet<string> = new Set()): number {
  exigirDataCivil(a, "a");
  exigirDataCivil(b, "b");
  let total = 0;
  let atual = a;
  while (atual < b) {
    atual = somarDias(atual, 1);
    if (ehDiaUtil(atual, feriados)) total++;
  }
  return total;
}
