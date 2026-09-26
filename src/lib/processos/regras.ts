/**
 * Regras puras do Mapa de Processos (sem banco): validação/normalização dos dados da linha,
 * reordenação dentro da raia, montagem do snapshot publicado e layout do diagrama em 3 raias.
 * Testadas em tests/processos.test.ts.
 */
import type { TipoProcesso } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const TIPOS_PROCESSO: readonly TipoProcesso[] = ["GESTAO", "FINALISTICO", "APOIO"];

export const ROTULO_TIPO_PROCESSO: Record<TipoProcesso, string> = {
  GESTAO: "Gestão",
  FINALISTICO: "Finalístico",
  APOIO: "Apoio",
};

export const ROTULO_RAIA: Record<TipoProcesso, string> = {
  GESTAO: "Processos de gestão",
  FINALISTICO: "Processos finalísticos (realização)",
  APOIO: "Processos de apoio",
};

export const MAX_CODIGO = 20;
export const MAX_NOME = 150;
export const MAX_TEXTO = 4000;
export const MAX_INDICADORES = 30;

export interface DadosProcesso {
  codigo: string;
  nome: string;
  tipo: TipoProcesso;
  objetivo?: string | null;
  donoId?: string | null;
  entradas?: string | null;
  saidas?: string | null;
  fornecedores?: string | null;
  clientes?: string | null;
  recursos?: string | null;
}

const texto = (v: string | null | undefined, campo: string) => {
  const t = v?.trim() ?? "";
  if (t.length > MAX_TEXTO) throw new ErroNegocio(`${campo} excede ${MAX_TEXTO} caracteres.`);
  return t || null;
};

/** Código em maiúsculas, sem espaços nas pontas; letras, números, ponto, hífen e sublinhado. */
export function normalizarCodigo(codigo: string): string {
  const c = codigo.trim().toUpperCase();
  if (!c) throw new ErroNegocio("Informe o código do processo.");
  if (c.length > MAX_CODIGO) throw new ErroNegocio(`Código com no máximo ${MAX_CODIGO} caracteres.`);
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(c)) throw new ErroNegocio("Código: use letras, números, ponto, hífen ou sublinhado.");
  return c;
}

export function normalizarProcesso(d: DadosProcesso) {
  const nome = d.nome.trim();
  if (nome.length < 2) throw new ErroNegocio("Informe o nome do processo.");
  if (nome.length > MAX_NOME) throw new ErroNegocio(`Nome com no máximo ${MAX_NOME} caracteres.`);
  if (!TIPOS_PROCESSO.includes(d.tipo)) throw new ErroNegocio("Tipo de processo inválido.");
  return {
    codigo: normalizarCodigo(d.codigo),
    nome,
    tipo: d.tipo,
    objetivo: texto(d.objetivo, "Objetivo"),
    donoId: d.donoId || null,
    entradas: texto(d.entradas, "Entradas"),
    saidas: texto(d.saidas, "Saídas"),
    fornecedores: texto(d.fornecedores, "Fornecedores"),
    clientes: texto(d.clientes, "Clientes"),
    recursos: texto(d.recursos, "Recursos"),
  };
}

/** Nomes de indicadores digitados na planilha (um por linha), sem vazios nem repetidos. */
export function nomesIndicadores(textoLinhas: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const linha of textoLinhas.split(/\r?\n/)) {
    const n = linha.trim();
    if (!n) continue;
    if (n.length > MAX_NOME) throw new ErroNegocio(`Indicador com no máximo ${MAX_NOME} caracteres.`);
    const chave = n.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(n);
  }
  if (out.length > MAX_INDICADORES) throw new ErroNegocio(`No máximo ${MAX_INDICADORES} indicadores por processo.`);
  return out;
}

/**
 * Diferença entre os indicadores atuais e os nomes digitados: mantém os que continuam (por
 * nome, sem diferenciar maiúsculas), cria os novos e remove os que sumiram. A ordem final
 * segue a digitada.
 */
export function diffIndicadores(atuais: readonly { id: string; nome: string }[], nomes: readonly string[]) {
  const porNome = new Map(atuais.map((i) => [i.nome.toLocaleLowerCase("pt-BR"), i]));
  const manter: { id: string; ordem: number }[] = [];
  const criar: { nome: string; ordem: number }[] = [];
  nomes.forEach((nome, i) => {
    const existente = porNome.get(nome.toLocaleLowerCase("pt-BR"));
    if (existente) {
      manter.push({ id: existente.id, ordem: i + 1 });
      porNome.delete(nome.toLocaleLowerCase("pt-BR"));
    } else criar.push({ nome, ordem: i + 1 });
  });
  return { manter, criar, remover: [...porNome.values()].map((i) => i.id) };
}

/**
 * Nova ordem da raia após mover `id` uma posição para cima/baixo. Devolve a lista de ids na
 * nova ordem (renumerar 1..n) ou null se o movimento não for possível (já no topo/fim).
 */
export function moverNaRaia(idsEmOrdem: readonly string[], id: string, direcao: "cima" | "baixo"): string[] | null {
  const i = idsEmOrdem.indexOf(id);
  if (i < 0) return null;
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (j < 0 || j >= idsEmOrdem.length) return null;
  const nova = [...idsEmOrdem];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

export interface SnapshotProcesso {
  codigo: string;
  nome: string;
  tipo: TipoProcesso;
  ordem: number;
  objetivo: string | null;
  dono: { id: string; nome: string } | null;
  entradas: string | null;
  saidas: string | null;
  fornecedores: string | null;
  clientes: string | null;
  recursos: string | null;
  indicadores: { nome: string; meta: string | null; unidade: string | null; periodicidade: string | null }[];
  interacoes: {
    saida: { codigo: string; nome: string; descricao: string | null }[];
    entrada: { codigo: string; nome: string; descricao: string | null }[];
  };
}

type ProcessoParaSnapshot = Omit<SnapshotProcesso, "indicadores" | "interacoes"> & {
  indicadores: (SnapshotProcesso["indicadores"][number] & { ordem: number })[];
  interacoesOrigem: { descricao: string | null; destino: { codigo: string; nome: string } }[];
  interacoesDestino: { descricao: string | null; origem: { codigo: string; nome: string } }[];
};

/** Snapshot publicado (congelado em VersaoProcesso). Determinístico: ordena as listas. */
export function montarSnapshot(p: ProcessoParaSnapshot): SnapshotProcesso {
  const porCodigo = <T extends { codigo: string }>(a: T, b: T) => a.codigo.localeCompare(b.codigo, "pt-BR");
  return {
    codigo: p.codigo,
    nome: p.nome,
    tipo: p.tipo,
    ordem: p.ordem,
    objetivo: p.objetivo,
    dono: p.dono ? { id: p.dono.id, nome: p.dono.nome } : null,
    entradas: p.entradas,
    saidas: p.saidas,
    fornecedores: p.fornecedores,
    clientes: p.clientes,
    recursos: p.recursos,
    indicadores: [...p.indicadores]
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({ nome: i.nome, meta: i.meta, unidade: i.unidade, periodicidade: i.periodicidade })),
    interacoes: {
      saida: p.interacoesOrigem.map((x) => ({ codigo: x.destino.codigo, nome: x.destino.nome, descricao: x.descricao })).sort(porCodigo),
      entrada: p.interacoesDestino.map((x) => ({ codigo: x.origem.codigo, nome: x.origem.nome, descricao: x.descricao })).sort(porCodigo),
    },
  };
}

// ---------------------------------------------------------------- layout do mapa (SVG)

export interface CaixaMapa {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoProcesso;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface SetaMapa {
  /** "fluxo" = sequência dos finalísticos (cliente → cliente); "interacao" = InteracaoProcesso. */
  tipo: "fluxo" | "interacao";
  d: string;
  titulo: string;
}

export interface LayoutMapa {
  largura: number;
  altura: number;
  raias: { tipo: TipoProcesso; rotulo: string; y: number; altura: number }[];
  caixas: CaixaMapa[];
  setas: SetaMapa[];
  /** Blocos "Cliente" nas pontas da raia finalística. */
  clientes: { entrada: { x: number; y: number; largura: number; altura: number }; saida: { x: number; y: number; largura: number; altura: number } };
}

export const DIMENSOES_MAPA = {
  margem: 24,
  rotuloRaia: 34,
  caixaLargura: 168,
  caixaAltura: 64,
  espacoCaixa: 36,
  alturaRaia: 128,
  espacoRaia: 16,
  clienteLargura: 96,
};

/**
 * Posiciona as caixas em 3 raias (Gestão, Finalísticos, Apoio) pela ordem e gera as setas:
 * Cliente → finalísticos em sequência → Cliente, e as interações cadastradas (curvas).
 */
export function montarLayoutMapa(
  processos: readonly { id: string; codigo: string; nome: string; tipo: TipoProcesso; ordem: number }[],
  interacoes: readonly { origemId: string; destinoId: string; descricao: string | null }[],
): LayoutMapa {
  const D = DIMENSOES_MAPA;
  const porTipo = (t: TipoProcesso) => processos.filter((p) => p.tipo === t).sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo));
  const raiasProc = TIPOS_PROCESSO.map((t) => porTipo(t));
  const n = Math.max(1, ...raiasProc.map((r) => r.length));
  const larguraConteudo = n * D.caixaLargura + (n - 1) * D.espacoCaixa;
  const xInicio = D.margem + D.clienteLargura + D.espacoCaixa;
  const largura = xInicio + larguraConteudo + D.espacoCaixa + D.clienteLargura + D.margem;

  const raias: LayoutMapa["raias"] = [];
  const caixas: CaixaMapa[] = [];
  TIPOS_PROCESSO.forEach((tipo, idx) => {
    const y = D.margem + idx * (D.alturaRaia + D.espacoRaia);
    raias.push({ tipo, rotulo: ROTULO_RAIA[tipo], y, altura: D.alturaRaia });
    const lista = raiasProc[idx];
    // Centraliza a raia quando tem menos caixas que a mais longa.
    const larguraRaia = lista.length * D.caixaLargura + Math.max(0, lista.length - 1) * D.espacoCaixa;
    const x0 = xInicio + (larguraConteudo - larguraRaia) / 2;
    lista.forEach((p, i) => {
      caixas.push({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        tipo,
        x: x0 + i * (D.caixaLargura + D.espacoCaixa),
        y: y + D.rotuloRaia + (D.alturaRaia - D.rotuloRaia - D.caixaAltura) / 2,
        largura: D.caixaLargura,
        altura: D.caixaAltura,
      });
    });
  });
  const altura = D.margem * 2 + 3 * D.alturaRaia + 2 * D.espacoRaia;
  const raiaFin = raias[1];
  const yCliente = raiaFin.y + D.rotuloRaia + (D.alturaRaia - D.rotuloRaia - D.caixaAltura) / 2;
  const clientes = {
    entrada: { x: D.margem, y: yCliente, largura: D.clienteLargura, altura: D.caixaAltura },
    saida: { x: largura - D.margem - D.clienteLargura, y: yCliente, largura: D.clienteLargura, altura: D.caixaAltura },
  };

  const setas: SetaMapa[] = [];
  const meioY = (c: { y: number; altura: number }) => c.y + c.altura / 2;
  const horizontal = (x1: number, x2: number, y: number) => `M ${x1} ${y} L ${x2 - 2} ${y}`;
  const fin = caixas.filter((c) => c.tipo === "FINALISTICO");
  const cadeia = [clientes.entrada, ...fin, clientes.saida];
  for (let i = 0; i < cadeia.length - 1; i++) {
    const a = cadeia[i];
    const b = cadeia[i + 1];
    const nomeA = "codigo" in a ? a.codigo : "Cliente (requisitos)";
    const nomeB = "codigo" in b ? b.codigo : "Cliente (satisfação)";
    setas.push({ tipo: "fluxo", d: horizontal(a.x + a.largura, b.x, meioY(a)), titulo: `${nomeA} → ${nomeB}` });
  }

  const porId = new Map(caixas.map((c) => [c.id, c]));
  for (const it of interacoes) {
    const a = porId.get(it.origemId);
    const b = porId.get(it.destinoId);
    if (!a || !b) continue;
    // Sequência finalística adjacente já desenhada como fluxo: não duplica.
    const adjacente = a.tipo === "FINALISTICO" && b.tipo === "FINALISTICO" && fin.indexOf(b) === fin.indexOf(a) + 1;
    if (adjacente) continue;
    // Par nos dois sentidos (A→B e B→A): afasta as curvas para não se sobreporem.
    const temVolta = interacoes.some((o) => o.origemId === it.destinoId && o.destinoId === it.origemId);
    const desvio = temVolta ? (it.origemId < it.destinoId ? -10 : 10) : 0;
    const ax = a.x + a.largura / 2 + desvio;
    const bx = b.x + b.largura / 2 + desvio;
    let d: string;
    if (a.y === b.y) {
      // Mesma raia: arco por cima das caixas.
      const topo = a.y - 14;
      d = `M ${ax} ${a.y} C ${ax} ${topo - 10}, ${bx} ${topo - 10}, ${bx} ${b.y - 2}`;
    } else {
      const desce = b.y > a.y;
      const y1 = desce ? a.y + a.altura : a.y;
      const y2 = desce ? b.y - 2 : b.y + b.altura + 2;
      const my = (y1 + y2) / 2;
      d = `M ${ax} ${y1} C ${ax} ${my}, ${bx} ${my}, ${bx} ${y2}`;
    }
    setas.push({ tipo: "interacao", d, titulo: `${a.codigo} → ${b.codigo}${it.descricao ? `: ${it.descricao}` : ""}` });
  }

  return { largura, altura, raias, caixas, setas, clientes };
}
