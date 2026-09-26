import { describe, expect, it } from "vitest";
import {
  celulasPartes,
  corParte,
  estrategiaParte,
  normalizarCiclo,
  normalizarItem,
  normalizarParte,
  ordenarPorRelevancia,
  tipoRiscoDoQuadrante,
} from "@/lib/swot/regras";

describe("SWOT", () => {
  it("quadrante → tipo do risco gerado", () => {
    expect(tipoRiscoDoQuadrante("FRAQUEZA")).toBe("RISCO");
    expect(tipoRiscoDoQuadrante("AMEACA")).toBe("RISCO");
    expect(tipoRiscoDoQuadrante("FORCA")).toBe("OPORTUNIDADE");
    expect(tipoRiscoDoQuadrante("OPORTUNIDADE")).toBe("OPORTUNIDADE");
  });
  it("valida item, relevância 1–5 e ciclo", () => {
    expect(normalizarItem({ quadrante: "FORCA", descricao: " Equipe ", relevancia: 5 })).toEqual({ quadrante: "FORCA", descricao: "Equipe", relevancia: 5 });
    expect(() => normalizarItem({ quadrante: "FORCA", descricao: "Equipe", relevancia: 6 })).toThrow(/1 a 5/);
    expect(() => normalizarItem({ quadrante: "FORCA", descricao: " ", relevancia: 3 })).toThrow();
    expect(normalizarCiclo({ ano: 2026 }).titulo).toBe("Análise de contexto 2026");
    expect(() => normalizarCiclo({ ano: 1990 })).toThrow(/Ano/);
  });
  it("ordena por relevância e depois por criação", () => {
    const d = (s: number) => new Date(2026, 0, s);
    const r = ordenarPorRelevancia([
      { id: "a", relevancia: 3, criadoEm: d(1) },
      { id: "b", relevancia: 5, criadoEm: d(2) },
      { id: "c", relevancia: 3, criadoEm: d(0) },
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
  it("partes interessadas: estratégia, cor e células da matriz", () => {
    expect(estrategiaParte(5, 5)).toBe("GERENCIAR_DE_PERTO");
    expect(estrategiaParte(5, 2)).toBe("MANTER_SATISFEITA");
    expect(estrategiaParte(2, 4)).toBe("MANTER_INFORMADA");
    expect(estrategiaParte(3, 3)).toBe("MONITORAR");
    expect(corParte(1, 1)).toBe("baixa");
    expect(corParte(5, 5)).toBe("critica");
    const c = celulasPartes([{ influencia: 5, interesse: 5 }, { influencia: 5, interesse: 5 }, { influencia: 1, interesse: 2 }]);
    expect(c).toHaveLength(25);
    expect(c.find((x) => x.linha === 5 && x.coluna === 5)?.contagem).toBe(2);
    expect(() => normalizarParte({ nome: "X", influencia: 3, interesse: 3 })).toThrow(/nome/);
    expect(() => normalizarParte({ nome: "Clientes", influencia: 0, interesse: 3 })).toThrow(/Influência/);
  });
});
