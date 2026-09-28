import { describe, expect, it } from "vitest";
import { calcularValidade, ehObrigatorio, montarMatriz, pendenciasNr1, resumirMatriz, situacaoEficacia, statusCompetencia, ultimasRealizacoes } from "@/lib/treinamentos/regras";

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
    expect(ehObrigatorio({ obrigatorioTodos: false, obrigatorioSetorIds: ["s1"], obrigatorioFuncaoIds: ["f1"] }, { setorId: "s2", funcaoId: "f1" })).toBe(true);
    expect(ehObrigatorio({ obrigatorioTodos: false, obrigatorioSetorIds: [], obrigatorioFuncaoIds: ["f1"] }, { setorId: null, funcaoId: "f2" })).toBe(false);
    expect(ehObrigatorio({ obrigatorioTodos: false, obrigatorioSetorIds: [], obrigatorioFuncaoIds: ["f1"] }, { setorId: null })).toBe(false);
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
    expect(resumo).toEqual({ obrigatorias: 3, emDia: 2, percentualEmDia: 67, aVencer: 1, vencidos: 1, naoRealizados: 0, reciclagemPendente: 0, inaptos: 0 });
  });
  it("resumo vazio", () => {
    expect(resumirMatriz([]).percentualEmDia).toBeNull();
  });
});

describe("treinamentos — gatilhos de reciclagem e aptidão", () => {
  const r = (dataRealizacao: string, dataValidade: string | null) => ({ dataRealizacao, dataValidade });
  it("evento posterior à realização → reciclagem pendente; realização no dia do evento resolve; vencido prevalece", () => {
    expect(statusCompetencia(r("2026-01-10", "2028-01-10"), hoje, 30, "2026-06-01")).toBe("RECICLAGEM_PENDENTE");
    expect(statusCompetencia(r("2026-06-01", "2028-06-01"), hoje, 30, "2026-06-01")).toBe("EM_DIA");
    expect(statusCompetencia(r("2026-07-01", null), hoje, 30, "2026-06-01")).toBe("EM_DIA");
    expect(statusCompetencia(r("2024-01-10", "2026-01-10"), hoje, 30, "2026-06-01")).toBe("VENCIDO");
    expect(statusCompetencia(r("2026-01-10", null), hoje, 30, "2026-06-01")).toBe("RECICLAGEM_PENDENTE");
    expect(statusCompetencia(null, hoje, 30, "2026-06-01")).toBe("NAO_REALIZADO");
  });
  it("inapto só por pendência em treinamento crítico e obrigatório", () => {
    const usuarios = [{ id: "u1", setorId: null }, { id: "u2", setorId: null }, { id: "u3", setorId: null }];
    const treinamentos = [
      { id: "nr35", obrigatorioTodos: true, obrigatorioSetorIds: [], critico: true },
      { id: "integ", obrigatorioTodos: true, obrigatorioSetorIds: [], critico: false },
    ];
    const p = (usuarioId: string, treinamentoId: string, dataRealizacao: string, dataValidade: string | null) => ({ usuarioId, treinamentoId, dataRealizacao, dataValidade, presente: true });
    const { linhas, resumo } = montarMatriz(
      usuarios,
      treinamentos,
      [p("u1", "nr35", "2026-01-10", "2028-01-10"), p("u2", "nr35", "2026-01-10", "2028-01-10"), p("u2", "integ", "2026-01-10", null), p("u3", "integ", "2026-01-10", null)],
      hoje,
      30,
      [{ usuarioId: "u2", treinamentoId: "nr35", dataEvento: "2026-05-01" }],
    );
    expect(linhas[0].aptidao).toEqual({ apto: true, pendencias: [] }); // integração (não crítica) pendente não inabilita
    expect(linhas[1].aptidao).toEqual({ apto: false, pendencias: [{ treinamentoId: "nr35", status: "RECICLAGEM_PENDENTE" }] });
    expect(linhas[2].aptidao.pendencias).toEqual([{ treinamentoId: "nr35", status: "NAO_REALIZADO" }]);
    expect(resumo.inaptos).toBe(2);
    expect(resumo.reciclagemPendente).toBe(1);
  });
});

describe("treinamentos — eficácia e NR-1", () => {
  it("situação da eficácia: resultado, aguardando prazo, pendente, não se aplica", () => {
    expect(situacaoEficacia({ presente: false, eficaciaResultado: null }, "2026-09-01", 30, hoje)).toBeNull();
    expect(situacaoEficacia({ presente: true, eficaciaResultado: null }, "2026-09-01", null, hoje)).toBeNull();
    expect(situacaoEficacia({ presente: true, eficaciaResultado: null }, "2026-09-01", 30, hoje)).toBe("AGUARDANDO");
    expect(situacaoEficacia({ presente: true, eficaciaResultado: null }, "2026-08-27", 30, hoje)).toBe("PENDENTE");
    expect(situacaoEficacia({ presente: true, eficaciaResultado: "NAO_EFICAZ" }, "2026-09-01", 30, hoje)).toBe("NAO_EFICAZ");
  });
  it("pendências NR-1: conteúdo, qualificação e carga horária mínima; tipos fora de NR não se aplicam", () => {
    const completa = { cargaHoraria: 8, conteudoProgramatico: "Riscos, EPI, resgate", qualificacaoInstrutor: "Téc. Segurança" };
    expect(pendenciasNr1({ tipo: "NR", cargaHoraria: 8 }, completa)).toEqual([]);
    expect(pendenciasNr1({ tipo: "TECNICO", cargaHoraria: 8 }, completa)).toBeNull();
    expect(pendenciasNr1({ tipo: "NR", cargaHoraria: 8 }, { ...completa, cargaHoraria: 4 })).toEqual(["Carga horária (4 h) abaixo do mínimo do treinamento (8 h)"]);
    expect(pendenciasNr1({ tipo: "RECICLAGEM", cargaHoraria: null }, { cargaHoraria: null, conteudoProgramatico: " ", qualificacaoInstrutor: null })).toHaveLength(3);
  });
});
