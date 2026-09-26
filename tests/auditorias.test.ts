import { describe, expect, it } from "vitest";
import { filtroObraAuditoria, podeExecutarAuditoria, podeGerenciarAuditorias } from "@/lib/auditorias/acesso";
import {
  contarPorTipo,
  descricaoRncDaConstatacao,
  exigirStatus,
  origemRncDaAuditoria,
  permitido,
  tipoRncDaNorma,
  tituloRncDaConstatacao,
} from "@/lib/auditorias/regras";
import { ErroNegocio } from "@/lib/erros";
import { permissoesEfetivas } from "@/lib/permissoes";

describe("auditorias — máquina de status", () => {
  it("transições", () => {
    expect(permitido("PLANEJADA", "INICIAR")).toBe(true);
    expect(permitido("EM_EXECUCAO", "INICIAR")).toBe(false);
    expect(permitido("EM_EXECUCAO", "CONCLUIR")).toBe(true);
    expect(permitido("CONCLUIDA", "CANCELAR")).toBe(false);
    expect(permitido("PLANEJADA", "CONSTATAR")).toBe(false);
    expect(permitido("EM_EXECUCAO", "CONSTATAR")).toBe(true);
    expect(permitido("CONCLUIDA", "GERAR_RNC")).toBe(true);
    expect(permitido("CANCELADA", "GERAR_RNC")).toBe(false);
    expect(permitido("CONCLUIDA", "EDITAR_PLANO")).toBe(false);
    expect(() => exigirStatus("PLANEJADA", "CONCLUIR")).toThrow(ErroNegocio);
  });
});

describe("auditorias — RNC da constatação", () => {
  it("origem conforme o tipo (enum OrigemRnc existente)", () => {
    expect(origemRncDaAuditoria("INTERNA")).toBe("AUDITORIA_INTERNA");
    expect(origemRncDaAuditoria("EXTERNA_CERTIFICACAO")).toBe("AUDITORIA_EXTERNA");
  });
  it("tipo pela norma", () => {
    expect(tipoRncDaNorma("ISO 45001:2018")).toBe("SSO");
    expect(tipoRncDaNorma("ISO 14001")).toBe("MEIO_AMBIENTE");
    expect(tipoRncDaNorma("ISO 9001")).toBe("QUALIDADE");
  });
  it("título e descrição com requisito e evidência", () => {
    expect(tituloRncDaConstatacao("AUD-001-26", "Registros ausentes")).toBe("Auditoria AUD-001-26: Registros ausentes");
    const d = descricaoRncDaConstatacao({ codigo: "AUD-001-26", tipoAuditoria: "INTERNA", norma: "ISO 9001", requisito: "7.5.3", descricao: "Sem controle", evidencia: "Pasta X", auditor: "Ana" });
    expect(d).toContain("Requisito: 7.5.3");
    expect(d).toContain("Evidência: Pasta X");
    expect(d).toContain("interna");
  });
  it("contagem por tipo", () => {
    expect(contarPorTipo([{ tipo: "NAO_CONFORMIDADE" }, { tipo: "NAO_CONFORMIDADE" }, { tipo: "PONTO_FORTE" }])).toEqual({ NAO_CONFORMIDADE: 2, OBSERVACAO: 0, OPORTUNIDADE_MELHORIA: 0, PONTO_FORTE: 1 });
  });
});

describe("auditorias — acesso", () => {
  it("escopo: sem obra = todos; com obra = no escopo", () => {
    expect(filtroObraAuditoria({ obrasPermitidas: null })).toEqual({});
    expect(filtroObraAuditoria({ obrasPermitidas: ["o1"] })).toEqual({ OR: [{ obraId: null }, { obraId: { in: ["o1"] } }] });
  });
  it("gerenciar e executar", () => {
    const adm = { permissoes: permissoesEfetivas("ADMIN"), usuarioId: "a" };
    const realizador = { permissoes: [...permissoesEfetivas("INSPETOR"), "AUDITORIA_REALIZAR" as const], usuarioId: "l" };
    const colab = { permissoes: permissoesEfetivas("COLABORADOR"), usuarioId: "c" };
    expect(podeGerenciarAuditorias(adm)).toBe(true);
    expect(podeGerenciarAuditorias(realizador)).toBe(false);
    expect(podeExecutarAuditoria(realizador, { auditorLiderId: "l" })).toBe(true);
    expect(podeExecutarAuditoria(realizador, { auditorLiderId: "x" })).toBe(false);
    expect(podeExecutarAuditoria(colab, { auditorLiderId: "c" })).toBe(false);
  });
});
