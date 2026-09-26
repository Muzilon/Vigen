/** Regras puras da SWOT e partes interessadas (ISO 9001 4.1/4.2). Testadas em tests/swot.test.ts. */
import type { QuadranteSwot, TipoRiscoOportunidade } from "@prisma/client";
import type { CorFaixa } from "@/lib/escala/tipos";
import { ErroNegocio } from "@/lib/erros";

export const QUADRANTES: readonly QuadranteSwot[] = ["FORCA", "FRAQUEZA", "OPORTUNIDADE", "AMEACA"];

export const ROTULO_QUADRANTE: Record<QuadranteSwot, string> = {
  FORCA: "Forças",
  FRAQUEZA: "Fraquezas",
  OPORTUNIDADE: "Oportunidades",
  AMEACA: "Ameaças",
};

export const AMBIENTE_QUADRANTE: Record<QuadranteSwot, "Interno" | "Externo"> = {
  FORCA: "Interno",
  FRAQUEZA: "Interno",
  OPORTUNIDADE: "Externo",
  AMEACA: "Externo",
};

/** Fraqueza/ameaça → RISCO; força/oportunidade → OPORTUNIDADE. */
export function tipoRiscoDoQuadrante(q: QuadranteSwot): TipoRiscoOportunidade {
  return q === "FRAQUEZA" || q === "AMEACA" ? "RISCO" : "OPORTUNIDADE";
}

export const MAX_DESCRICAO = 1000;

export function validarEscala15(v: number, campo: string) {
  if (!Number.isInteger(v) || v < 1 || v > 5) throw new ErroNegocio(`${campo} deve ser de 1 a 5.`);
  return v;
}

export function normalizarItem(d: { quadrante: QuadranteSwot; descricao: string; relevancia: number }) {
  if (!QUADRANTES.includes(d.quadrante)) throw new ErroNegocio("Quadrante inválido.");
  const descricao = d.descricao.trim();
  if (descricao.length < 2) throw new ErroNegocio("Descreva o item.");
  if (descricao.length > MAX_DESCRICAO) throw new ErroNegocio(`Item com no máximo ${MAX_DESCRICAO} caracteres.`);
  return { quadrante: d.quadrante, descricao, relevancia: validarEscala15(d.relevancia, "Relevância") };
}

export function normalizarParte(d: { nome: string; necessidades?: string | null; expectativas?: string | null; influencia: number; interesse: number }) {
  const nome = d.nome.trim();
  if (nome.length < 2) throw new ErroNegocio("Informe o nome da parte interessada.");
  if (nome.length > 150) throw new ErroNegocio("Nome com no máximo 150 caracteres.");
  const t = (v?: string | null) => {
    const x = v?.trim() || null;
    if (x && x.length > 2000) throw new ErroNegocio("Texto com no máximo 2000 caracteres.");
    return x;
  };
  return {
    nome,
    necessidades: t(d.necessidades),
    expectativas: t(d.expectativas),
    influencia: validarEscala15(d.influencia, "Influência"),
    interesse: validarEscala15(d.interesse, "Interesse"),
  };
}

export function normalizarCiclo(d: { ano: number; titulo?: string | null }) {
  if (!Number.isInteger(d.ano) || d.ano < 2000 || d.ano > 2100) throw new ErroNegocio("Ano inválido.");
  const titulo = d.titulo?.trim() || `Análise de contexto ${d.ano}`;
  if (titulo.length > 150) throw new ErroNegocio("Título com no máximo 150 caracteres.");
  return { ano: d.ano, titulo };
}

/** Itens do quadrante por relevância (maior primeiro), depois pela ordem de criação. */
export function ordenarPorRelevancia<T extends { relevancia: number; criadoEm: Date }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => b.relevancia - a.relevancia || a.criadoEm.getTime() - b.criadoEm.getTime());
}

/**
 * Quadrante da matriz de partes interessadas (influência × interesse):
 * alta/alta = gerenciar de perto; alta influência = manter satisfeita; alto interesse = manter
 * informada; baixa/baixa = monitorar. "Alto" = 4 ou 5.
 */
export type EstrategiaParte = "GERENCIAR_DE_PERTO" | "MANTER_SATISFEITA" | "MANTER_INFORMADA" | "MONITORAR";
export const ROTULO_ESTRATEGIA: Record<EstrategiaParte, string> = {
  GERENCIAR_DE_PERTO: "Gerenciar de perto",
  MANTER_SATISFEITA: "Manter satisfeita",
  MANTER_INFORMADA: "Manter informada",
  MONITORAR: "Monitorar",
};

export function estrategiaParte(influencia: number, interesse: number): EstrategiaParte {
  const inf = influencia >= 4;
  const int = interesse >= 4;
  if (inf && int) return "GERENCIAR_DE_PERTO";
  if (inf) return "MANTER_SATISFEITA";
  if (int) return "MANTER_INFORMADA";
  return "MONITORAR";
}

/** Cor da célula da matriz pelo produto influência × interesse (mesmos tokens do heatmap). */
export function corParte(influencia: number, interesse: number): CorFaixa {
  const s = influencia * interesse;
  if (s <= 4) return "baixa";
  if (s <= 9) return "media";
  if (s <= 16) return "alta";
  return "critica";
}

/** Células 5×5 (linha = influência, coluna = interesse) com contagem. */
export function celulasPartes(partes: readonly { influencia: number; interesse: number }[]) {
  const out: { linha: number; coluna: number; contagem: number; cor: CorFaixa }[] = [];
  for (let inf = 1; inf <= 5; inf++) {
    for (let int = 1; int <= 5; int++) {
      out.push({ linha: inf, coluna: int, contagem: partes.filter((p) => p.influencia === inf && p.interesse === int).length, cor: corParte(inf, int) });
    }
  }
  return out;
}
