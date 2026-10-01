import { describe, expect, it } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import { PADRAO_ASPECTO_IMPACTO } from "@/lib/escala/padrao";
import type { ConfigEscala } from "@/lib/escala/tipos";
import { calcularLinhaLaia, celulasHeatmapLaia, codigoLaia, pontuarLaia } from "@/lib/laia/regras";

const v = { severidade: 2, frequencia: 2, abrangencia: 1, requisitoLegal: false, partesInteressadas: false };

describe("LAIA — pontuação e significância", () => {
  it("score = S × F × A; faixa pela escala", () => {
    expect(pontuarLaia(PADRAO_ASPECTO_IMPACTO, v)).toEqual({ score: 4, faixaBase: "BAIXO", faixa: "BAIXO", significativo: false });
    expect(pontuarLaia(PADRAO_ASPECTO_IMPACTO, { ...v, severidade: 3, frequencia: 3, abrangencia: 2 })).toMatchObject({ score: 18, faixa: "ALTO", significativo: true });
  });
  it("critérios extras elevam (nunca rebaixam)", () => {
    expect(pontuarLaia(PADRAO_ASPECTO_IMPACTO, { ...v, requisitoLegal: true })).toMatchObject({ faixaBase: "BAIXO", faixa: "CRITICO", significativo: true });
    expect(pontuarLaia(PADRAO_ASPECTO_IMPACTO, { ...v, severidade: 1, frequencia: 1, partesInteressadas: true }).faixa).toBe("ALTO");
  });
  it("eixo ausente na configuração fica fora do score; eixo desconhecido é erro", () => {
    const dois: ConfigEscala = { ...PADRAO_ASPECTO_IMPACTO, eixos: PADRAO_ASPECTO_IMPACTO.eixos.slice(0, 2) };
    expect(pontuarLaia(dois, { ...v, abrangencia: 3 }).score).toBe(4);
    const ruim: ConfigEscala = { ...PADRAO_ASPECTO_IMPACTO, eixos: [{ chave: "x", rotulo: "X", niveis: [{ valor: 1, rotulo: "a" }] }] };
    expect(() => pontuarLaia(ruim, v)).toThrow(ErroNegocio);
    expect(() => pontuarLaia(PADRAO_ASPECTO_IMPACTO, { ...v, severidade: 9 })).toThrow(ErroNegocio);
  });
  it("normaliza e exige obra/textos/enums", () => {
    const base = { obraId: "o", atividade: "Lavagem", aspecto: "Efluente", impacto: "Solo", situacao: "NORMAL" as const, temporalidade: "ATUAL" as const, incidencia: "DIRETA" as const, ...v };
    const l = calcularLinhaLaia(PADRAO_ASPECTO_IMPACTO, { ...base, requisitoLegal: true });
    expect(l).toMatchObject({ score: 4, faixa: "CRITICO", significativo: true, periodicidadeMeses: 12 });
    expect(() => calcularLinhaLaia(PADRAO_ASPECTO_IMPACTO, { ...base, obraId: "" })).toThrow(/unidade/);
    expect(() => calcularLinhaLaia(PADRAO_ASPECTO_IMPACTO, { ...base, aspecto: "" })).toThrow(/aspecto/);
    expect(() => calcularLinhaLaia(PADRAO_ASPECTO_IMPACTO, { ...base, temporalidade: "X" as never })).toThrow(/Temporalidade/);
  });
  it("heatmap severidade × frequência e código", () => {
    const c = celulasHeatmapLaia(PADRAO_ASPECTO_IMPACTO, [{ severidade: 3, frequencia: 1 }, { severidade: 3, frequencia: 1 }]);
    expect(c).toHaveLength(9);
    expect(c.find((x) => x.linha === 3 && x.coluna === 1)?.contagem).toBe(2);
    expect(codigoLaia({ numero: 12 })).toBe("A-012");
  });
});
