import { describe, expect, it } from "vitest";
import { acoesPossiveis, avaliarTransicao, cicloAtual } from "@/lib/rnc/estados";

describe("máquina de estados da RNC", () => {
  it("ABERTO -> EM_ANALISE ao assumir", () => {
    expect(avaliarTransicao({ status: "ABERTO" }, "ASSUMIR")).toEqual({ ok: true, para: "EM_ANALISE" });
  });
  it("REABERTO -> EM_ANALISE ao assumir", () => {
    expect(avaliarTransicao({ status: "REABERTO" }, "ASSUMIR")).toEqual({ ok: true, para: "EM_ANALISE" });
  });
  it("não permite assumir em execução", () => {
    expect(avaliarTransicao({ status: "PLANO_EM_EXECUCAO" }, "ASSUMIR").ok).toBe(false);
  });
  it("execução exige causa raiz", () => {
    const r = avaliarTransicao({ status: "EM_ANALISE", causaRaiz: " ", itensCicloAtual: ["PENDENTE"] }, "INICIAR_EXECUCAO");
    expect(r.ok).toBe(false);
  });
  it("execução exige ao menos 1 item não cancelado", () => {
    expect(avaliarTransicao({ status: "EM_ANALISE", causaRaiz: "x", itensCicloAtual: [] }, "INICIAR_EXECUCAO").ok).toBe(false);
    expect(avaliarTransicao({ status: "EM_ANALISE", causaRaiz: "x", itensCicloAtual: ["CANCELADO"] }, "INICIAR_EXECUCAO").ok).toBe(false);
    expect(avaliarTransicao({ status: "EM_ANALISE", causaRaiz: "x", itensCicloAtual: ["PENDENTE"] }, "INICIAR_EXECUCAO")).toEqual({
      ok: true,
      para: "PLANO_EM_EXECUCAO",
    });
  });
  it("verificação exige todos os itens finalizados e ao menos 1 concluído", () => {
    const s = (itens: ("PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO")[]) =>
      avaliarTransicao({ status: "PLANO_EM_EXECUCAO", causaRaiz: "x", itensCicloAtual: itens }, "ENVIAR_VERIFICACAO").ok;
    expect(s(["CONCLUIDO", "EM_ANDAMENTO"])).toBe(false);
    expect(s(["CANCELADO"])).toBe(false);
    expect(s(["CONCLUIDO", "CANCELADO"])).toBe(true);
  });
  it("verificação EFICAZ encerra e INEFICAZ reabre", () => {
    expect(avaliarTransicao({ status: "EM_VERIFICACAO" }, "VERIFICAR_EFICAZ")).toEqual({ ok: true, para: "ENCERRADO" });
    expect(avaliarTransicao({ status: "EM_VERIFICACAO" }, "VERIFICAR_INEFICAZ")).toEqual({ ok: true, para: "REABERTO" });
    expect(avaliarTransicao({ status: "PLANO_EM_EXECUCAO" }, "VERIFICAR_EFICAZ").ok).toBe(false);
  });
  it("cancelamento só a partir de status não finais", () => {
    expect(avaliarTransicao({ status: "EM_ANALISE" }, "CANCELAR")).toEqual({ ok: true, para: "CANCELADO" });
    expect(avaliarTransicao({ status: "ENCERRADO" }, "CANCELAR").ok).toBe(false);
    expect(avaliarTransicao({ status: "CANCELADO" }, "CANCELAR").ok).toBe(false);
  });
  it("status finais não têm ações", () => {
    expect(acoesPossiveis({ status: "ENCERRADO" })).toEqual([]);
    expect(acoesPossiveis({ status: "ABERTO" })).toEqual(["ASSUMIR", "CANCELAR"]);
  });
  it("ciclo = ineficazes + 1", () => {
    expect(cicloAtual([])).toBe(1);
    expect(cicloAtual([{ resultado: "INEFICAZ" }, { resultado: "INEFICAZ" }])).toBe(3);
  });
});
