import { describe, expect, it } from "vitest";
import { statusEfetivoItem, statusGeralPlano } from "@/lib/plano-acao/status";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("status do plano de ação", () => {
  it("item atrasado quando prazo < hoje e não finalizado", () => {
    expect(statusEfetivoItem({ status: "PENDENTE", quando: d("2026-09-25") }, "2026-09-26")).toBe("ATRASADO");
    expect(statusEfetivoItem({ status: "EM_ANDAMENTO", quando: d("2026-09-26") }, "2026-09-26")).toBe("EM_ANDAMENTO");
    expect(statusEfetivoItem({ status: "CONCLUIDO", quando: d("2026-01-01") }, "2026-09-26")).toBe("CONCLUIDO");
  });
  it("status geral", () => {
    const hoje = "2026-09-26";
    expect(statusGeralPlano([], hoje)).toBe("SEM_ITENS");
    expect(statusGeralPlano([{ status: "PENDENTE", quando: d("2026-10-01") }], hoje)).toBe("PENDENTE");
    expect(
      statusGeralPlano([{ status: "CONCLUIDO", quando: d("2026-10-01") }, { status: "PENDENTE", quando: d("2026-10-01") }], hoje),
    ).toBe("EM_ANDAMENTO");
    expect(
      statusGeralPlano([{ status: "CONCLUIDO", quando: d("2026-10-01") }, { status: "CANCELADO", quando: d("2026-01-01") }], hoje),
    ).toBe("CONCLUIDO");
    expect(statusGeralPlano([{ status: "PENDENTE", quando: d("2026-09-01") }], hoje)).toBe("ATRASADO");
  });
});
