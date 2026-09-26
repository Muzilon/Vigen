import { describe, expect, it } from "vitest";
import { z } from "zod";
import { estaBloqueado, LIMITE_LOGIN } from "@/lib/auth/limite-login";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { validarAnalise } from "@/lib/rnc/analise";
import { podeGerenciarPlanoRnc, podeTratarRnc, podeVerDadosSensiveis } from "@/lib/rnc/servico";

const min = 60_000;
const t = (m: number) => new Date(Date.UTC(2026, 8, 26, 12, 0) + m * min);

describe("rate limit de login (M2)", () => {
  const falhas = (ms: number[]) => ms.map(t).sort((a, b) => +b - +a);
  it("bloqueia com 5 falhas em 15 min, por 15 min após a última", () => {
    const f = falhas([0, 1, 2, 3, 4]);
    expect(estaBloqueado(f, t(5), LIMITE_LOGIN.falhasPorEmail)).toBe(true);
    expect(estaBloqueado(f, t(18), LIMITE_LOGIN.falhasPorEmail)).toBe(true);
    expect(estaBloqueado(f, t(19), LIMITE_LOGIN.falhasPorEmail)).toBe(false);
  });
  it("não bloqueia com 4 falhas ou falhas espalhadas", () => {
    expect(estaBloqueado(falhas([0, 1, 2, 3]), t(4), 5)).toBe(false);
    expect(estaBloqueado(falhas([0, 10, 20, 30, 40]), t(41), 5)).toBe(false);
  });
});

describe("permissões de tratativa (B3) e dados sensíveis (B4)", () => {
  const u = "u1";
  const rnc = { responsavelId: u };
  it("responsável sem RNC_TRATAR não trata nem gerencia itens", () => {
    const a = { usuarioId: u, permissoes: ["RNC_ABRIR" as const] };
    expect(podeTratarRnc(a, rnc)).toBe(false);
    expect(podeGerenciarPlanoRnc(a, rnc)).toBe(false);
  });
  it("responsável com RNC_TRATAR trata; PLANO_GERENCIAR gerencia itens de qualquer RNC", () => {
    expect(podeTratarRnc({ usuarioId: u, permissoes: ["RNC_TRATAR"] }, rnc)).toBe(true);
    expect(podeTratarRnc({ usuarioId: "x", permissoes: ["RNC_TRATAR"] }, rnc)).toBe(false);
    expect(podeGerenciarPlanoRnc({ usuarioId: "x", permissoes: ["PLANO_GERENCIAR"] }, rnc)).toBe(true);
    expect(podeTratarRnc({ usuarioId: "x", permissoes: ["PLANO_GERENCIAR"] }, rnc)).toBe(false);
  });
  it("dados sensíveis só com RNC_VER_RESTRITAS", () => {
    expect(podeVerDadosSensiveis({ permissoes: ["RNC_TRATAR"] })).toBe(false);
    expect(podeVerDadosSensiveis({ permissoes: ["RNC_VER_RESTRITAS"] })).toBe(true);
  });
});

describe("validação da análise de causa (B5)", () => {
  it("aceita estruturas válidas", () => {
    expect(validarAnalise("CINCO_PORQUES", { porques: ["a", "b"] })).toEqual({ porques: ["a", "b"] });
    expect(validarAnalise("ISHIKAWA", { ishikawa: { metodo: "x" } })).toEqual({ ishikawa: { metodo: "x" } });
    expect(validarAnalise("OUTRO", { texto: "livre" })).toEqual({ texto: "livre" });
  });
  it("rejeita chaves extras, tamanho excessivo e método incompatível", () => {
    expect(() => validarAnalise("CINCO_PORQUES", { porques: ["a"], lixo: 1 })).toThrow();
    expect(() => validarAnalise("CINCO_PORQUES", { porques: ["x".repeat(2001)] })).toThrow(/excede/);
    expect(() => validarAnalise("CINCO_PORQUES", { porques: Array(11).fill("a") })).toThrow(/10/);
    expect(() => validarAnalise("ISHIKAWA", { ishikawa: { invalida: "x" } })).toThrow();
    expect(() => validarAnalise("OUTRO", { porques: [] })).toThrow();
  });
});

describe("filtros de URL (B1)", () => {
  const s = z.object({ status: enumUrl(["A", "B"]), id: uuidUrl });
  it("valor inválido é ignorado em vez de gerar erro", () => {
    expect(s.parse({ status: "XPTO", id: "nao-uuid" })).toEqual({ status: "", id: "" });
    expect(s.parse({ status: ["B", "A"], id: "3f0e8c7a-8a4f-4f7e-9d0b-2b1c3d4e5f60" })).toEqual({
      status: "B",
      id: "3f0e8c7a-8a4f-4f7e-9d0b-2b1c3d4e5f60",
    });
    expect(s.parse({})).toEqual({ status: "", id: "" });
  });
});
