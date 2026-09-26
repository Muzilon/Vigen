/** Tipos puros da escala configurável (Riscos/Oportunidades, HIRA, Aspecto/Impacto). */

export type NivelFaixa = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";

/** Token de cor reaproveitando as variáveis --cor-gravidade-* do base.css. */
export type CorFaixa = "baixa" | "media" | "alta" | "critica";

export interface NivelEixo {
  valor: number;
  rotulo: string;
}

export interface Eixo {
  chave: string;
  rotulo: string;
  /** Peso multiplicador do eixo no score (padrão 1). */
  peso?: number;
  niveis: NivelEixo[];
}

export interface Faixa {
  /** Score máximo (inclusive) para esta faixa. As faixas devem estar em ordem crescente de limite. */
  limite: number;
  nivel: NivelFaixa;
  cor: CorFaixa;
}

/** Critério extra opcional (ex.: significância do aspecto/impacto ambiental no LAIA). */
export interface CriterioExtra {
  chave: string;
  rotulo: string;
  /** Se a resposta "verdadeira" a este critério eleva o nível mínimo (ex.: para CRITICO). */
  elevaPara?: NivelFaixa;
}

export interface ConfigEscala {
  tamanho: 3 | 5;
  eixos: Eixo[];
  faixas: Faixa[];
  criteriosExtras?: CriterioExtra[];
}

/** Uma linha de ConfiguracaoEscala (banco), usada pelo resolvedor. */
export interface ConfiguracaoEscalaRegistro {
  tipo: "RISCO_OPORTUNIDADE" | "HIRA" | "ASPECTO_IMPACTO";
  obraId: string | null;
  tamanho: number;
  eixos: unknown;
  faixas: unknown;
  criteriosExtras?: unknown;
}
