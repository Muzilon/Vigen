import { describe, expect, it } from "vitest";
import { aprovadoresEfetivos, canalAprovacao, lerConfigAprovacao, mesclarConfigAprovacao } from "@/lib/aprovacao/config-modulo";
import { ErroNegocio } from "@/lib/erros";
import { PADRAO_HIRA } from "@/lib/escala/padrao";
import { filtroObras, obraNoEscopo } from "@/lib/escopo-obras";
import { agruparReavaliacaoPorObra, avaliarPS, avaliarResidual, calcularLinhaHira, celulasHeatmapHira, codigoHira, diffCampos } from "@/lib/hira/regras";

const base = {
  obraId: "o1",
  setor: "Fachada",
  atividade: "Andaime",
  rotineira: true,
  perigo: "Altura",
  risco: "Queda",
  condicao: "NORMAL" as const,
  probabilidade: 3,
  severidade: 5,
};

describe("HIRA — cálculo", () => {
  it("P×S pela escala HIRA padrão", () => {
    expect(avaliarPS(PADRAO_HIRA, 3, 5)).toEqual({ probabilidade: 3, severidade: 5, score: 15, faixa: "ALTO" });
    expect(avaliarPS(PADRAO_HIRA, 5, 5).faixa).toBe("CRITICO");
    expect(() => avaliarPS(PADRAO_HIRA, 6, 1)).toThrow(ErroNegocio);
  });
  it("residual: ambos ou nenhum", () => {
    expect(avaliarResidual(PADRAO_HIRA, null, null).faixaResidual).toBeNull();
    expect(avaliarResidual(PADRAO_HIRA, 1, 5).faixaResidual).toBe("MEDIO");
    expect(() => avaliarResidual(PADRAO_HIRA, 1, null)).toThrow(/residuais/);
  });
  it("calcularLinhaHira normaliza e exige obra/textos", () => {
    const l = calcularLinhaHira(PADRAO_HIRA, { ...base, setor: "  Fachada ", probabilidadeResidual: 1, severidadeResidual: 5 });
    expect(l.setor).toBe("Fachada");
    expect(l.score).toBe(15);
    expect(l.scoreResidual).toBe(5);
    expect(() => calcularLinhaHira(PADRAO_HIRA, { ...base, obraId: "" })).toThrow(/unidade/);
    expect(() => calcularLinhaHira(PADRAO_HIRA, { ...base, perigo: " " })).toThrow(/perigo/);
    expect(() => calcularLinhaHira(PADRAO_HIRA, { ...base, condicao: "X" as never })).toThrow(/Condição/);
  });
  it("código e diff", () => {
    expect(codigoHira({ numero: 7 })).toBe("H-007");
    expect(diffCampos({ a: 1, b: 2 }, { a: 1, b: 3 }, ["a", "b"])).toEqual({ antes: { b: 2 }, depois: { b: 3 } });
  });
  it("heatmap conta inicial e residual", () => {
    const c = celulasHeatmapHira(PADRAO_HIRA, [{ probabilidade: 3, severidade: 5, probabilidadeResidual: 1, severidadeResidual: 5 }]);
    expect(c).toHaveLength(25);
    expect(c.find((x) => x.linha === 5 && x.coluna === 3)?.contagem).toBe(1);
    expect(celulasHeatmapHira(PADRAO_HIRA, [{ probabilidade: 3, severidade: 5, probabilidadeResidual: 1, severidadeResidual: 5 }], true).find((x) => x.linha === 5 && x.coluna === 1)?.contagem).toBe(1);
  });
  it("reavaliação: ITEM por linha, GERAL por obra", () => {
    const l = { numero: 1, atividade: "x", obraNome: "Alfa", responsavelId: null, criadoPorId: "u" };
    const g = agruparReavaliacaoPorObra(
      [
        { ...l, id: "1", modoReavaliacao: "ITEM", proximaReavaliacaoEm: "2026-10-01", obraId: "o" },
        { ...l, id: "2", modoReavaliacao: "GERAL", proximaReavaliacaoEm: "2026-11-01", obraId: "o" },
        { ...l, id: "3", modoReavaliacao: "GERAL", proximaReavaliacaoEm: "2026-10-15", obraId: "o" },
      ],
      "/hira",
      "HIRA",
      codigoHira,
    );
    expect(g).toHaveLength(2);
    expect(g[1]).toMatchObject({ modo: "GERAL", dataReavaliacao: "2026-10-15", link: "/hira/revisao-geral?obra=o" });
  });
});

describe("config de aprovação por módulo", () => {
  it("lê com padrão tolerante e mescla preservando outras chaves", () => {
    expect(lerConfigAprovacao({}, "hira")).toEqual({ exigir: false, aprovadorIds: [], modo: "SEQUENCIAL", usarTramitacao: false });
    const cfg = mesclarConfigAprovacao({ notificacoes: { email: true } }, "hira", { exigir: true, aprovadorIds: ["a"], modo: "PARALELO" });
    expect(cfg).toMatchObject({ notificacoes: { email: true } });
    expect(lerConfigAprovacao(cfg, "hira")).toEqual({ exigir: true, aprovadorIds: ["a"], modo: "PARALELO", usarTramitacao: false });
    expect(lerConfigAprovacao(cfg, "laia").exigir).toBe(false);
  });
  it("aprovadores efetivos excluem o solicitante", () => {
    expect(aprovadoresEfetivos({ exigir: true, aprovadorIds: ["a", "b"], modo: "SEQUENCIAL", usarTramitacao: false }, "a")).toEqual(["b"]);
    expect(() => aprovadoresEfetivos({ exigir: true, aprovadorIds: ["a"], modo: "SEQUENCIAL", usarTramitacao: false }, "a")).toThrow(ErroNegocio);
    expect(canalAprovacao(["DOCUMENTOS"], { usarTramitacao: false })).toBe("MOTOR");
    expect(canalAprovacao(["HIRA"], { usarTramitacao: true })).toBe("MOTOR");
    expect(canalAprovacao(["HIRA", "DOCUMENTOS"], { usarTramitacao: true })).toBe("TRAMITACAO");
  });
  it("escopo por obra", () => {
    expect(filtroObras({ obrasPermitidas: null })).toEqual({});
    expect(filtroObras({ obrasPermitidas: ["x"] })).toEqual({ obraId: { in: ["x"] } });
    expect(obraNoEscopo({ obrasPermitidas: ["x"] }, "y")).toBe(false);
  });
});
