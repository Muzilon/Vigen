import { describe, expect, it } from "vitest";
import type { Modulo, Permissao } from "@prisma/client";
import { abasDoModulo, montarMenu, type Acesso } from "@/lib/menu-registro";

/** Monta um "acesso" de teste: quais módulos a empresa contratou e quais permissões a pessoa tem. */
function acesso(modulos: Modulo[], permissoes: Permissao[] = []): Acesso {
  return { temModulo: (m) => modulos.includes(m), temPermissao: (p) => permissoes.includes(p) };
}

const TODOS: Modulo[] = ["RNC", "PLANO_ACAO", "MAPA_PROCESSOS", "RISCOS_OPORTUNIDADES", "SWOT", "HIRA", "LAIA", "INSPECOES", "AUDITORIAS", "DOCUMENTOS", "INCIDENTES", "INDICADORES", "TREINAMENTOS"];

describe("montarMenu", () => {
  it("empresa só com a base: sem seções de módulos, mas com RNC e Plano de Ação", () => {
    const m = montarMenu(acesso(["RNC", "PLANO_ACAO"]));
    expect(m.topo.map((i) => i.label)).toEqual(["Início", "Dashboard", "Aprovações", "Mensagens"]);
    // RNC e Plano de Ação são base (sem módulo exigido) e aparecem mesmo sem nenhum módulo contratado.
    expect(m.secoes.map((s) => s.titulo)).toEqual(["Gestão", "Qualidade"]);
    expect(m.secoes[0].itens.map((i) => i.label)).toEqual(["Plano de Ação"]);
    expect(m.secoes[1].itens.map((i) => i.label)).toEqual(["RNCs"]);
    expect(m.rodape).toEqual([]);
  });

  it("todos os módulos: seções e itens na ordem do design", () => {
    const m = montarMenu(acesso(TODOS, ["ADMIN_CONFIG"]));
    expect(m.secoes.map((s) => s.titulo)).toEqual(["Gestão", "Qualidade", "Segurança do Trabalho", "Meio Ambiente"]);
    expect(m.secoes[0].itens.map((i) => i.label)).toEqual(["Indicadores", "Documentos", "Plano de Ação", "Ameaças e Oportunidades", "SWOT", "Treinamentos"]);
    expect(m.secoes[1].itens.map((i) => i.label)).toEqual(["RNCs", "Mapa de Processos", "Inspeções", "Auditoria"]);
    expect(m.secoes[2].itens.map((i) => i.label)).toEqual(["Perigos e Riscos", "Acidentes e Incidentes"]);
    expect(m.secoes[3].itens.map((i) => i.label)).toEqual(["Aspectos e Impactos"]);
    expect(m.rodape.map((i) => i.label)).toEqual(["Configurações"]);
  });

  it("o link de Documentos depende da permissão (lista mestra x meus documentos)", () => {
    const docs = (p: Permissao[]) => montarMenu(acesso(TODOS, p)).secoes[0].itens.find((i) => i.chave === "documentos")!;
    expect(docs([]).href).toBe("/documentos/meus");
    expect(docs(["DOCUMENTO_ELABORAR"]).href).toBe("/documentos");
    expect(docs(["DOCUMENTO_ELABORAR"]).hrefsAtivos).toEqual(["/documentos", "/documentos/meus"]);
  });

  it("módulo não contratado some; seção sem itens some inteira", () => {
    const m = montarMenu(acesso(["RNC", "PLANO_ACAO", "LAIA"]));
    expect(m.secoes.map((s) => s.titulo)).toEqual(["Gestão", "Qualidade", "Meio Ambiente"]);
    expect(m.secoes.flatMap((s) => s.itens).some((i) => i.chave === "perigos")).toBe(false);
  });

  it("contadores chegam ao item certo", () => {
    const m = montarMenu(acesso(["RNC"]), { aprovacoes: 3 });
    expect(m.topo.find((i) => i.chave === "aprovacoes")?.contador).toBe(3);
    expect(m.topo.find((i) => i.chave === "inicio")?.contador).toBeUndefined();
  });

  it("a lista plana de rótulos inclui as sub-páginas visíveis (trilha do cabeçalho)", () => {
    const m = montarMenu(acesso(TODOS, ["TREINAMENTO_GERENCIAR"]));
    expect(m.rotulos.map((r) => r.href)).toContain("/treinamentos/matriz");
    const semPerm = montarMenu(acesso(TODOS));
    expect(semPerm.rotulos.map((r) => r.href)).not.toContain("/treinamentos/matriz");
  });
});

describe("abasDoModulo", () => {
  it("Treinamentos: gestor vê 4 abas, colaborador vê 2", () => {
    expect(abasDoModulo(acesso(TODOS, ["TREINAMENTO_GERENCIAR"]), "treinamentos").map((a) => a.label)).toEqual([
      "Catálogo",
      "Matriz de competências",
      "Meus treinamentos",
      "Evidências p/ auditoria",
    ]);
    expect(abasDoModulo(acesso(TODOS), "treinamentos").map((a) => a.label)).toEqual(["Catálogo", "Meus treinamentos"]);
  });

  it("módulo de uma página só não tem abas", () => {
    expect(abasDoModulo(acesso(TODOS), "swot")).toEqual([]);
    expect(abasDoModulo(acesso(TODOS), "chave-inexistente")).toEqual([]);
  });
});
