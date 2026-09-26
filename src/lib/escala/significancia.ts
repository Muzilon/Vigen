import type { NivelFaixa } from "@/lib/escala/tipos";

const ORDEM: Record<NivelFaixa, number> = { BAIXO: 0, MEDIO: 1, ALTO: 2, CRITICO: 3 };

/** true se `a` for um nível igual ou mais grave que `b`. */
function elevado(a: NivelFaixa, b: NivelFaixa) {
  return ORDEM[a] >= ORDEM[b];
}

export interface AvaliacaoCriteriosExtras {
  nivelBase: NivelFaixa;
  /** Chaves dos criteriosExtras marcadas como verdadeiras para este registro. */
  criteriosAtendidos: readonly { chave: string; elevaPara?: NivelFaixa }[];
}

/**
 * Aplica os critérios extras (ex.: significância do aspecto/impacto no LAIA) sobre o nível
 * calculado por P×S: o nível final é o mais grave entre o nível base e o maior "elevaPara"
 * dos critérios atendidos.
 */
export function nivelComCriteriosExtras({ nivelBase, criteriosAtendidos }: AvaliacaoCriteriosExtras): NivelFaixa {
  let nivel = nivelBase;
  for (const c of criteriosAtendidos) {
    if (c.elevaPara && elevado(c.elevaPara, nivel)) nivel = c.elevaPara;
  }
  return nivel;
}

/** Significativo (LAIA) = nível final ALTO ou CRITICO. */
export function ehSignificativo(nivelFinal: NivelFaixa): boolean {
  return ORDEM[nivelFinal] >= ORDEM.ALTO;
}
