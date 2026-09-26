import { describe, expect, it } from "vitest";
import { calcularIndicadores, mesesDoPeriodo, periodoPadrao, type ItemIndicador, type RncIndicador } from "@/lib/indicadores/calculos";

const FUSO = "America/Sao_Paulo";
const d = (s: string) => new Date(s);

function rnc(p: Partial<RncIndicador>): RncIndicador {
  return {
    id: Math.random().toString(36), tipo: "QUALIDADE", gravidade: "MEDIA", status: "ABERTO", obraId: "o1", obraNome: "Obra 1",
    dataAbertura: d("2026-03-10T12:00:00Z"), encerradoEm: null, canceladoEm: null, primeiraVerificacao: null, ...p,
  };
}
const item = (p: Partial<ItemIndicador>): ItemIndicador => ({
  status: "PENDENTE", quando: d("2026-09-30T00:00:00Z"), quemId: "u1", quemNome: "Ana", ...p,
});

describe("período", () => {
  it("padrão = 12 meses corridos até hoje", () => {
    expect(periodoPadrao("2026-09-26")).toEqual({ inicio: "2025-10-01", fim: "2026-09-26" });
    expect(periodoPadrao("2026-12-05")).toEqual({ inicio: "2026-01-01", fim: "2026-12-05" });
    expect(mesesDoPeriodo(periodoPadrao("2026-09-26"))).toHaveLength(12);
  });
});

describe("calcularIndicadores", () => {
  const periodo = { inicio: "2026-01-01", fim: "2026-09-26" };
  const hoje = "2026-09-26";

  it("KPIs, mês no fuso da empresa e distribuições", () => {
    const rncs = [
      rnc({ tipo: "SSO", gravidade: "ALTA" }),
      // 01/02 02:00 UTC = 31/01 23:00 em São Paulo -> conta em janeiro
      rnc({ dataAbertura: d("2026-02-01T02:00:00Z"), status: "ENCERRADO", encerradoEm: d("2026-02-11T02:00:00Z"),
        primeiraVerificacao: { eficaz: true, verificadoEm: d("2026-02-10T12:00:00Z") } }),
      rnc({ dataAbertura: d("2026-04-01T12:00:00Z"), status: "ENCERRADO", encerradoEm: d("2026-04-21T12:00:00Z"),
        obraId: "o2", obraNome: "Obra 2", primeiraVerificacao: { eficaz: false, verificadoEm: d("2026-04-10T12:00:00Z") } }),
      rnc({ dataAbertura: d("2026-05-01T12:00:00Z"), status: "CANCELADO", canceladoEm: d("2026-05-02T12:00:00Z") }),
      rnc({ dataAbertura: d("2025-06-01T12:00:00Z"), status: "EM_ANALISE" }), // fora do período, mas aberta
    ];
    const itens = [
      item({ quando: d("2026-09-20T00:00:00Z") }),
      item({ quando: d("2026-09-01T00:00:00Z"), status: "EM_ANDAMENTO", quemId: "u2", quemNome: "Bia" }),
      item({ quando: d("2026-08-01T00:00:00Z"), quemId: "u2", quemNome: "Bia" }),
      item({ quando: d("2026-08-01T00:00:00Z"), status: "CONCLUIDO" }),
      item({}),
    ];
    const r = calcularIndicadores({ rncs, itens, periodo, fuso: FUSO, hoje });
    expect(r.kpis).toEqual({
      abertas: 2, encerradasPeriodo: 2, canceladasPeriodo: 1, itensAtrasados: 3,
      tempoMedioFechamentoDias: 15, eficaciaPrimeiraVerificacaoPct: 50,
    });
    expect(r.porMes.find((m) => m.mes === "2026-01")).toEqual({ mes: "2026-01", abertas: 1, encerradas: 0 });
    expect(r.porMes.find((m) => m.mes === "2026-02")).toEqual({ mes: "2026-02", abertas: 0, encerradas: 1 });
    expect(r.porMes).toHaveLength(9);
    expect(r.porTipo).toEqual([
      { chave: "QUALIDADE", rotulo: "QUALIDADE", valor: 3 },
      { chave: "SSO", rotulo: "SSO", valor: 1 },
    ]);
    expect(r.porObra[0]).toMatchObject({ chave: "o1", valor: 3 });
    expect(r.porGravidade.map((g) => g.chave)).toEqual(["MEDIA", "ALTA"]);
    expect(r.itensPorStatus.map((s) => [s.chave, s.valor])).toEqual([["PENDENTE", 1], ["ATRASADO", 3], ["CONCLUIDO", 1]]);
    expect(r.topAtrasados).toEqual([
      { chave: "u2", rotulo: "Bia", valor: 2 },
      { chave: "u1", rotulo: "Ana", valor: 1 },
    ]);
  });

  it("sem dados: KPIs nulos/zerados", () => {
    const r = calcularIndicadores({ rncs: [], itens: [], periodo, fuso: FUSO, hoje });
    expect(r.kpis.tempoMedioFechamentoDias).toBeNull();
    expect(r.kpis.eficaciaPrimeiraVerificacaoPct).toBeNull();
    expect(r.porTipo).toEqual([]);
    expect(r.porMes.every((m) => m.abertas === 0 && m.encerradas === 0)).toBe(true);
  });
});
