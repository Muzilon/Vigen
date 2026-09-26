import { describe, expect, it } from "vitest";
import type { Permissao } from "@prisma/client";
import type { Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";
import {
  filtroAcessoPlanoManual,
  filtroGestaoPlanoManual,
  linkPlano,
  obraDoPlanoAcessivel,
  podeGerenciarPlanoManual,
} from "@/lib/plano-acao/acesso";
import { criarPlanoManual } from "@/lib/plano-acao/servico";

const eu = "00000000-0000-0000-0000-000000000001";
const alfa = "00000000-0000-0000-0000-00000000000a";
const beta = "00000000-0000-0000-0000-00000000000b";

function ator(permissoes: Permissao[], obras: string[] | null): Ator {
  // db que falha se usado: as regras abaixo devem ser checadas antes de tocar no banco.
  const db = new Proxy({}, { get: () => { throw new Error("db não deveria ser usado"); } }) as Ator["db"];
  return { db, empresaId: "e", usuarioId: eu, permissoes, obrasPermitidas: obras };
}

const item = { oQue: "Ação", quemId: eu, quando: "2026-10-01" };

describe("acesso a planos avulsos", () => {
  it("obra do plano: sem obra é da empresa toda; com obra exige acesso", () => {
    expect(obraDoPlanoAcessivel({ obrasPermitidas: [] }, { obraId: null })).toBe(true);
    expect(obraDoPlanoAcessivel({ obrasPermitidas: null }, { obraId: alfa })).toBe(true);
    expect(obraDoPlanoAcessivel({ obrasPermitidas: [alfa] }, { obraId: alfa })).toBe(true);
    expect(obraDoPlanoAcessivel({ obrasPermitidas: [beta] }, { obraId: alfa })).toBe(false);
  });

  it("gerenciar exige PLANO_GERENCIAR e acesso à obra", () => {
    expect(podeGerenciarPlanoManual(ator(["PLANO_GERENCIAR"], null), { obraId: alfa })).toBe(true);
    expect(podeGerenciarPlanoManual(ator(["PLANO_GERENCIAR"], [beta]), { obraId: alfa })).toBe(false);
    expect(podeGerenciarPlanoManual(ator(["PLANO_GERENCIAR"], [beta]), { obraId: null })).toBe(true);
    expect(podeGerenciarPlanoManual(ator(["RNC_TRATAR"], null), { obraId: null })).toBe(false);
  });

  it("filtro de gestão: criador sempre; PLANO_GERENCIAR limitado às obras", () => {
    expect(filtroGestaoPlanoManual(ator([], null))).toEqual({ rnc: { is: null }, OR: [{ criadoPorId: eu }] });
    expect(filtroGestaoPlanoManual(ator(["PLANO_GERENCIAR"], null))).toEqual({ rnc: { is: null }, OR: [{ criadoPorId: eu }, {}] });
    expect(filtroGestaoPlanoManual(ator(["PLANO_GERENCIAR"], [alfa]))).toEqual({
      rnc: { is: null },
      OR: [{ criadoPorId: eu }, { OR: [{ obraId: null }, { obraId: { in: [alfa] } }] }],
    });
  });

  it("filtro de acesso inclui o quem de algum item", () => {
    const f = filtroAcessoPlanoManual(ator([], [alfa]));
    expect(f.OR).toContainEqual({ itens: { some: { quemId: eu } } });
    expect(linkPlano("x")).toBe("/plano-acao/planos/x");
  });
});

describe("criarPlanoManual — regras antes do banco", () => {
  it("exige PLANO_GERENCIAR", async () => {
    await expect(criarPlanoManual(ator(["RNC_TRATAR"], null), { titulo: "Plano", itens: [item] })).rejects.toThrow(/permissão/);
  });
  it("exige ao menos um item e no máximo 50", async () => {
    const a = ator(["PLANO_GERENCIAR"], null);
    await expect(criarPlanoManual(a, { titulo: "Plano", itens: [] })).rejects.toThrow(/ao menos um item/);
    await expect(criarPlanoManual(a, { titulo: "Plano", itens: Array(51).fill(item) })).rejects.toThrow(/50/);
  });
  it("valida título, prazo e obra acessível", async () => {
    const a = ator(["PLANO_GERENCIAR"], [beta]);
    await expect(criarPlanoManual(a, { titulo: " ab ", itens: [item] })).rejects.toBeInstanceOf(ErroNegocio);
    await expect(criarPlanoManual(a, { titulo: "Plano", itens: [{ ...item, quando: "01/10/2026" }] })).rejects.toThrow(/Prazo/);
    await expect(criarPlanoManual(a, { titulo: "Plano", obraId: alfa, itens: [item] })).rejects.toThrow(/Obra/);
  });
});
