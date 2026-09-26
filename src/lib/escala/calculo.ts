import type { ConfigEscala, Faixa, NivelFaixa } from "@/lib/escala/tipos";

export class ErroEscala extends Error {}

/** Score = produto dos valores dos eixos (cada um multiplicado pelo peso, padrão 1). */
export function calcularScore(config: ConfigEscala, valoresEixos: Record<string, number>): number {
  let score = 1;
  for (const eixo of config.eixos) {
    const valor = valoresEixos[eixo.chave];
    if (valor === undefined) throw new ErroEscala(`Falta o valor do eixo "${eixo.chave}".`);
    const niveisValidos = eixo.niveis.map((n) => n.valor);
    if (!niveisValidos.includes(valor)) {
      throw new ErroEscala(`Valor inválido para o eixo "${eixo.chave}": ${valor}.`);
    }
    score *= valor * (eixo.peso ?? 1);
  }
  return score;
}

/** Encontra a faixa (nível + cor) para um score, pela primeira faixa cujo limite ≥ score. */
export function faixaParaScore(config: ConfigEscala, score: number): Faixa {
  const ordenadas = [...config.faixas].sort((a, b) => a.limite - b.limite);
  const faixa = ordenadas.find((f) => score <= f.limite);
  if (!faixa) {
    if (ordenadas.length === 0) throw new ErroEscala("A configuração de escala não tem faixas definidas.");
    return ordenadas[ordenadas.length - 1];
  }
  return faixa;
}

export interface ResultadoCalculo {
  score: number;
  nivel: NivelFaixa;
  cor: Faixa["cor"];
}

/** Calcula score e nível (P×S) a partir dos valores de cada eixo. */
export function calcularNivel(config: ConfigEscala, valoresEixos: Record<string, number>): ResultadoCalculo {
  const score = calcularScore(config, valoresEixos);
  const faixa = faixaParaScore(config, score);
  return { score, nivel: faixa.nivel, cor: faixa.cor };
}
