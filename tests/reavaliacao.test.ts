import { describe, expect, it } from "vitest";
import { calcularProximaReavaliacao, deveAlertarReavaliacao } from "@/lib/reavaliacao/regras";
import { fontesReavaliacao, montarNotificacoesReavaliacao, registrarFonteReavaliacao, removerFonteReavaliacao } from "@/lib/reavaliacao/fontes";

describe("calcularProximaReavaliacao", () => {
  it("soma meses", () => expect(calcularProximaReavaliacao("2026-03-15", 12)).toBe("2027-03-15"));
  it("vira o ano", () => expect(calcularProximaReavaliacao("2026-11-10", 3)).toBe("2027-02-10"));
  it("ajusta fim de mês", () => {
    expect(calcularProximaReavaliacao("2026-01-31", 1)).toBe("2026-02-28");
    expect(calcularProximaReavaliacao("2027-01-31", 13)).toBe("2028-02-29");
  });
  it("Date usa o dia civil do fuso", () => {
    // 02:00 UTC de 01/03 ainda é 28/02 em São Paulo (UTC-3)
    expect(calcularProximaReavaliacao(new Date("2026-03-01T02:00:00Z"), 6, "America/Sao_Paulo")).toBe("2026-08-28");
    expect(calcularProximaReavaliacao(new Date("2026-03-01T02:00:00Z"), 6, "UTC")).toBe("2026-09-01");
  });
  it("rejeita periodicidade inválida", () => {
    expect(() => calcularProximaReavaliacao("2026-01-01", 0)).toThrow();
    expect(() => calcularProximaReavaliacao("2026-01-01", 1.5)).toThrow();
  });
});

describe("deveAlertarReavaliacao", () => {
  it("dentro da antecedência e vencidas", () => {
    expect(deveAlertarReavaliacao("2026-10-10", "2026-10-01", 15)).toBe(true);
    expect(deveAlertarReavaliacao("2026-09-01", "2026-10-01", 15)).toBe(true);
    expect(deveAlertarReavaliacao("2026-10-17", "2026-10-01", 15)).toBe(false);
  });
});

describe("fontes e notificações", () => {
  it("filtra fontes por módulo ativo", () => {
    registrarFonteReavaliacao({ modulo: "HIRA", listarVencendo: async () => [] }, "teste-hira");
    expect(fontesReavaliacao(["HIRA"]).some((f) => f.modulo === "HIRA")).toBe(true);
    expect(fontesReavaliacao(["LAIA"]).some((f) => f.modulo === "HIRA")).toBe(false);
    removerFonteReavaliacao("teste-hira");
  });
  it("chave idempotente por registro/data/usuário, sem duplicar usuário", () => {
    const n = montarNotificacoesReavaliacao(
      "HIRA",
      [
        { entidadeId: "x", modo: "ITEM", dataReavaliacao: "2026-10-05", titulo: "T", link: "/l", usuarioIds: ["u", "u", "v"] },
        { entidadeId: "y", modo: "GERAL", dataReavaliacao: "2027-01-01", titulo: "Fora", link: "/l", usuarioIds: ["u"] },
      ],
      "2026-10-01",
      15,
    );
    expect(n.map((x) => x.chave)).toEqual(["reavaliacao:HIRA:x:2026-10-05:u", "reavaliacao:HIRA:x:2026-10-05:v"]);
    expect(n[0].tipo).toBe("REAVALIACAO_PROXIMA");
  });
});
