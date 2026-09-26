import { describe, expect, it } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import { podeExecutarInspecao, podeGerenciarModelos, podeRealizarInspecao } from "@/lib/inspecoes/acesso";
import {
  classificar,
  contarRespostas,
  descricaoRncDaResposta,
  moverNaLista,
  normalizarResposta,
  pendenciasConclusao,
  percentualConformidade,
  textoResposta,
  tipoRncDoChecklist,
  tituloRncDaResposta,
} from "@/lib/inspecoes/regras";
import { formatarCodigoAnual } from "@/lib/rnc/numeracao";
import { permissoesEfetivas } from "@/lib/permissoes";

const r = (x: Partial<Parameters<typeof classificar>[0]>) => ({ tipoResposta: "CONFORME_NAO_CONFORME_NA" as const, resposta: null, nota: null, texto: null, ...x });

describe("inspeções — classificação", () => {
  it("C/NC/NA", () => {
    expect(classificar(r({ resposta: "CONFORME" }), 3)).toBe("CONFORME");
    expect(classificar(r({ resposta: "NAO_CONFORME" }), 3)).toBe("NAO_CONFORME");
    expect(classificar(r({ resposta: "NAO_APLICAVEL" }), 3)).toBe("NAO_APLICAVEL");
    expect(classificar(r({}), 3)).toBe("PENDENTE");
  });
  it("SIM = conforme, NÃO = não conforme", () => {
    expect(classificar(r({ tipoResposta: "SIM_NAO", resposta: "SIM" }), 3)).toBe("CONFORME");
    expect(classificar(r({ tipoResposta: "SIM_NAO", resposta: "NAO" }), 3)).toBe("NAO_CONFORME");
  });
  it("nota abaixo do limite do modelo = não conforme", () => {
    expect(classificar(r({ tipoResposta: "NOTA_1A5", nota: 2 }), 3)).toBe("NAO_CONFORME");
    expect(classificar(r({ tipoResposta: "NOTA_1A5", nota: 3 }), 3)).toBe("CONFORME");
    expect(classificar(r({ tipoResposta: "NOTA_1A5", nota: 3 }), 4)).toBe("NAO_CONFORME");
  });
  it("texto é informativo", () => {
    expect(classificar(r({ tipoResposta: "TEXTO", texto: "ok" }), 3)).toBe("INFORMATIVA");
  });
});

describe("inspeções — % de conformidade e pendências", () => {
  const lista = [
    r({ resposta: "CONFORME" }),
    r({ resposta: "NAO_CONFORME" }),
    r({ resposta: "NAO_APLICAVEL" }),
    r({ tipoResposta: "SIM_NAO", resposta: "SIM" }),
    r({ tipoResposta: "NOTA_1A5", nota: 5 }),
    r({ tipoResposta: "TEXTO", texto: "obs" }),
  ];
  it("ignora N/A e texto", () => {
    expect(percentualConformidade(lista, 3)).toBe(75);
    expect(percentualConformidade([r({ resposta: "NAO_APLICAVEL" })], 3)).toBeNull();
  });
  it("contagem", () => {
    expect(contarRespostas(lista, 3)).toEqual({ total: 6, respondidas: 6, conformes: 3, naoConformes: 1, naoAplicaveis: 1 });
  });
  it("pendências: sem resposta e foto obrigatória só em NC", () => {
    const itens = [
      { ...r({}), ordem: 1, obrigatorioFoto: false, fotos: 0 },
      { ...r({ resposta: "NAO_CONFORME" }), ordem: 2, obrigatorioFoto: true, fotos: 0 },
      { ...r({ resposta: "CONFORME" }), ordem: 3, obrigatorioFoto: true, fotos: 0 },
      { ...r({ tipoResposta: "TEXTO" }), ordem: 4, obrigatorioFoto: false, fotos: 0 },
    ];
    const p = pendenciasConclusao(itens, 3);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatch(/pergunta\(s\) 1\./);
    expect(p[1]).toMatch(/foto.*2\./);
    expect(pendenciasConclusao([{ ...itens[1], fotos: 1 }], 3)).toEqual([]);
  });
});

describe("inspeções — normalização da resposta", () => {
  it("valida pelo tipo", () => {
    expect(normalizarResposta("CONFORME_NAO_CONFORME_NA", { resposta: "NAO_CONFORME", comentario: "  x " })).toEqual({ resposta: "NAO_CONFORME", nota: null, texto: null, comentario: "x" });
    expect(() => normalizarResposta("CONFORME_NAO_CONFORME_NA", { resposta: "SIM" })).toThrow(ErroNegocio);
    expect(() => normalizarResposta("SIM_NAO", { resposta: "CONFORME" })).toThrow(ErroNegocio);
    expect(normalizarResposta("NOTA_1A5", { nota: "4" }).nota).toBe(4);
    expect(() => normalizarResposta("NOTA_1A5", { nota: 6 })).toThrow(ErroNegocio);
    expect(() => normalizarResposta("TEXTO", { texto: "  " })).toThrow(ErroNegocio);
  });
});

describe("inspeções — RNC gerada, códigos e ordem", () => {
  it("tipo da RNC pelo checklist", () => {
    expect(tipoRncDoChecklist("SSO")).toBe("SSO");
    expect(tipoRncDoChecklist("MEIO_AMBIENTE")).toBe("MEIO_AMBIENTE");
    expect(tipoRncDoChecklist("GERAL")).toBe("QUALIDADE");
  });
  it("título e descrição a partir da pergunta + comentário", () => {
    expect(tituloRncDaResposta("Guarda-corpo instalado?")).toBe("Inspeção: Guarda-corpo instalado?");
    expect(tituloRncDaResposta("x".repeat(300))).toHaveLength(200);
    const d = descricaoRncDaResposta({ codigo: "INSP-001-26", modelo: "Segurança", data: "01/09/2026", inspetor: "Ana", obra: "Obra Alfa", pergunta: "EPI?", resposta: "Não conforme", comentario: "Sem capacete" });
    expect(d).toContain("INSP-001-26");
    expect(d).toContain("Pergunta: EPI?");
    expect(d).toContain("Comentário do inspetor: Sem capacete");
    expect(textoResposta(r({ tipoResposta: "NOTA_1A5", nota: 2 }))).toBe("Nota 2");
  });
  it("código INSP-NNN-AA", () => {
    expect(formatarCodigoAnual("INSP", 7, 2026)).toBe("INSP-007-26");
    expect(() => formatarCodigoAnual("INSP", 0, 2026)).toThrow(ErroNegocio);
  });
  it("mover item na lista", () => {
    const l = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moverNaLista(l, "b", "cima").map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(moverNaLista(l, "c", "baixo").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("inspeções — permissões", () => {
  it("inspetor realiza; colaborador não; admin gerencia", () => {
    const insp = { permissoes: permissoesEfetivas("INSPETOR"), usuarioId: "u1" };
    const colab = { permissoes: permissoesEfetivas("COLABORADOR"), usuarioId: "u2" };
    const adm = { permissoes: permissoesEfetivas("ADMIN"), usuarioId: "u3" };
    expect(podeRealizarInspecao(insp)).toBe(true);
    expect(podeRealizarInspecao(colab)).toBe(false);
    expect(podeGerenciarModelos(insp)).toBe(false);
    expect(podeGerenciarModelos(adm)).toBe(true);
    expect(podeExecutarInspecao(insp, { inspetorId: "u1" })).toBe(true);
    expect(podeExecutarInspecao(insp, { inspetorId: "outro" })).toBe(false);
    expect(podeExecutarInspecao(adm, { inspetorId: "outro" })).toBe(true);
  });
});
