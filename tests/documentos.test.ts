import { describe, expect, it } from "vitest";
import { canalAprovacao } from "@/lib/aprovacao/config-modulo";
import {
  estaNoPublico,
  exigirTransicao,
  formatarCodigoDocumento,
  formatarRevisao,
  montarSignatarios,
  normalizarMotivo,
  normalizarSigla,
  podeTransitar,
  revisaoVencida,
  situacaoCiencias,
  statusAoEnviar,
  statusAposAssinatura,
  validarPeriodicidade,
  validarPublico,
  type PublicoDocumento,
  type UsuarioPublico,
} from "@/lib/documentos/regras";
import { montarNotificacoesReavaliacao } from "@/lib/reavaliacao/fontes";
import { ErroNegocio } from "@/lib/erros";

describe("código e revisão", () => {
  it("formata código SIGLA-NNN e revisão 00", () => {
    expect(formatarCodigoDocumento("PR", 1)).toBe("PR-001");
    expect(formatarCodigoDocumento("POL", 42)).toBe("POL-042");
    expect(formatarCodigoDocumento("IT", 1234)).toBe("IT-1234");
    expect(formatarRevisao(0)).toBe("00");
    expect(formatarRevisao(7)).toBe("07");
    expect(formatarRevisao(12)).toBe("12");
    expect(() => formatarCodigoDocumento("PR", 0)).toThrow(ErroNegocio);
    expect(() => formatarRevisao(-1)).toThrow(ErroNegocio);
  });
  it("normaliza sigla (maiúsculas, sem acento) e recusa inválida", () => {
    expect(normalizarSigla(" pr ")).toBe("PR");
    expect(normalizarSigla("Pól")).toBe("POL");
    expect(() => normalizarSigla("P R")).toThrow(ErroNegocio);
    expect(() => normalizarSigla("ABCDEFG")).toThrow(ErroNegocio);
    expect(() => normalizarSigla("")).toThrow(ErroNegocio);
  });
  it("valida periodicidade e motivo", () => {
    expect(() => validarPeriodicidade(0)).toThrow(ErroNegocio);
    expect(() => validarPeriodicidade(121)).toThrow(ErroNegocio);
    expect(() => validarPeriodicidade(24)).not.toThrow();
    expect(normalizarMotivo("  ajuste  ")).toBe("ajuste");
    expect(() => normalizarMotivo("  ")).toThrow(ErroNegocio);
  });
});

describe("regras de status", () => {
  it("ciclo feliz: elaboração → revisão → aprovação → aprovado → publicado → nova revisão", () => {
    expect(podeTransitar("ELABORACAO", "EM_REVISAO")).toBe(true);
    expect(podeTransitar("EM_REVISAO", "EM_APROVACAO")).toBe(true);
    expect(podeTransitar("EM_APROVACAO", "APROVADO")).toBe(true);
    expect(podeTransitar("APROVADO", "PUBLICADO")).toBe(true);
    expect(podeTransitar("PUBLICADO", "ELABORACAO")).toBe(true);
  });
  it("bloqueia atalhos e estados finais", () => {
    expect(podeTransitar("ELABORACAO", "APROVADO")).toBe(false);
    expect(podeTransitar("EM_APROVACAO", "PUBLICADO")).toBe(false);
    expect(podeTransitar("EM_REVISAO", "CANCELADO")).toBe(false);
    expect(podeTransitar("OBSOLETO", "PUBLICADO")).toBe(false);
    expect(podeTransitar("CANCELADO", "ELABORACAO")).toBe(false);
    expect(() => exigirTransicao("ELABORACAO", "PUBLICADO")).not.toThrow(); // revisão cancelada com vigente
    expect(() => exigirTransicao("EM_APROVACAO", "OBSOLETO")).toThrow(ErroNegocio);
  });
  it("status ao enviar e após assinaturas dos revisores", () => {
    expect(statusAoEnviar(2)).toBe("EM_REVISAO");
    expect(statusAoEnviar(0)).toBe("EM_APROVACAO");
    const etapas = [
      { aprovadorId: "r1", status: "APROVADA" },
      { aprovadorId: "r2", status: "PENDENTE" },
      { aprovadorId: "a1", status: "AGUARDANDO" },
    ];
    expect(statusAposAssinatura("EM_REVISAO", ["r1", "r2"], etapas)).toBe("EM_REVISAO");
    etapas[1].status = "APROVADA";
    expect(statusAposAssinatura("EM_REVISAO", ["r1", "r2"], etapas)).toBe("EM_APROVACAO");
    expect(statusAposAssinatura("EM_APROVACAO", ["r1"], etapas)).toBe("EM_APROVACAO");
  });
  it("signatários: revisores antes dos aprovadores, sem repetição, ao menos um aprovador", () => {
    expect(montarSignatarios(["r"], ["a", "b"])).toEqual(["r", "a", "b"]);
    expect(() => montarSignatarios(["a"], ["a"])).toThrow(ErroNegocio);
    expect(() => montarSignatarios(["r"], [])).toThrow(ErroNegocio);
  });
  it("revisão periódica vencida", () => {
    expect(revisaoVencida("2026-09-25", "2026-09-26")).toBe(true);
    expect(revisaoVencida("2026-09-26", "2026-09-26")).toBe(false);
    expect(revisaoVencida(null, "2026-09-26")).toBe(false);
  });
});

describe("público da publicação", () => {
  const vazio: PublicoDocumento = { publicoTodos: false, setorIds: [], obraIds: [], perfilIds: [], usuarioIds: [] };
  const u = (x: Partial<UsuarioPublico> = {}): UsuarioPublico => ({ id: "u", setorId: null, perfilId: null, todasObras: false, obraIds: [], ...x });

  it("público vazio é inválido; todos é válido", () => {
    expect(() => validarPublico(vazio)).toThrow(ErroNegocio);
    expect(() => validarPublico({ ...vazio, publicoTodos: true })).not.toThrow();
    expect(() => validarPublico({ ...vazio, perfilIds: ["p"] })).not.toThrow();
  });
  it("união dos critérios: usuário, setor, perfil, obra", () => {
    expect(estaNoPublico({ ...vazio, publicoTodos: true }, u())).toBe(true);
    expect(estaNoPublico({ ...vazio, usuarioIds: ["u"] }, u())).toBe(true);
    expect(estaNoPublico({ ...vazio, setorIds: ["s"] }, u({ setorId: "s" }))).toBe(true);
    expect(estaNoPublico({ ...vazio, setorIds: ["s"] }, u({ setorId: "t" }))).toBe(false);
    expect(estaNoPublico({ ...vazio, perfilIds: ["p"] }, u({ perfilId: "p" }))).toBe(true);
    expect(estaNoPublico({ ...vazio, obraIds: ["o1"] }, u({ obraIds: ["o1", "o2"] }))).toBe(true);
    expect(estaNoPublico({ ...vazio, obraIds: ["o3"] }, u({ obraIds: ["o1"] }))).toBe(false);
    expect(estaNoPublico({ ...vazio, obraIds: ["o3"] }, u({ todasObras: true })), "escopo TODAS entra em publicação por obra").toBe(true);
    expect(estaNoPublico({ ...vazio, setorIds: ["s"], usuarioIds: ["x"] }, u()), "fora de todos os critérios").toBe(false);
  });
  it("ciências: quem confirmou e quem falta", () => {
    const pub = [u({ id: "a" }), u({ id: "b" }), u({ id: "c" })];
    expect(situacaoCiencias(pub, ["b", "zz"])).toEqual({ confirmaram: ["b"], faltam: ["a", "c"] });
  });
});

describe("integração HIRA/LAIA e alertas", () => {
  it("canal TRAMITACAO só com DOCUMENTOS ativo e opção ligada", () => {
    expect(canalAprovacao(["HIRA", "DOCUMENTOS"], { usarTramitacao: true })).toBe("TRAMITACAO");
    expect(canalAprovacao(["HIRA", "DOCUMENTOS"], { usarTramitacao: false })).toBe("MOTOR");
    expect(canalAprovacao(["HIRA"], { usarTramitacao: true })).toBe("MOTOR");
  });
  it("alerta de revisão de documento usa REVISAO_DOCUMENTO_PROXIMA", () => {
    const ns = montarNotificacoesReavaliacao(
      "DOCUMENTOS",
      [{ entidadeId: "d", modo: "ITEM", dataReavaliacao: "2026-09-01", titulo: "PR-001 — Controle", link: "/documentos/d", usuarioIds: ["u"] }],
      "2026-09-26",
      15,
      "REVISAO_DOCUMENTO_PROXIMA",
    );
    expect(ns).toHaveLength(1);
    expect(ns[0].tipo).toBe("REVISAO_DOCUMENTO_PROXIMA");
    expect(ns[0].titulo).toMatch(/Revisão de documento vencida/);
  });
});
