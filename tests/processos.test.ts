import { describe, expect, it } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import {
  diffIndicadores,
  montarLayoutMapa,
  montarSnapshot,
  moverNaRaia,
  nomesIndicadores,
  normalizarCodigo,
  normalizarProcesso,
} from "@/lib/processos/regras";

describe("normalização", () => {
  it("código em maiúsculas e validado", () => {
    expect(normalizarCodigo("  pf-01 ")).toBe("PF-01");
    expect(() => normalizarCodigo("")).toThrow(ErroNegocio);
    expect(() => normalizarCodigo("PF 01")).toThrow(/Código/);
    expect(() => normalizarCodigo("X".repeat(21))).toThrow(/20/);
  });

  it("processo: nome obrigatório, textos vazios viram null, tipo validado", () => {
    const p = normalizarProcesso({ codigo: "pg-1", nome: "  Gestão  ", tipo: "GESTAO", entradas: "  ", donoId: "" });
    expect(p).toMatchObject({ codigo: "PG-1", nome: "Gestão", entradas: null, donoId: null });
    expect(() => normalizarProcesso({ codigo: "A", nome: "x", tipo: "GESTAO" })).toThrow(/nome/);
    expect(() => normalizarProcesso({ codigo: "A", nome: "Nome", tipo: "OUTRO" as never })).toThrow(/Tipo/);
  });
});

describe("indicadores da planilha", () => {
  it("um por linha, sem vazios nem repetidos (ignora maiúsculas)", () => {
    expect(nomesIndicadores("A\n\n b \na\r\nC")).toEqual(["A", "b", "C"]);
  });

  it("diff mantém por nome, cria novos e remove os ausentes", () => {
    const atuais = [
      { id: "1", nome: "Prazo" },
      { id: "2", nome: "Custo" },
    ];
    const r = diffIndicadores(atuais, ["Satisfação", "prazo"]);
    expect(r.manter).toEqual([{ id: "1", ordem: 2 }]);
    expect(r.criar).toEqual([{ nome: "Satisfação", ordem: 1 }]);
    expect(r.remover).toEqual(["2"]);
  });
});

describe("reordenação", () => {
  it("move uma posição e respeita os limites", () => {
    expect(moverNaRaia(["a", "b", "c"], "b", "cima")).toEqual(["b", "a", "c"]);
    expect(moverNaRaia(["a", "b", "c"], "b", "baixo")).toEqual(["a", "c", "b"]);
    expect(moverNaRaia(["a", "b"], "a", "cima")).toBeNull();
    expect(moverNaRaia(["a", "b"], "b", "baixo")).toBeNull();
    expect(moverNaRaia(["a"], "x", "cima")).toBeNull();
  });
});

describe("snapshot", () => {
  it("é determinístico e ordena indicadores/interações", () => {
    const base = {
      codigo: "PF-01",
      nome: "Obra",
      tipo: "FINALISTICO" as const,
      ordem: 1,
      objetivo: null,
      dono: { id: "u", nome: "Ana" },
      entradas: "E",
      saidas: "S",
      fornecedores: null,
      clientes: null,
      recursos: null,
      indicadores: [
        { nome: "B", meta: null, unidade: null, periodicidade: null, ordem: 2 },
        { nome: "A", meta: "1", unidade: "%", periodicidade: "Mensal", ordem: 1 },
      ],
      interacoesOrigem: [
        { descricao: null, destino: { codigo: "PF-03", nome: "C" } },
        { descricao: "x", destino: { codigo: "PF-02", nome: "B" } },
      ],
      interacoesDestino: [],
    };
    const s = montarSnapshot(base);
    expect(s.indicadores.map((i) => i.nome)).toEqual(["A", "B"]);
    expect(s.interacoes.saida.map((i) => i.codigo)).toEqual(["PF-02", "PF-03"]);
    expect(s.dono).toEqual({ id: "u", nome: "Ana" });
    expect(montarSnapshot(base)).toEqual(s);
  });
});

describe("layout do mapa", () => {
  const procs = [
    { id: "g1", codigo: "PG-01", nome: "Estratégia", tipo: "GESTAO" as const, ordem: 1 },
    { id: "f2", codigo: "PF-02", nome: "Execução", tipo: "FINALISTICO" as const, ordem: 2 },
    { id: "f1", codigo: "PF-01", nome: "Comercial", tipo: "FINALISTICO" as const, ordem: 1 },
    { id: "a1", codigo: "PA-01", nome: "Compras", tipo: "APOIO" as const, ordem: 1 },
  ];

  it("3 raias na ordem Gestão, Finalísticos, Apoio; caixas pela ordem", () => {
    const L = montarLayoutMapa(procs, []);
    expect(L.raias.map((r) => r.tipo)).toEqual(["GESTAO", "FINALISTICO", "APOIO"]);
    const y = (id: string) => L.caixas.find((c) => c.id === id)!.y;
    expect(y("g1")).toBeLessThan(y("f1"));
    expect(y("f1")).toBeLessThan(y("a1"));
    const x = (id: string) => L.caixas.find((c) => c.id === id)!.x;
    expect(x("f1")).toBeLessThan(x("f2"));
  });

  it("setas cliente → finalísticos → cliente e interações sem duplicar a sequência", () => {
    const L = montarLayoutMapa(procs, [
      { origemId: "f1", destinoId: "f2", descricao: null }, // adjacente: já é fluxo
      { origemId: "a1", destinoId: "f2", descricao: "materiais" },
      { origemId: "g1", destinoId: "zz", descricao: null }, // destino inexistente: ignorada
    ]);
    expect(L.setas.filter((s) => s.tipo === "fluxo")).toHaveLength(3);
    const inter = L.setas.filter((s) => s.tipo === "interacao");
    expect(inter).toHaveLength(1);
    expect(inter[0].titulo).toContain("PA-01 → PF-02: materiais");
  });
});
