import { describe, expect, it } from "vitest";
import { PADRAO_HIRA } from "@/lib/escala/padrao";
import { resolverConfiguracaoEscala } from "@/lib/escala/resolver";
import type { ConfiguracaoEscalaRegistro } from "@/lib/escala/tipos";

const registroEmpresa: ConfiguracaoEscalaRegistro = {
  tipo: "HIRA",
  obraId: null,
  tamanho: 5,
  eixos: [{ chave: "probabilidade", rotulo: "Probabilidade", niveis: [{ valor: 1, rotulo: "Baixa" }] }],
  faixas: [{ limite: 25, nivel: "CRITICO", cor: "critica" }],
};

const registroObra: ConfiguracaoEscalaRegistro = {
  ...registroEmpresa,
  obraId: "obra-1",
  tamanho: 3,
};

describe("resolverConfiguracaoEscala", () => {
  it("usa o padrão do sistema quando não há nenhum registro cadastrado", () => {
    const r = resolverConfiguracaoEscala([], "HIRA", null);
    expect(r).toEqual(PADRAO_HIRA);
  });

  it("usa a configuração da empresa quando não há sobrescrita de obra", () => {
    const r = resolverConfiguracaoEscala([registroEmpresa], "HIRA", "obra-2");
    expect(r.tamanho).toBe(5);
  });

  it("usa a sobrescrita da obra quando existir e a obra for informada", () => {
    const r = resolverConfiguracaoEscala([registroEmpresa, registroObra], "HIRA", "obra-1");
    expect(r.tamanho).toBe(3);
  });

  it("ignora a sobrescrita de outra obra", () => {
    const r = resolverConfiguracaoEscala([registroEmpresa, registroObra], "HIRA", "obra-2");
    expect(r.tamanho).toBe(5);
  });

  it("ignora registros de outro tipo de escala", () => {
    const outroTipo: ConfiguracaoEscalaRegistro = { ...registroEmpresa, tipo: "ASPECTO_IMPACTO" };
    const r = resolverConfiguracaoEscala([outroTipo], "HIRA", null);
    expect(r).toEqual(PADRAO_HIRA);
  });

  it("sem obraId informado, não usa sobrescritas de obra mesmo se existirem", () => {
    const r = resolverConfiguracaoEscala([registroEmpresa, registroObra], "HIRA", null);
    expect(r.tamanho).toBe(5);
  });
});
