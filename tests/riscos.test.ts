import { describe, expect, it } from "vitest";
import { PADRAO_RISCO_OPORTUNIDADE } from "@/lib/escala/padrao";
import type { ConfigEscala } from "@/lib/escala/tipos";
import { ErroNegocio } from "@/lib/erros";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";
import {
  agruparReavaliacao,
  avaliar,
  celulasHeatmap,
  codigoRisco,
  exigePlano,
  exigirPlanoSeNecessario,
  normalizarRisco,
  validarTratamento,
  type RiscoParaReavaliacao,
} from "@/lib/riscos/regras";

const TRES: ConfigEscala = {
  tamanho: 3,
  eixos: [
    { chave: "p", rotulo: "Chance", niveis: [1, 2, 3].map((v) => ({ valor: v, rotulo: String(v) })) },
    { chave: "i", rotulo: "Efeito", niveis: [1, 2, 3].map((v) => ({ valor: v, rotulo: String(v) })) },
  ],
  faixas: [
    { limite: 2, nivel: "BAIXO", cor: "baixa" },
    { limite: 4, nivel: "MEDIO", cor: "media" },
    { limite: 6, nivel: "ALTO", cor: "alta" },
    { limite: 9, nivel: "CRITICO", cor: "critica" },
  ],
};

describe("cálculo do nível (P×I pela escala)", () => {
  it("usa a escala padrão 5×5", () => {
    expect(avaliar(PADRAO_RISCO_OPORTUNIDADE, 1, 4)).toEqual({ probabilidade: 1, impacto: 4, score: 4, faixa: "BAIXO" });
    expect(avaliar(PADRAO_RISCO_OPORTUNIDADE, 3, 3).faixa).toBe("MEDIO");
    expect(avaliar(PADRAO_RISCO_OPORTUNIDADE, 4, 4).faixa).toBe("ALTO");
    expect(avaliar(PADRAO_RISCO_OPORTUNIDADE, 5, 5)).toMatchObject({ score: 25, faixa: "CRITICO" });
  });
  it("respeita escala customizada 3×3 com chaves de eixo próprias (posição = P, I)", () => {
    expect(avaliar(TRES, 2, 2)).toMatchObject({ score: 4, faixa: "MEDIO" });
    expect(avaliar(TRES, 3, 3)).toMatchObject({ score: 9, faixa: "CRITICO" });
  });
  it("valor fora da escala vira ErroNegocio", () => {
    expect(() => avaliar(TRES, 4, 1)).toThrow(ErroNegocio);
    expect(() => avaliar(PADRAO_RISCO_OPORTUNIDADE, 0, 3)).toThrow(/escala/);
  });
  it("heatmap: células coloridas pela escala e contagem inicial/residual", () => {
    const itens = [
      { probabilidade: 3, impacto: 3, probabilidadeResidual: 1, impactoResidual: 3 },
      { probabilidade: 3, impacto: 3, probabilidadeResidual: null, impactoResidual: null },
      { probabilidade: 1, impacto: 1, probabilidadeResidual: null, impactoResidual: null },
    ];
    const ini = celulasHeatmap(TRES, itens);
    expect(ini).toHaveLength(9);
    expect(ini.find((c) => c.linha === 3 && c.coluna === 3)).toMatchObject({ contagem: 2, cor: "critica" });
    expect(ini.find((c) => c.linha === 1 && c.coluna === 1)).toMatchObject({ contagem: 1, cor: "baixa" });
    const res = celulasHeatmap(TRES, itens, true);
    expect(res.reduce((s, c) => s + c.contagem, 0)).toBe(1);
    expect(res.find((c) => c.linha === 3 && c.coluna === 1)?.contagem).toBe(1);
  });
});

describe("tratamento → plano de ação obrigatório", () => {
  it("MITIGAR/EVITAR com ALTO/CRÍTICO exige plano", () => {
    expect(exigePlano("MITIGAR", "ALTO")).toBe(true);
    expect(exigePlano("EVITAR", "CRITICO")).toBe(true);
    expect(exigePlano("MITIGAR", "MEDIO")).toBe(false);
    expect(exigePlano("ACEITAR", "CRITICO")).toBe(false);
    expect(exigePlano("TRANSFERIR", "ALTO")).toBe(false);
    expect(exigePlano(null, "CRITICO")).toBe(false);
  });
  it("exigirPlanoSeNecessario só lança sem plano", () => {
    expect(() => exigirPlanoSeNecessario("MITIGAR", "ALTO", false)).toThrow(/exige plano de ação/);
    expect(() => exigirPlanoSeNecessario("MITIGAR", "ALTO", true)).not.toThrow();
    expect(() => exigirPlanoSeNecessario("EXPLORAR", "CRITICO", false)).not.toThrow();
  });
  it("tratamento coerente com o tipo", () => {
    expect(() => validarTratamento("OPORTUNIDADE", "MITIGAR")).toThrow(ErroNegocio);
    expect(() => validarTratamento("RISCO", "EXPLORAR")).toThrow(ErroNegocio);
    expect(() => validarTratamento("OPORTUNIDADE", "EXPLORAR")).not.toThrow();
    expect(() => validarTratamento("RISCO", "TRANSFERIR")).not.toThrow();
  });
});

describe("dados e reavaliação", () => {
  it("normaliza e valida", () => {
    const d = normalizarRisco({ tipo: "RISCO", descricao: "  Queda  ", causa: " ", probabilidade: 2, impacto: 3, processoId: "" });
    expect(d).toMatchObject({ descricao: "Queda", causa: null, processoId: null, modoReavaliacao: "ITEM", periodicidadeMeses: 12 });
    expect(() => normalizarRisco({ tipo: "RISCO", descricao: "ab", probabilidade: 1, impacto: 1 })).toThrow(/mínimo/);
    expect(() => normalizarRisco({ tipo: "RISCO", descricao: "abc", probabilidade: 1, impacto: 1, periodicidadeMeses: 0 })).toThrow(/Periodicidade/);
  });
  it("código R-/O- com três dígitos", () => {
    expect(codigoRisco({ tipo: "RISCO", numero: 7 })).toBe("R-007");
    expect(codigoRisco({ tipo: "OPORTUNIDADE", numero: 12 })).toBe("O-012");
  });
  it("próxima reavaliação = hoje + periodicidade", () => {
    expect(calcularProximaReavaliacao("2026-09-26", 12)).toBe("2027-09-26");
  });
  it("agrupa alertas: ITEM um por registro; GERAL um por processo com a menor data", () => {
    const base = { tipo: "RISCO" as const, descricao: "x", responsavelId: "u1", criadoPorId: "u0", processoCodigo: "PF-01" };
    const itens: RiscoParaReavaliacao[] = [
      { ...base, id: "a", numero: 1, modoReavaliacao: "ITEM", proximaReavaliacaoEm: "2026-10-01", processoId: "p1" },
      { ...base, id: "b", numero: 2, modoReavaliacao: "GERAL", proximaReavaliacaoEm: "2026-10-10", processoId: "p1" },
      { ...base, id: "c", numero: 3, modoReavaliacao: "GERAL", proximaReavaliacaoEm: "2026-10-03", processoId: "p1", responsavelId: "u2" },
      { ...base, id: "d", numero: 4, modoReavaliacao: "GERAL", proximaReavaliacaoEm: "2026-10-05", processoId: null, processoCodigo: null },
      { ...base, id: "e", numero: 5, modoReavaliacao: "ITEM", proximaReavaliacaoEm: null, processoId: null },
    ];
    const g = agruparReavaliacao(itens, "emp");
    expect(g).toHaveLength(3);
    expect(g[0]).toMatchObject({ entidadeId: "a", modo: "ITEM", link: "/riscos/a" });
    const p1 = g.find((x) => x.entidadeId === "p1")!;
    expect(p1).toMatchObject({ modo: "GERAL", dataReavaliacao: "2026-10-03" });
    expect(p1.usuarioIds.sort()).toEqual(["u1", "u2"]);
    expect(g.find((x) => x.entidadeId === "emp")?.link).toContain("processo=sem");
  });
});
