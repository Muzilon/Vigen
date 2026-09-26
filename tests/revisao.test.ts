import { describe, expect, it } from "vitest";
import { esquemaAcessoUsuario, esquemaNovoUsuario, esquemaPerfil } from "@/lib/admin/servico";
import { errosMetadados } from "@/lib/anexos/servico";
import { MIME, MIMES_INLINE } from "@/lib/anexos/validacao";
import { descricaoItem, rncSensivel, rotuloRnc } from "@/lib/notificacoes/gatilhos";

const MB = 1024 * 1024;

describe("B3: pré-validação só com metadados", () => {
  it("rejeita acima do limite e excesso de arquivos sem ler o conteúdo", () => {
    expect(errosMetadados([{ nome: "a.pdf", tamanho: 11 * MB }], 10 * MB)).toEqual(["a.pdf: excede o limite de 10 MB."]);
    expect(errosMetadados(Array.from({ length: 6 }, (_, i) => ({ nome: `${i}.png`, tamanho: 1 })), 10 * MB)[0]).toMatch(/no máximo 5/);
    expect(errosMetadados([{ nome: "ok.png", tamanho: 10 * MB }], 10 * MB)).toEqual([]);
  });
});

describe("B5: PDF nunca inline", () => {
  it("apenas imagens seguras são exibidas inline", () => {
    expect(MIMES_INLINE.has(MIME.pdf)).toBe(false);
    expect(MIMES_INLINE.has(MIME.png)).toBe(true);
  });
});

describe("M2: sem texto livre de RNC restrita/dados pessoais", () => {
  const base = { codigo: "RNC-001-26", titulo: "Acidente com João" };
  it("rótulo omite o título quando restrita ou com dados pessoais", () => {
    expect(rotuloRnc({ ...base, restrita: false })).toBe("RNC RNC-001-26 — Acidente com João");
    expect(rotuloRnc({ ...base, restrita: true })).toBe("RNC RNC-001-26");
    expect(rotuloRnc({ ...base, restrita: false, contemDadosPessoais: true })).toBe("RNC RNC-001-26");
    expect(rncSensivel(null)).toBe(false);
  });
  it("descrição do item omite o oQue quando a RNC é sensível", () => {
    const item = (rnc: Parameters<typeof descricaoItem>[0]["planoAcao"]["rnc"]) => ({ oQue: "Afastar João", planoAcao: { rnc } });
    expect(descricaoItem(item({ ...base, restrita: false, contemDadosPessoais: true }))).toBe("Item de ação da RNC RNC-001-26");
    expect(descricaoItem(item({ ...base, restrita: false }))).toContain("Afastar João");
    expect(descricaoItem(item(null))).toBe("Afastar João");
  });
});

describe("Administração: validação (zod)", () => {
  const ok = { nome: "Fulano", email: " Fulano@Ex.com ", papel: "INSPETOR", escopoObras: "TODAS" };
  it("normaliza e-mail e aplica defaults", () => {
    const d = esquemaAcessoUsuario.parse({ ...ok, perfilId: "", setorId: "" });
    expect(d.email).toBe("fulano@ex.com");
    expect(d.perfilId).toBeNull();
    expect(d.obraIds).toEqual([]);
  });
  it("rejeita papel/escopo/senha/permissão inválidos", () => {
    expect(esquemaAcessoUsuario.safeParse({ ...ok, papel: "ROOT" }).success).toBe(false);
    expect(esquemaAcessoUsuario.safeParse({ ...ok, escopoObras: "ALGUMAS" }).success).toBe(false);
    expect(esquemaNovoUsuario.safeParse({ ...ok, senha: "123" }).success).toBe(false);
    expect(esquemaPerfil.safeParse({ nome: "Perfil", permissoes: ["SUPERPODER"] }).success).toBe(false);
    expect(esquemaPerfil.safeParse({ nome: "Perfil", permissoes: ["RNC_TRATAR"] }).success).toBe(true);
  });
});
