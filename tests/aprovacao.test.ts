import { describe, expect, it } from "vitest";
import { aplicarDecisao, montarEtapas, normalizarComentario, validarAprovadores, type EtapaEstado } from "@/lib/aprovacao/regras";
import { ErroNegocio } from "@/lib/erros";

const etapas = (modo: "SEQUENCIAL" | "PARALELO", ids: string[]): EtapaEstado[] =>
  montarEtapas(modo, ids).map((e) => ({ ...e, id: `e${e.ordem}` }));

describe("validarAprovadores", () => {
  const ativos = new Set(["a", "b", "c"]);
  it("aceita lista válida", () => expect(() => validarAprovadores("s", ["a", "b"], ativos)).not.toThrow());
  it("exige ao menos um", () => expect(() => validarAprovadores("s", [], ativos)).toThrow(ErroNegocio));
  it("proíbe repetidos", () => expect(() => validarAprovadores("s", ["a", "a"], ativos)).toThrow(/repetido/));
  it("proíbe autoaprovação", () => expect(() => validarAprovadores("a", ["a", "b"], new Set(["a", "b"]))).toThrow(/solicitante/));
  it("proíbe inativo/desconhecido", () => expect(() => validarAprovadores("s", ["a", "x"], ativos)).toThrow(/inativo/));
});

describe("montarEtapas", () => {
  it("sequencial: 1ª PENDENTE, demais AGUARDANDO", () => {
    expect(montarEtapas("SEQUENCIAL", ["a", "b", "c"]).map((e) => e.status)).toEqual(["PENDENTE", "AGUARDANDO", "AGUARDANDO"]);
  });
  it("paralelo: todas PENDENTE, ordem preservada", () => {
    const e = montarEtapas("PARALELO", ["a", "b"]);
    expect(e.map((x) => [x.ordem, x.aprovadorId, x.status])).toEqual([[1, "a", "PENDENTE"], [2, "b", "PENDENTE"]]);
  });
});

describe("aplicarDecisao", () => {
  it("sequencial: aprovação libera a próxima", () => {
    const r = aplicarDecisao(etapas("SEQUENCIAL", ["a", "b", "c"]), "a", "APROVAR");
    expect(r.statusFluxo).toBe("PENDENTE");
    expect(r.mudancas).toEqual([{ id: "e1", status: "APROVADA" }, { id: "e2", status: "PENDENTE" }]);
    expect(r.novasPendentes.map((e) => e.aprovadorId)).toEqual(["b"]);
  });
  it("sequencial: quem não está na vez não decide", () => {
    expect(() => aplicarDecisao(etapas("SEQUENCIAL", ["a", "b"]), "b", "APROVAR")).toThrow(ErroNegocio);
  });
  it("última aprovação conclui como APROVADO", () => {
    const es = etapas("SEQUENCIAL", ["a", "b"]).map((e) => (e.ordem === 1 ? { ...e, status: "APROVADA" as const } : { ...e, status: "PENDENTE" as const }));
    expect(aplicarDecisao(es, "b", "APROVAR").statusFluxo).toBe("APROVADO");
  });
  it("paralelo: aprova sem liberar ninguém até o último", () => {
    const es = etapas("PARALELO", ["a", "b"]);
    const r = aplicarDecisao(es, "b", "APROVAR");
    expect(r.statusFluxo).toBe("PENDENTE");
    expect(r.novasPendentes).toEqual([]);
    const es2 = es.map((e) => (e.aprovadorId === "b" ? { ...e, status: "APROVADA" as const } : e));
    expect(aplicarDecisao(es2, "a", "APROVAR").statusFluxo).toBe("APROVADO");
  });
  it("rejeição encerra e ignora as demais", () => {
    const r = aplicarDecisao(etapas("SEQUENCIAL", ["a", "b", "c"]), "a", "REJEITAR");
    expect(r.statusFluxo).toBe("REJEITADO");
    expect(r.mudancas).toEqual([
      { id: "e1", status: "REJEITADA" },
      { id: "e2", status: "IGNORADA" },
      { id: "e3", status: "IGNORADA" },
    ]);
  });
  it("não aprovador não decide", () => {
    expect(() => aplicarDecisao(etapas("PARALELO", ["a"]), "z", "APROVAR")).toThrow(ErroNegocio);
  });
});

describe("normalizarComentario", () => {
  it("rejeição exige comentário", () => expect(() => normalizarComentario("REJEITAR", "  ")).toThrow(/motivo/));
  it("aprovação aceita vazio", () => expect(normalizarComentario("APROVAR", " ")).toBeNull());
  it("apara o texto", () => expect(normalizarComentario("REJEITAR", " ok ")).toBe("ok"));
});
