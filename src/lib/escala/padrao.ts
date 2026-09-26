import type { ConfigEscala } from "@/lib/escala/tipos";

/**
 * Configurações padrão do sistema (fallback em código quando a empresa não tem
 * ConfiguracaoEscala cadastrada para o tipo). Usadas pelo resolvedor como último nível
 * de resolução: obra (override) → empresa (padrão) → padrão do sistema (aqui).
 */

const FAIXAS_5X5: ConfigEscala["faixas"] = [
  { limite: 4, nivel: "BAIXO", cor: "baixa" },
  { limite: 9, nivel: "MEDIO", cor: "media" },
  { limite: 16, nivel: "ALTO", cor: "alta" },
  { limite: 25, nivel: "CRITICO", cor: "critica" },
];

export const FAIXAS_3X3: ConfigEscala["faixas"] = [
  { limite: 2, nivel: "BAIXO", cor: "baixa" },
  { limite: 4, nivel: "MEDIO", cor: "media" },
  { limite: 6, nivel: "ALTO", cor: "alta" },
  { limite: 9, nivel: "CRITICO", cor: "critica" },
];

const NIVEIS_5 = [
  { valor: 1, rotulo: "Muito baixa" },
  { valor: 2, rotulo: "Baixa" },
  { valor: 3, rotulo: "Média" },
  { valor: 4, rotulo: "Alta" },
  { valor: 5, rotulo: "Muito alta" },
];

export const NIVEIS_3 = [
  { valor: 1, rotulo: "Baixa" },
  { valor: 2, rotulo: "Média" },
  { valor: 3, rotulo: "Alta" },
];

export const PADRAO_RISCO_OPORTUNIDADE: ConfigEscala = {
  tamanho: 5,
  eixos: [
    { chave: "probabilidade", rotulo: "Probabilidade", niveis: NIVEIS_5 },
    { chave: "impacto", rotulo: "Impacto", niveis: NIVEIS_5 },
  ],
  faixas: FAIXAS_5X5,
};

export const PADRAO_HIRA: ConfigEscala = {
  tamanho: 5,
  eixos: [
    { chave: "probabilidade", rotulo: "Probabilidade", niveis: NIVEIS_5 },
    { chave: "severidade", rotulo: "Severidade", niveis: NIVEIS_5 },
  ],
  faixas: FAIXAS_5X5,
};

/** LAIA: severidade × frequência × abrangência (1–3 cada, score 1–27). */
const FAIXAS_LAIA: ConfigEscala["faixas"] = [
  { limite: 4, nivel: "BAIXO", cor: "baixa" },
  { limite: 12, nivel: "MEDIO", cor: "media" },
  { limite: 18, nivel: "ALTO", cor: "alta" },
  { limite: 27, nivel: "CRITICO", cor: "critica" },
];

export const PADRAO_ASPECTO_IMPACTO: ConfigEscala = {
  tamanho: 3,
  eixos: [
    { chave: "severidade", rotulo: "Severidade", niveis: [{ valor: 1, rotulo: "Baixa" }, { valor: 2, rotulo: "Média" }, { valor: 3, rotulo: "Alta" }] },
    { chave: "frequencia", rotulo: "Frequência", niveis: [{ valor: 1, rotulo: "Rara" }, { valor: 2, rotulo: "Ocasional" }, { valor: 3, rotulo: "Contínua" }] },
    { chave: "abrangencia", rotulo: "Abrangência", niveis: [{ valor: 1, rotulo: "Local" }, { valor: 2, rotulo: "Canteiro" }, { valor: 3, rotulo: "Externa" }] },
  ],
  faixas: FAIXAS_LAIA,
  criteriosExtras: [
    { chave: "requisitoLegal", rotulo: "Há requisito legal aplicável não atendido", elevaPara: "CRITICO" },
    { chave: "partesInteressadas", rotulo: "Preocupação relevante de parte interessada", elevaPara: "ALTO" },
  ],
};

export const PADROES_SISTEMA: Record<"RISCO_OPORTUNIDADE" | "HIRA" | "ASPECTO_IMPACTO", ConfigEscala> = {
  RISCO_OPORTUNIDADE: PADRAO_RISCO_OPORTUNIDADE,
  HIRA: PADRAO_HIRA,
  ASPECTO_IMPACTO: PADRAO_ASPECTO_IMPACTO,
};
