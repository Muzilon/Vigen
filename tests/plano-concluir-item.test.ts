import { describe, expect, it } from "vitest";
import type { Permissao } from "@prisma/client";
import { podeConcluirItem } from "@/lib/plano-acao/acesso";

const OBRA_A = "00000000-0000-4000-8000-0000000000a1";
const OBRA_B = "00000000-0000-4000-8000-0000000000b2";

const ator = (usuarioId: string, permissoes: Permissao[] = [], obrasPermitidas: string[] | null = null) => ({ usuarioId, permissoes, obrasPermitidas });
const itemManual = (quemId: string, obraId: string | null = null) => ({ quemId, planoAcao: { obraId, rnc: null } });
const itemRnc = (quemId: string) => ({ quemId, planoAcao: { obraId: null, rnc: { id: "rnc-1" } } });

describe("podeConcluirItem — quem registra a conclusão de uma ação", () => {
  it("o responsável conclui o próprio item", () => {
    expect(podeConcluirItem(ator("u1"), itemManual("u1"))).toBe(true);
    expect(podeConcluirItem(ator("u1"), itemRnc("u1"), false)).toBe(true);
  });

  it("outro colaborador sem PLANO_GERENCIAR não conclui", () => {
    expect(podeConcluirItem(ator("u2"), itemManual("u1"))).toBe(false);
    expect(podeConcluirItem(ator("u2"), itemRnc("u1"))).toBe(false);
  });

  it("qualidade/administração (PLANO_GERENCIAR) conclui item de outra pessoa", () => {
    const qualidade = ator("q1", ["PLANO_GERENCIAR"]);
    expect(podeConcluirItem(qualidade, itemManual("u1"))).toBe(true);
    expect(podeConcluirItem(qualidade, itemRnc("u1"), true)).toBe(true);
  });

  it("em item de RNC, o acesso à RNC é exigido", () => {
    expect(podeConcluirItem(ator("q1", ["PLANO_GERENCIAR"]), itemRnc("u1"), false)).toBe(false);
  });

  it("em plano avulso com unidade, a qualidade precisa de acesso à unidade", () => {
    const soB = ator("q1", ["PLANO_GERENCIAR"], [OBRA_B]);
    expect(podeConcluirItem(soB, itemManual("u1", OBRA_A))).toBe(false);
    expect(podeConcluirItem(soB, itemManual("u1", OBRA_B))).toBe(true);
    expect(podeConcluirItem(soB, itemManual("u1", null))).toBe(true);
  });
});
