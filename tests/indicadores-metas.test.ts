import { describe, expect, it } from "vitest";
import { podeLancarResultado } from "@/lib/indicadores/acesso";
import { calcularEficaciaPrimeiraVerificacao, calcularItensAtrasados } from "@/lib/indicadores/automaticos";
import {
  atingido,
  formatarValor,
  limitesPeriodo,
  periodoDaData,
  periodoValido,
  rotuloPeriodo,
  situacaoNoPeriodo,
  somarPeriodos,
  ultimoPeriodoFechado,
  ultimosPeriodos,
  validarPeriodoLancamento,
  vigentesPorPeriodo,
} from "@/lib/indicadores/periodos";
import { ErroNegocio } from "@/lib/erros";

const d = (s: string) => new Date(s);

describe("indicadores — atingimento da meta", () => {
  it("maior é melhor: valor ≥ meta", () => {
    expect(atingido(90, 85, "MAIOR_MELHOR")).toBe(true);
    expect(atingido(85, 85, "MAIOR_MELHOR")).toBe(true);
    expect(atingido(84.99, 85, "MAIOR_MELHOR")).toBe(false);
  });
  it("menor é melhor: valor ≤ meta", () => {
    expect(atingido(2.9, 3, "MENOR_MELHOR")).toBe(true);
    expect(atingido(3, 3, "MENOR_MELHOR")).toBe(true);
    expect(atingido(3.6, 3, "MENOR_MELHOR")).toBe(false);
  });
});

describe("indicadores — períodos", () => {
  it("período da data por periodicidade", () => {
    expect(periodoDaData("2026-09-26", "MENSAL")).toBe("2026-09");
    expect(periodoDaData("2026-09-26", "TRIMESTRAL")).toBe("2026-T3");
    expect(periodoDaData("2026-09-26", "SEMESTRAL")).toBe("2026-S2");
    expect(periodoDaData("2026-09-26", "ANUAL")).toBe("2026");
  });
  it("último período fechado atravessa o ano", () => {
    expect(ultimoPeriodoFechado("2026-01-10", "MENSAL")).toBe("2025-12");
    expect(ultimoPeriodoFechado("2026-02-10", "TRIMESTRAL")).toBe("2025-T4");
    expect(ultimoPeriodoFechado("2026-09-26", "SEMESTRAL")).toBe("2026-S1");
    expect(ultimoPeriodoFechado("2026-09-26", "ANUAL")).toBe("2025");
  });
  it("aritmética e janela de períodos", () => {
    expect(somarPeriodos("2026-01", "MENSAL", -2)).toBe("2025-11");
    expect(somarPeriodos("2025-T4", "TRIMESTRAL", 1)).toBe("2026-T1");
    expect(ultimosPeriodos("2026-T1", "TRIMESTRAL", 3)).toEqual(["2025-T3", "2025-T4", "2026-T1"]);
  });
  it("limites do período (fevereiro bissexto, trimestre, semestre)", () => {
    expect(limitesPeriodo("2028-02", "MENSAL")).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
    expect(limitesPeriodo("2026-T2", "TRIMESTRAL")).toEqual({ inicio: "2026-04-01", fim: "2026-06-30" });
    expect(limitesPeriodo("2026-S2", "SEMESTRAL")).toEqual({ inicio: "2026-07-01", fim: "2026-12-31" });
    expect(limitesPeriodo("2026", "ANUAL")).toEqual({ inicio: "2026-01-01", fim: "2026-12-31" });
  });
  it("validação: formato por periodicidade e período futuro", () => {
    expect(periodoValido("2026-T5", "TRIMESTRAL")).toBe(false);
    expect(periodoValido("2026-13", "MENSAL")).toBe(false);
    expect(periodoValido("2026-S2", "SEMESTRAL")).toBe(true);
    expect(() => validarPeriodoLancamento("2026-09", "TRIMESTRAL", "2026-09-26")).toThrow(ErroNegocio);
    expect(() => validarPeriodoLancamento("2026-10", "MENSAL", "2026-09-26")).toThrow(/futuro/);
    expect(() => validarPeriodoLancamento("2026-09", "MENSAL", "2026-09-26")).not.toThrow();
  });
  it("rótulos e formatação", () => {
    expect(rotuloPeriodo("2026-03")).toBe("mar/26");
    expect(rotuloPeriodo("2026-T1")).toBe("1º tri/26");
    expect(rotuloPeriodo("2026-S2")).toBe("2º sem/26");
    expect(formatarValor(92.5, "%")).toBe("92,5%");
    expect(formatarValor(6.5, "dias")).toBe("6,5 dias");
    expect(formatarValor(null, "%")).toBe("—");
  });
});

describe("indicadores — situação e correções", () => {
  const r = (periodo: string, valor: number, criadoEm: string, meta = 3) => ({ periodo, valor, meta, direcao: "MENOR_MELHOR" as const, criadoEm: d(criadoEm) });
  it("o lançamento mais recente do período é o vigente (correção)", () => {
    const lista = [r("2026-07", 2.4, "2026-08-02T10:00:00Z"), r("2026-07", 3.4, "2026-08-05T10:00:00Z")];
    expect(vigentesPorPeriodo(lista).get("2026-07")!.valor).toBe(3.4);
    expect(situacaoNoPeriodo(lista, "2026-07").situacao).toBe("NAO_ATINGIDO");
  });
  it("usa a meta gravada no lançamento e sinaliza sem lançamento", () => {
    const lista = [r("2026-08", 3.5, "2026-09-02T10:00:00Z", 4)];
    expect(situacaoNoPeriodo(lista, "2026-08").situacao).toBe("ATINGIDO");
    expect(situacaoNoPeriodo(lista, "2026-09").situacao).toBe("SEM_LANCAMENTO");
  });
  it("lançar: gerencia ou responsável", () => {
    expect(podeLancarResultado({ permissoes: ["INDICADOR_GERENCIAR"], usuarioId: "u1" }, { responsavelId: null })).toBe(true);
    expect(podeLancarResultado({ permissoes: [], usuarioId: "u1" }, { responsavelId: "u1" })).toBe(true);
    expect(podeLancarResultado({ permissoes: [], usuarioId: "u2" }, { responsavelId: "u1" })).toBe(false);
  });
});

describe("indicadores automáticos — cálculo puro", () => {
  const periodo = { inicio: "2026-08-01", fim: "2026-08-31" };
  it("eficácia na 1ª verificação só conta verificações do período (no fuso)", () => {
    const vs = [
      { eficaz: true, verificadoEm: d("2026-08-10T12:00:00Z") },
      { eficaz: true, verificadoEm: d("2026-08-20T12:00:00Z") },
      { eficaz: false, verificadoEm: d("2026-08-25T12:00:00Z") },
      // 01/09 01:00 UTC = 31/08 22:00 em São Paulo → conta em agosto
      { eficaz: false, verificadoEm: d("2026-09-01T01:00:00Z") },
      { eficaz: true, verificadoEm: d("2026-09-05T12:00:00Z") },
    ];
    expect(calcularEficaciaPrimeiraVerificacao(vs, periodo, "America/Sao_Paulo")).toBe(50);
    expect(calcularEficaciaPrimeiraVerificacao([], periodo, "America/Sao_Paulo")).toBeNull();
  });
  it("itens atrasados: concluído após o prazo ou aberto vencido; cancelados fora", () => {
    const itens = [
      { status: "CONCLUIDO" as const, quando: d("2026-08-10"), dataConclusao: d("2026-08-09T15:00:00Z") }, // no prazo
      { status: "CONCLUIDO" as const, quando: d("2026-08-10"), dataConclusao: d("2026-08-15T15:00:00Z") }, // atrasado
      { status: "PENDENTE" as const, quando: d("2026-08-20"), dataConclusao: null }, // aberto vencido
      { status: "EM_ANDAMENTO" as const, quando: d("2026-08-31"), dataConclusao: null }, // vence depois de "hoje"
      { status: "CANCELADO" as const, quando: d("2026-08-05"), dataConclusao: null }, // fora
      { status: "PENDENTE" as const, quando: d("2026-09-02"), dataConclusao: null }, // fora do período
    ];
    expect(calcularItensAtrasados(itens, periodo, "2026-08-25", "America/Sao_Paulo")).toBe(50);
  });
});
