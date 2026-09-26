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
