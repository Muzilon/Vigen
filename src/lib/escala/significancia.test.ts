import { describe, expect, it } from "vitest";
import { ehSignificativo, nivelComCriteriosExtras } from "@/lib/escala/significancia";

describe("nivelComCriteriosExtras", () => {
  it("mantém o nível base quando nenhum critério é atendido", () => {
    expect(nivelComCriteriosExtras({ nivelBase: "BAIXO", criteriosAtendidos: [] })).toBe("BAIXO");
  });

  it("eleva o nível quando um critério atendido é mais grave", () => {
    const nivel = nivelComCriteriosExtras({
      nivelBase: "BAIXO",
      criteriosAtendidos: [{ chave: "requisitoLegal", elevaPara: "CRITICO" }],
    });
    expect(nivel).toBe("CRITICO");
  });

  it("não rebaixa o nível quando o critério eleva para algo menos grave que o base", () => {
    const nivel = nivelComCriteriosExtras({
      nivelBase: "ALTO",
      criteriosAtendidos: [{ chave: "partesInteressadas", elevaPara: "MEDIO" }],
    });
    expect(nivel).toBe("ALTO");
  });

  it("usa o maior elevaPara entre vários critérios atendidos", () => {
    const nivel = nivelComCriteriosExtras({
      nivelBase: "BAIXO",
      criteriosAtendidos: [
        { chave: "a", elevaPara: "MEDIO" },
        { chave: "b", elevaPara: "ALTO" },
      ],
    });
    expect(nivel).toBe("ALTO");
  });
});

describe("ehSignificativo", () => {
  it("BAIXO e MEDIO não são significativos", () => {
    expect(ehSignificativo("BAIXO")).toBe(false);
    expect(ehSignificativo("MEDIO")).toBe(false);
  });
  it("ALTO e CRITICO são significativos", () => {
    expect(ehSignificativo("ALTO")).toBe(true);
    expect(ehSignificativo("CRITICO")).toBe(true);
  });
});
