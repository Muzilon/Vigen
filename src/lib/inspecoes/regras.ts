/**
 * Inspeções / checklists (P5) — regras puras (sem banco): validação e classificação de respostas,
 * % de conformidade, pendências para concluir e textos da RNC gerada a partir de uma resposta.
 */
import type { StatusInspecao, TipoChecklist, TipoRespostaChecklist, TipoRnc, ValorRespostaInspecao } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const ROTULO_TIPO_CHECKLIST: Record<TipoChecklist, string> = {
  QUALIDADE: "Qualidade",
  SSO: "Segurança (SSO)",
  MEIO_AMBIENTE: "Meio ambiente",
  GERAL: "Geral",
};
export const TIPOS_CHECKLIST = Object.keys(ROTULO_TIPO_CHECKLIST) as TipoChecklist[];

export const ROTULO_TIPO_RESPOSTA: Record<TipoRespostaChecklist, string> = {
  CONFORME_NAO_CONFORME_NA: "Conforme / Não conforme / N.A.",
  SIM_NAO: "Sim / Não",
  NOTA_1A5: "Nota de 1 a 5",
  TEXTO: "Texto livre",
};
export const TIPOS_RESPOSTA = Object.keys(ROTULO_TIPO_RESPOSTA) as TipoRespostaChecklist[];

export const ROTULO_VALOR: Record<ValorRespostaInspecao, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  NAO_APLICAVEL: "N.A.",
  SIM: "Sim",
  NAO: "Não",
};

export const ROTULO_STATUS_INSPECAO: Record<StatusInspecao, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};
export const STATUS_INSPECAO = Object.keys(ROTULO_STATUS_INSPECAO) as StatusInspecao[];

/** Opções de resposta por tipo (NOTA_1A5 e TEXTO não usam o enum). */
export const OPCOES_POR_TIPO: Record<TipoRespostaChecklist, ValorRespostaInspecao[]> = {
  CONFORME_NAO_CONFORME_NA: ["CONFORME", "NAO_CONFORME", "NAO_APLICAVEL"],
  SIM_NAO: ["SIM", "NAO"],
  NOTA_1A5: [],
  TEXTO: [],
};

export interface RespostaAvaliavel {
  tipoResposta: TipoRespostaChecklist;
  resposta: ValorRespostaInspecao | null;
  nota: number | null;
  texto: string | null;
}

export type Classificacao = "CONFORME" | "NAO_CONFORME" | "NAO_APLICAVEL" | "INFORMATIVA" | "PENDENTE";

/**
 * Classifica uma resposta: SIM = conforme e NÃO = não conforme (pergunta no positivo); nota abaixo
 * de `notaMinima` = não conforme; TEXTO é informativa (fora do %).
 */
export function classificar(r: RespostaAvaliavel, notaMinima: number): Classificacao {
  switch (r.tipoResposta) {
    case "CONFORME_NAO_CONFORME_NA":
      if (r.resposta === "CONFORME") return "CONFORME";
      if (r.resposta === "NAO_CONFORME") return "NAO_CONFORME";
      if (r.resposta === "NAO_APLICAVEL") return "NAO_APLICAVEL";
      return "PENDENTE";
    case "SIM_NAO":
      if (r.resposta === "SIM") return "CONFORME";
      if (r.resposta === "NAO") return "NAO_CONFORME";
      return "PENDENTE";
    case "NOTA_1A5":
      if (r.nota === null) return "PENDENTE";
      return r.nota < notaMinima ? "NAO_CONFORME" : "CONFORME";
    case "TEXTO":
      return "INFORMATIVA";
  }
}

export const ehNaoConforme = (r: RespostaAvaliavel, notaMinima: number) => classificar(r, notaMinima) === "NAO_CONFORME";

/** % de conformidade = conformes / (conformes + não conformes), arredondado; null se nenhum item avaliável. */
export function percentualConformidade(rs: readonly RespostaAvaliavel[], notaMinima: number): number | null {
  let c = 0;
  let nc = 0;
  for (const r of rs) {
    const k = classificar(r, notaMinima);
    if (k === "CONFORME") c++;
    else if (k === "NAO_CONFORME") nc++;
  }
  return c + nc === 0 ? null : Math.round((c / (c + nc)) * 100);
}

export interface ContagemInspecao {
  total: number;
  respondidas: number;
  conformes: number;
  naoConformes: number;
  naoAplicaveis: number;
}

export function contarRespostas(rs: readonly RespostaAvaliavel[], notaMinima: number): ContagemInspecao {
  const out: ContagemInspecao = { total: rs.length, respondidas: 0, conformes: 0, naoConformes: 0, naoAplicaveis: 0 };
  for (const r of rs) {
    const k = classificar(r, notaMinima);
    if (k !== "PENDENTE" && !(k === "INFORMATIVA" && !r.texto)) out.respondidas++;
    if (k === "CONFORME") out.conformes++;
    else if (k === "NAO_CONFORME") out.naoConformes++;
    else if (k === "NAO_APLICAVEL") out.naoAplicaveis++;
  }
  return out;
}

/** Entrada crua da tela → valores gravados, validados pelo tipo do item. */
export function normalizarResposta(
  tipo: TipoRespostaChecklist,
  d: { resposta?: string | null; nota?: number | string | null; texto?: string | null; comentario?: string | null },
): { resposta: ValorRespostaInspecao | null; nota: number | null; texto: string | null; comentario: string | null } {
  const comentario = d.comentario?.trim() || null;
  if (comentario && comentario.length > 4000) throw new ErroNegocio("Comentário excede 4000 caracteres.");
  if (tipo === "NOTA_1A5") {
    const n = d.nota === "" || d.nota === null || d.nota === undefined ? NaN : Number(d.nota);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new ErroNegocio("Informe uma nota de 1 a 5.");
    return { resposta: null, nota: n, texto: null, comentario };
  }
  if (tipo === "TEXTO") {
    const texto = d.texto?.trim() || null;
    if (!texto) throw new ErroNegocio("Escreva a resposta.");
    if (texto.length > 4000) throw new ErroNegocio("Resposta excede 4000 caracteres.");
    return { resposta: null, nota: null, texto, comentario };
  }
  const v = d.resposta as ValorRespostaInspecao | undefined;
  if (!v || !OPCOES_POR_TIPO[tipo].includes(v)) throw new ErroNegocio("Escolha uma resposta válida.");
  return { resposta: v, nota: null, texto: null, comentario };
}

/**
 * Pendências para concluir: toda pergunta respondida (texto livre é opcional) e foto em cada não
 * conformidade de item com foto obrigatória.
 */
export function pendenciasConclusao(
  rs: readonly (RespostaAvaliavel & { ordem: number; obrigatorioFoto: boolean; fotos: number })[],
  notaMinima: number,
): string[] {
  const out: string[] = [];
  const semResposta = rs.filter((r) => classificar(r, notaMinima) === "PENDENTE").map((r) => r.ordem);
  if (semResposta.length) out.push(`Responda a(s) pergunta(s) ${semResposta.join(", ")}.`);
  const semFoto = rs.filter((r) => r.obrigatorioFoto && r.fotos === 0 && classificar(r, notaMinima) === "NAO_CONFORME").map((r) => r.ordem);
  if (semFoto.length) out.push(`Anexe foto da não conformidade na(s) pergunta(s) ${semFoto.join(", ")}.`);
  return out;
}

/** Tipo sugerido da RNC a partir do tipo do checklist. */
export function tipoRncDoChecklist(t: TipoChecklist): TipoRnc {
  return t === "SSO" ? "SSO" : t === "MEIO_AMBIENTE" ? "MEIO_AMBIENTE" : "QUALIDADE";
}

/** Texto da resposta para exibição/descrição da RNC. */
export function textoResposta(r: RespostaAvaliavel): string {
  if (r.tipoResposta === "NOTA_1A5") return r.nota === null ? "—" : `Nota ${r.nota}`;
  if (r.tipoResposta === "TEXTO") return r.texto ?? "—";
  return r.resposta ? ROTULO_VALOR[r.resposta] : "—";
}

const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function tituloRncDaResposta(pergunta: string): string {
  return cortar(`Inspeção: ${pergunta}`, 200);
}

export function descricaoRncDaResposta(i: {
  codigo: string;
  modelo: string;
  data: string;
  inspetor: string;
  obra: string;
  pergunta: string;
  resposta: string;
  comentario: string | null;
}): string {
  return [
    `Não conformidade identificada na inspeção ${i.codigo} (${i.modelo}), em ${i.data}, por ${i.inspetor} — ${i.obra}.`,
    `Pergunta: ${i.pergunta}`,
    `Resposta: ${i.resposta}`,
    i.comentario ? `Comentário do inspetor: ${i.comentario}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Nova ordem ao mover `id` uma posição para cima/baixo (lista já ordenada). */
export function moverNaLista<T extends { id: string }>(lista: readonly T[], id: string, direcao: "cima" | "baixo"): T[] {
  const i = lista.findIndex((x) => x.id === id);
  if (i < 0) throw new ErroNegocio("Item não encontrado.");
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (j < 0 || j >= lista.length) return [...lista];
  const out = [...lista];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
