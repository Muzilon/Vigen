import { describe, expect, it } from "vitest";
import { filtroObraRequisito, podeGerenciarRequisitos, podeVerificarRequisito } from "@/lib/requisitos-legais/acesso";
import {
  contarPorStatus,
  exigirPlanoSeNecessario,
  percentualAtendimento,
  statusExigePlano,
  tituloPlanoRequisito,
  verificacaoVencida,
} from "@/lib/requisitos-legais/regras";
import { ErroNegocio } from "@/lib/erros";
import { permissoesEfetivas } from "@/lib/permissoes";

describe("requisitos legais — plano de ação", () => {
  it("não atende / parcial exigem plano; demais não", () => {
    expect(statusExigePlano("NAO_ATENDE")).toBe(true);
    expect(statusExigePlano("ATENDE_PARCIAL")).toBe(true);
    expect(statusExigePlano("ATENDE")).toBe(false);
    expect(statusExigePlano("EM_ANALISE")).toBe(false);
    expect(statusExigePlano("NAO_APLICAVEL")).toBe(false);
    expect(() => exigirPlanoSeNecessario("NAO_ATENDE", false)).toThrow(ErroNegocio);
    expect(() => exigirPlanoSeNecessario("NAO_ATENDE", true)).not.toThrow();
    expect(() => exigirPlanoSeNecessario("ATENDE", false)).not.toThrow();
  });

  it("título do plano limitado a 200 caracteres", () => {
    expect(tituloPlanoRequisito({ codigo: "LEG-001-26", numero: "NR-35", titulo: "x".repeat(400) }).length).toBeLessThanOrEqual(200);
  });
});

describe("requisitos legais — vencimento e atendimento", () => {
  it("verificação vencida só antes de hoje e nunca para não aplicável", () => {
    expect(verificacaoVencida("2026-09-25", "2026-09-26")).toBe(true);
    expect(verificacaoVencida("2026-09-26", "2026-09-26")).toBe(false);
    expect(verificacaoVencida(null, "2026-09-26")).toBe(false);
    expect(verificacaoVencida("2020-01-01", "2026-09-26", "NAO_APLICAVEL")).toBe(false);
  });

  it("% de atendimento ignora não aplicável e em análise", () => {
    expect(percentualAtendimento([])).toBeNull();
    expect(percentualAtendimento(["NAO_APLICAVEL", "EM_ANALISE"])).toBeNull();
    expect(percentualAtendimento(["ATENDE", "ATENDE", "NAO_ATENDE", "ATENDE_PARCIAL", "NAO_APLICAVEL"])).toBe(50);
    expect(percentualAtendimento(["ATENDE", "ATENDE", "ATENDE_PARCIAL"])).toBe(67);
    expect(contarPorStatus(["ATENDE", "ATENDE", "EM_ANALISE"])).toMatchObject({ ATENDE: 2, EM_ANALISE: 1, NAO_ATENDE: 0 });
  });
});

describe("requisitos legais — acesso", () => {
  it("gerenciar só com REQUISITO_LEGAL_GERENCIAR; verificar também pelo responsável", () => {
    const admin = { permissoes: permissoesEfetivas("ADMIN"), usuarioId: "a" };
    const colab = { permissoes: permissoesEfetivas("COLABORADOR"), usuarioId: "c" };
    expect(podeGerenciarRequisitos(admin)).toBe(true);
    expect(podeGerenciarRequisitos(colab)).toBe(false);
    expect(podeVerificarRequisito(colab, { responsavelId: "c" })).toBe(true);
    expect(podeVerificarRequisito(colab, { responsavelId: "x" })).toBe(false);
    expect(podeVerificarRequisito(colab, { responsavelId: null })).toBe(false);
  });

  it("escopo: sem obra = empresa toda", () => {
    expect(filtroObraRequisito({ obrasPermitidas: null })).toEqual({});
    expect(filtroObraRequisito({ obrasPermitidas: ["o1"] })).toEqual({ OR: [{ obraId: null }, { obraId: { in: ["o1"] } }] });
  });
});
