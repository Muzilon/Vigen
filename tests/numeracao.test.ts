import { describe, expect, it } from "vitest";
import { anoNoFuso, hojeNoFuso } from "@/lib/datas";
import { formatarCodigoRnc } from "@/lib/rnc/numeracao";

describe("numeração de RNC", () => {
  it("formata RNC-seq(3)-ano(2)", () => {
    expect(formatarCodigoRnc(1, 2026)).toBe("RNC-001-26");
    expect(formatarCodigoRnc(42, 2027)).toBe("RNC-042-27");
    expect(formatarCodigoRnc(1234, 2030)).toBe("RNC-1234-30");
    expect(formatarCodigoRnc(7, 2100)).toBe("RNC-007-00");
  });
  it("rejeita sequência inválida", () => {
    expect(() => formatarCodigoRnc(0, 2026)).toThrow();
  });
  it("ano/data no fuso da empresa", () => {
    const virada = new Date("2027-01-01T02:00:00Z"); // 31/12/2026 23h em São Paulo
    expect(anoNoFuso("America/Sao_Paulo", virada)).toBe(2026);
    expect(anoNoFuso("UTC", virada)).toBe(2027);
    expect(hojeNoFuso("America/Sao_Paulo", virada)).toBe("2026-12-31");
  });
});
