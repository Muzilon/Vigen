import { describe, expect, it } from "vitest";
import { filtroAcessoIncidente, podeGerenciarIncidentes, podeTratarIncidente, podeVerRestritosIncidente } from "@/lib/incidentes/acesso";
import {
  classificarPrivacidade,
  contarPorGravidade,
  exigirStatus,
  permitido,
  taxaMensal,
  temSensiveis,
  tituloPlanoIncidente,
} from "@/lib/incidentes/regras";
import { dataHoraLocal, dataHoraNoFuso } from "@/lib/incidentes/servico";
import { ErroNegocio } from "@/lib/erros";
import { permissoesEfetivas } from "@/lib/permissoes";

describe("incidentes — ciclo de status", () => {
  it("aberto → em investigação → concluído", () => {
    expect(permitido("ABERTO", "INICIAR_INVESTIGACAO")).toBe(true);
    expect(permitido("EM_INVESTIGACAO", "INICIAR_INVESTIGACAO")).toBe(false);
    expect(permitido("ABERTO", "CONCLUIR")).toBe(false);
    expect(permitido("EM_INVESTIGACAO", "CONCLUIR")).toBe(true);
    expect(permitido("CONCLUIDO", "EDITAR")).toBe(false);
    expect(permitido("CONCLUIDO", "GERAR_PLANO")).toBe(false);
    expect(() => exigirStatus("CONCLUIDO", "INVESTIGAR")).toThrow(ErroNegocio);
  });
});

describe("incidentes — privacidade (LGPD)", () => {
  it("envolvido, terceiro, testemunhas ou sensíveis tornam o registro restrito", () => {
    expect(classificarPrivacidade({})).toEqual({ contemDadosPessoais: false, restrita: false });
    expect(classificarPrivacidade({ restrita: true })).toEqual({ contemDadosPessoais: false, restrita: true });
    expect(classificarPrivacidade({ envolvidoId: "u" }).restrita).toBe(true);
    expect(classificarPrivacidade({ terceiroNome: "  " }).restrita).toBe(false);
    expect(classificarPrivacidade({ terceiroNome: "Fulano" }).restrita).toBe(true);
    expect(classificarPrivacidade({ testemunhas: "Beltrano" }).contemDadosPessoais).toBe(true);
    expect(classificarPrivacidade({ sensiveis: { relato: "x" } }).restrita).toBe(true);
    expect(temSensiveis({ relato: "", lesaoDescricao: null })).toBe(false);
  });

  it("filtro: sem INCIDENTE_VER_RESTRITOS só vê não restritos, os que registrou ou investiga", () => {
    const colab = { permissoes: permissoesEfetivas("COLABORADOR"), usuarioId: "c", obrasPermitidas: ["o1"] };
    expect(filtroAcessoIncidente(colab)).toEqual({
      AND: [{ obraId: { in: ["o1"] } }, { OR: [{ restrita: false }, { registradoPorId: "c" }, { responsavelId: "c" }] }],
    });
    const admin = { permissoes: permissoesEfetivas("ADMIN"), usuarioId: "a", obrasPermitidas: null };
    expect(filtroAcessoIncidente(admin)).toEqual({ AND: [] });
    expect(podeVerRestritosIncidente(admin)).toBe(true);
    expect(podeVerRestritosIncidente(colab)).toBe(false);
  });

  it("tratar: GERENCIAR ou responsável", () => {
    const colab = { permissoes: permissoesEfetivas("COLABORADOR"), usuarioId: "c" };
    expect(podeGerenciarIncidentes(colab)).toBe(false);
    expect(podeTratarIncidente(colab, { responsavelId: "c" })).toBe(true);
    expect(podeTratarIncidente(colab, { responsavelId: null })).toBe(false);
  });

  it("título do plano neutro quando restrito", () => {
    expect(tituloPlanoIncidente({ codigo: "INC-001-26", restrita: true }, "Queda do Fulano")).toBe("Investigação do incidente INC-001-26");
    expect(tituloPlanoIncidente({ codigo: "INC-001-26", restrita: false }, "Queda de material")).toBe("Queda de material");
  });
});

describe("incidentes — indicadores e datas", () => {
  it("taxa mensal e contagem por gravidade", () => {
    expect(taxaMensal(6, 12)).toBe(0.5);
    expect(taxaMensal(7, 12)).toBe(0.6);
    expect(taxaMensal(3, 0)).toBe(0);
    expect(contarPorGravidade([{ gravidade: "SEM_AFASTAMENTO" }, { gravidade: "COM_AFASTAMENTO" }, { gravidade: "SEM_AFASTAMENTO" }])).toEqual({
      SEM_AFASTAMENTO: 2,
      COM_AFASTAMENTO: 1,
      FATALIDADE: 0,
    });
  });

  it("data/hora local ↔ instante no fuso da empresa", () => {
    const d = dataHoraNoFuso("2026-09-26T10:30", "America/Sao_Paulo");
    expect(d.toISOString()).toBe("2026-09-26T13:30:00.000Z");
    expect(dataHoraLocal(d, "America/Sao_Paulo")).toBe("2026-09-26T10:30");
    expect(() => dataHoraNoFuso("26/09/2026", "America/Sao_Paulo")).toThrow(ErroNegocio);
  });
});
