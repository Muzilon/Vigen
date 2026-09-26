import { describe, expect, it } from "vitest";
import { calcularNivel, calcularScore, ErroEscala, faixaParaScore } from "@/lib/escala/calculo";
import { PADRAO_ASPECTO_IMPACTO, PADRAO_HIRA, PADRAO_RISCO_OPORTUNIDADE } from "@/lib/escala/padrao";

describe("calcularScore", () => {
  it("multiplica os valores dos eixos (P x S)", () => {
    expect(calcularScore(PADRAO_RISCO_OPORTUNIDADE, { probabilidade: 3, impacto: 4 })).toBe(12);
  });

  it("aplica o peso do eixo quando informado", () => {
    const config = {
      ...PADRAO_RISCO_OPORTUNIDADE,
      eixos: [
        { chave: "probabilidade", rotulo: "Probabilidade", peso: 2, niveis: PADRAO_RISCO_OPORTUNIDADE.eixos[0].niveis },
        { chave: "impacto", rotulo: "Impacto", niveis: PADRAO_RISCO_OPORTUNIDADE.eixos[1].niveis },
      ],
    };
    expect(calcularScore(config, { probabilidade: 3, impacto: 4 })).toBe(24);
  });

  it("rejeita eixo faltante", () => {
    expect(() => calcularScore(PADRAO_RISCO_OPORTUNIDADE, { probabilidade: 3 })).toThrow(ErroEscala);
  });

  it("rejeita valor fora dos níveis do eixo", () => {
    expect(() => calcularScore(PADRAO_RISCO_OPORTUNIDADE, { probabilidade: 3, impacto: 99 })).toThrow(ErroEscala);
  });
});

describe("faixaParaScore", () => {
  it("encontra a faixa BAIXO para score baixo (5x5)", () => {
    expect(faixaParaScore(PADRAO_RISCO_OPORTUNIDADE, 4).nivel).toBe("BAIXO");
  });
  it("encontra a faixa MEDIO no limite (5x5)", () => {
    expect(faixaParaScore(PADRAO_RISCO_OPORTUNIDADE, 9).nivel).toBe("MEDIO");
  });
  it("encontra a faixa CRITICO no topo (5x5, score 25)", () => {
    expect(faixaParaScore(PADRAO_RISCO_OPORTUNIDADE, 25).nivel).toBe("CRITICO");
  });
  it("usa a última faixa se o score exceder todos os limites", () => {
    expect(faixaParaScore(PADRAO_RISCO_OPORTUNIDADE, 999).nivel).toBe("CRITICO");
  });
  it("rejeita configuração sem faixas", () => {
    expect(() => faixaParaScore({ ...PADRAO_RISCO_OPORTUNIDADE, faixas: [] }, 5)).toThrow(ErroEscala);
  });
});

describe("calcularNivel", () => {
  it("calcula score, nível e cor para HIRA (5x5)", () => {
    const r = calcularNivel(PADRAO_HIRA, { probabilidade: 5, severidade: 5 });
    expect(r).toEqual({ score: 25, nivel: "CRITICO", cor: "critica" });
  });

  it("calcula score, nível e cor para aspecto/impacto (3x3)", () => {
    const r = calcularNivel(PADRAO_ASPECTO_IMPACTO, { frequencia: 1, severidade: 1 });
    expect(r).toEqual({ score: 1, nivel: "BAIXO", cor: "baixa" });
  });

  it("3x3: score 9 (3x3) cai na faixa CRITICO", () => {
    const r = calcularNivel(PADRAO_ASPECTO_IMPACTO, { frequencia: 3, severidade: 3 });
    expect(r.nivel).toBe("CRITICO");
  });
});
