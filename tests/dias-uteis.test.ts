import { describe, expect, it } from "vitest";
import { diasUteisEntre, somarDiasUteis } from "@/lib/datas";

// 2026-10-02 é sexta; 03 sábado; 04 domingo; 05 segunda.
describe("somarDiasUteis", () => {
  it("n = 0 devolve o próprio dia", () => expect(somarDiasUteis("2026-10-03", 0, new Set())).toBe("2026-10-03"));
  it("sem feriados pula só sábado e domingo", () => {
    expect(somarDiasUteis("2026-10-02", 1, new Set())).toBe("2026-10-05");
    expect(somarDiasUteis("2026-10-05", 5, new Set())).toBe("2026-10-12");
  });
  it("partindo de sábado, 1 dia útil é a segunda", () => expect(somarDiasUteis("2026-10-03", 1)).toBe("2026-10-05"));
  it("pula feriado em dia de semana", () => {
    expect(somarDiasUteis("2026-10-05", 2, new Set(["2026-10-06"]))).toBe("2026-10-08");
  });
  it("feriado em sábado não desconta nada", () => {
    expect(somarDiasUteis("2026-10-02", 1, new Set(["2026-10-03"]))).toBe("2026-10-05");
  });
  it("vira o mês e o ano", () => {
    expect(somarDiasUteis("2026-10-29", 3, new Set())).toBe("2026-11-03");
    expect(somarDiasUteis("2026-12-30", 2, new Set(["2027-01-01"]))).toBe("2027-01-04");
  });
  it("rejeita n negativo", () => expect(() => somarDiasUteis("2026-10-05", -1)).toThrow());
});

describe("diasUteisEntre", () => {
  it("segunda a sexta seguinte = 5", () => expect(diasUteisEntre("2026-10-05", "2026-10-12", new Set())).toBe(5));
  it("sexta a segunda = 1", () => expect(diasUteisEntre("2026-10-02", "2026-10-05")).toBe(1));
  it("mesmo dia ou invertido = 0", () => {
    expect(diasUteisEntre("2026-10-05", "2026-10-05")).toBe(0);
    expect(diasUteisEntre("2026-10-09", "2026-10-05")).toBe(0);
  });
  it("feriado reduz a contagem; feriado em sábado não", () => {
    expect(diasUteisEntre("2026-10-05", "2026-10-12", new Set(["2026-10-07"]))).toBe(4);
    expect(diasUteisEntre("2026-10-05", "2026-10-12", new Set(["2026-10-10"]))).toBe(5);
  });
  it("é coerente com somarDiasUteis", () => {
    const f = new Set(["2026-11-02"]);
    expect(somarDiasUteis("2026-10-28", diasUteisEntre("2026-10-28", "2026-11-10", f), f)).toBe("2026-11-10");
  });
});
