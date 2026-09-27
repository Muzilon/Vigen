import { describe, expect, it } from "vitest";
import { calcularValidade, ehObrigatorio, montarMatriz, resumirMatriz, statusCompetencia, ultimasRealizacoes } from "@/lib/treinamentos/regras";

const hoje = "2026-09-26";

describe("treinamentos — validade", () => {
  it("validade = data da sessão + meses (fim de mês ajustado); sem validade = não vence", () => {
    expect(calcularValidade("2025-09-10", 12)).toBe("2026-09-10");
    expect(calcularValidade("2024-02-29", 12)).toBe("2025-02-28");
    expect(calcularValidade("2026-01-31", 1)).toBe("2026-02-28");
    expect(calcularValidade("2026-01-31", null)).toBeNull();
  });
});

describe("treinamentos — status da competência", () => {
  it("não realizado, não vence, vencido, a vencer (≤ 30 dias) e em dia", () => {
    expect(statusCompetencia(null, hoje)).toBe("NAO_REALIZADO");
    expect(statusCompetencia({ dataValidade: null }, hoje)).toBe("EM_DIA");
    expect(statusCompetencia({ dataValidade: "2026-09-25" }, hoje)).toBe("VENCIDO");
    expect(statusCompetencia({ dataValidade: "2026-09-26" }, hoje)).toBe("A_VENCER"); // vence hoje: ainda válido
    expect(statusCompetencia({ dataValidade: "2026-10-26" }, hoje)).toBe("A_VENCER");
    expect(statusCompetencia({ dataValidade: "2026-10-27" }, hoje)).toBe("EM_DIA");
    expect(statusCompetencia({ dataValidade: "2026-10-10" }, hoje, 7)).toBe("EM_DIA");
  });
  it("obrigatoriedade: todos ou setor do usuário", () => {
    expect(ehObrigatorio({ obrigatorioTodos: true, obrigatorioSetorIds: [] }, { setorId: null })).toBe(true);
    expect(ehObrigatorio({ obrigatorioTodos: false, obrigatorioSetorIds: ["s1"] }, { setorId: "s1" })).toBe(true);
    expect(ehObrigatorio({ obrigatorioTodos: false, obrigatorioSetorIds: ["s1"] }, { setorId: "s2" })).toBe(false);
    expect(ehObrigatorio({ obrigatorioTodos: false, obrigatorioSetorIds: ["s1"] }, { setorId: null })).toBe(false);
  });
});

describe("treinamentos — matriz de competências", () => {
  const p = (usuarioId: string, treinamentoId: string, dataRealizacao: string, dataValidade: string | null, presente = true) => ({ usuarioId, treinamentoId, dataRealizacao, dataValidade, presente });
  it("última realização presente vale (reciclagem resolve o vencido; ausência não conta)", () => {
    const u = ultimasRealizacoes([p("u1", "t1", "2024-06-10", "2026-06-10"), p("u1", "t1", "2026-08-20", "2028-08-20"), p("u1", "t1", "2026-09-01", null, false)]);
    expect(u.get("u1:t1")!.dataValidade).toBe("2028-08-20");
  });
  it("células por pessoa × treinamento e resumo (% em dia só entre obrigatórias)", () => {
    const usuarios = [{ id: "u1", setorId: "seg" }, { id: "u2", setorId: null }];
    const treinamentos = [
      { id: "t1", obrigatorioTodos: true, obrigatorioSetorIds: [] },
      { id: "t2", obrigatorioTodos: false, obrigatorioSetorIds: ["seg"] },
      { id: "t3", obrigatorioTodos: false, obrigatorioSetorIds: [] },
    ];
    const { linhas, resumo } = montarMatriz(usuarios, treinamentos, [
      p("u1", "t1", "2025-09-10", "2026-09-10"), // vencido
      p("u1", "t2", "2025-10-15", "2026-10-15"), // a vencer
      p("u2", "t1", "2026-03-02", "2027-03-02"), // em dia
      p("u2", "t3", "2026-04-08", null), // opcional realizado, não vence
    ], hoje);
    expect(linhas[0].celulas.map((c) => c.status)).toEqual(["VENCIDO", "A_VENCER", null]);
    expect(linhas[1].celulas.map((c) => c.status)).toEqual(["EM_DIA", null, "EM_DIA"]);
    expect(linhas[1].celulas[2].obrigatorio).toBe(false);
    expect(resumo).toEqual({ obrigatorias: 3, emDia: 2, percentualEmDia: 67, aVencer: 1, vencidos: 1, naoRealizados: 0 });
  });
  it("resumo vazio", () => {
    expect(resumirMatriz([]).percentualEmDia).toBeNull();
  });
});
