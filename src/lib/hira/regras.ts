/**
 * Regras puras do HIRA (ISO 45001 — perigos e riscos de SST), sem banco; testadas em
 * tests/hira.test.ts: cálculo P×S pela escala HIRA, normalização da linha, código, células do
 * heatmap, diff antes/depois e agrupamento de reavaliação.
 */
import type { CondicaoOperacional, FaixaNivel, HierarquiaControle, ModoReavaliacao, StatusLinhaSgi } from "@prisma/client";
import { calcularNivel, ErroEscala } from "@/lib/escala/calculo";
import type { ConfigEscala, CorFaixa } from "@/lib/escala/tipos";
import { ErroNegocio } from "@/lib/erros";

export const CONDICOES: readonly CondicaoOperacional[] = ["NORMAL", "ANORMAL", "EMERGENCIA"];
export const HIERARQUIAS: readonly HierarquiaControle[] = ["ELIMINACAO", "SUBSTITUICAO", "ENGENHARIA", "ADMINISTRATIVO", "EPI"];
export const STATUS_LINHA: readonly StatusLinhaSgi[] = ["PENDENTE_APROVACAO", "VIGENTE", "REJEITADA", "INATIVA"];
export const FAIXAS: readonly FaixaNivel[] = ["BAIXO", "MEDIO", "ALTO", "CRITICO"];

export const ROTULO_CONDICAO: Record<CondicaoOperacional, string> = { NORMAL: "Normal", ANORMAL: "Anormal", EMERGENCIA: "Emergência" };
export const SIGLA_CONDICAO: Record<CondicaoOperacional, string> = { NORMAL: "N", ANORMAL: "A", EMERGENCIA: "E" };
export const ROTULO_HIERARQUIA: Record<HierarquiaControle, string> = {
  ELIMINACAO: "Eliminação",
  SUBSTITUICAO: "Substituição",
  ENGENHARIA: "Controle de engenharia",
  ADMINISTRATIVO: "Administrativo / sinalização",
  EPI: "EPI",
};
export const ROTULO_STATUS_LINHA: Record<StatusLinhaSgi, string> = {
  PENDENTE_APROVACAO: "Pendente de aprovação",
  VIGENTE: "Vigente",
  REJEITADA: "Rejeitada",
  INATIVA: "Inativa",
};
export const ROTULO_FAIXA: Record<FaixaNivel, string> = { BAIXO: "Baixo", MEDIO: "Médio", ALTO: "Alto", CRITICO: "Crítico" };
export const COR_FAIXA: Record<FaixaNivel, CorFaixa> = { BAIXO: "baixa", MEDIO: "media", ALTO: "alta", CRITICO: "critica" };
export const ROTULO_ACAO_HISTORICO: Record<string, string> = {
  INCLUSAO: "Inclusão",
  ALTERACAO: "Alteração",
  EXCLUSAO: "Exclusão (inativação)",
  REAVALIACAO: "Reavaliação",
  REVISAO_GERAL: "Revisão geral",
  PLANO: "Plano de ação",
  APROVACAO: "Aprovação",
  REJEICAO: "Rejeição",
};

export const MAX_TEXTO = 2000;
export const MAX_CURTO = 200;

// ---------------------------------------------------------------- cálculo

export interface AvaliacaoPS {
  probabilidade: number;
  severidade: number;
  score: number;
  faixa: FaixaNivel;
}

/** Eixo 1 = probabilidade, eixo 2 = severidade (pela posição na configuração da escala HIRA). */
export function eixosPS(config: ConfigEscala) {
  if (config.eixos.length < 2) throw new ErroNegocio("A escala HIRA precisa de dois eixos (probabilidade e severidade).");
  return { eixoP: config.eixos[0], eixoS: config.eixos[1] };
}

/** P×S → score e faixa. Valores fora da escala viram ErroNegocio. */
export function avaliarPS(config: ConfigEscala, probabilidade: number, severidade: number): AvaliacaoPS {
  const { eixoP, eixoS } = eixosPS(config);
  const extras: Record<string, number> = {};
  for (const e of config.eixos.slice(2)) extras[e.chave] = Math.min(...e.niveis.map((n) => n.valor));
  try {
    const r = calcularNivel(config, { [eixoP.chave]: probabilidade, [eixoS.chave]: severidade, ...extras });
    return { probabilidade, severidade, score: r.score, faixa: r.nivel };
  } catch (e) {
    if (e instanceof ErroEscala) throw new ErroNegocio(`${e.message} Use valores da escala configurada.`);
    throw e;
  }
}

/** Residual: ambos ou nenhum. */
export function avaliarResidual(config: ConfigEscala, p?: number | null, s?: number | null) {
  if (p == null && s == null) return { probabilidadeResidual: null, severidadeResidual: null, scoreResidual: null, faixaResidual: null };
  if (p == null || s == null) throw new ErroNegocio("Informe probabilidade e severidade residuais (ou nenhuma das duas).");
  const r = avaliarPS(config, p, s);
  return { probabilidadeResidual: r.probabilidade, severidadeResidual: r.severidade, scoreResidual: r.score, faixaResidual: r.faixa };
}

// ---------------------------------------------------------------- dados

export interface DadosHira {
  obraId: string;
  setor: string;
  processoId?: string | null;
  atividade: string;
  rotineira: boolean;
  perigo: string;
  risco: string;
  condicao: CondicaoOperacional;
  controlesExistentes?: string | null;
  hierarquiaControle?: HierarquiaControle | null;
  controlesPropostos?: string | null;
  probabilidade: number;
  severidade: number;
  probabilidadeResidual?: number | null;
  severidadeResidual?: number | null;
  requisitoLegal?: string | null;
  responsavelId?: string | null;
  modoReavaliacao?: ModoReavaliacao;
  periodicidadeMeses?: number;
}

const obrig = (v: string | null | undefined, campo: string, max = MAX_TEXTO) => {
  const t = v?.trim() ?? "";
  if (t.length < 2) throw new ErroNegocio(`Informe ${campo}.`);
  if (t.length > max) throw new ErroNegocio(`${campo[0].toUpperCase()}${campo.slice(1)} excede ${max} caracteres.`);
  return t;
};
const opc = (v: string | null | undefined, campo: string, max = MAX_TEXTO) => {
  const t = v?.trim() ?? "";
  if (t.length > max) throw new ErroNegocio(`${campo} excede ${max} caracteres.`);
  return t || null;
};

/** Valida e normaliza (sem cálculo). Tipos de enum conferidos aqui — o payload de aprovação passa por aqui de novo. */
export function normalizarHira(d: DadosHira) {
  if (!d.obraId) throw new ErroNegocio("Informe a unidade (o HIRA é sempre por unidade).");
  if (!CONDICOES.includes(d.condicao)) throw new ErroNegocio("Condição inválida.");
  if (d.hierarquiaControle && !HIERARQUIAS.includes(d.hierarquiaControle)) throw new ErroNegocio("Hierarquia de controle inválida.");
  const periodicidadeMeses = d.periodicidadeMeses ?? 12;
  if (!Number.isInteger(periodicidadeMeses) || periodicidadeMeses < 1 || periodicidadeMeses > 60) {
    throw new ErroNegocio("Periodicidade de reavaliação entre 1 e 60 meses.");
  }
  if (!Number.isInteger(d.probabilidade) || !Number.isInteger(d.severidade)) throw new ErroNegocio("Probabilidade e severidade inválidas.");
  return {
    obraId: d.obraId,
    setor: obrig(d.setor, "o setor", MAX_CURTO),
    processoId: d.processoId || null,
    atividade: obrig(d.atividade, "a atividade"),
    rotineira: !!d.rotineira,
    perigo: obrig(d.perigo, "o perigo"),
    risco: obrig(d.risco, "o risco/dano"),
    condicao: d.condicao,
    controlesExistentes: opc(d.controlesExistentes, "Controles existentes"),
    hierarquiaControle: d.hierarquiaControle || null,
    controlesPropostos: opc(d.controlesPropostos, "Controles propostos"),
    probabilidade: d.probabilidade,
    severidade: d.severidade,
    probabilidadeResidual: d.probabilidadeResidual ?? null,
    severidadeResidual: d.severidadeResidual ?? null,
    requisitoLegal: opc(d.requisitoLegal, "Requisito legal", 1000),
    responsavelId: d.responsavelId || null,
    modoReavaliacao: d.modoReavaliacao ?? "ITEM",
    periodicidadeMeses,
  };
}
export type DadosHiraNormalizados = ReturnType<typeof normalizarHira>;

/** Dados normalizados + avaliação (inicial e residual) pela escala: o que é gravado na linha. */
export function calcularLinhaHira(config: ConfigEscala, d: DadosHira) {
  const n = normalizarHira(d);
  const { probabilidadeResidual, severidadeResidual, ...resto } = n;
  return { ...resto, ...avaliarPS(config, n.probabilidade, n.severidade), ...avaliarResidual(config, probabilidadeResidual, severidadeResidual) };
}

export const codigoHira = (l: { numero: number }) => `H-${String(l.numero).padStart(3, "0")}`;

/** Campos exibidos no "antes → depois" das solicitações de alteração. */
export const CAMPOS_DIFF_HIRA = [
  "setor",
  "atividade",
  "rotineira",
  "perigo",
  "risco",
  "condicao",
  "controlesExistentes",
  "hierarquiaControle",
  "controlesPropostos",
  "probabilidade",
  "severidade",
  "score",
  "faixa",
  "probabilidadeResidual",
  "severidadeResidual",
  "faixaResidual",
  "requisitoLegal",
] as const;

/** Só os campos que mudam (para o payload { antes, depois }). */
export function diffCampos<T extends Record<string, unknown>>(antes: T, depois: T, campos: readonly (keyof T)[]) {
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};
  for (const c of campos) {
    if ((antes[c] ?? null) !== (depois[c] ?? null)) {
      a[c as string] = antes[c] ?? null;
      d[c as string] = depois[c] ?? null;
    }
  }
  return { antes: a, depois: d };
}

// ---------------------------------------------------------------- heatmap

export interface CelulaContagem {
  linha: number;
  coluna: number;
  contagem: number;
  cor: CorFaixa;
}

/** Células do heatmap (linha = severidade, coluna = probabilidade); `residual` usa P/S residual. */
export function celulasHeatmapHira(
  config: ConfigEscala,
  itens: readonly { probabilidade: number; severidade: number; probabilidadeResidual: number | null; severidadeResidual: number | null }[],
  residual = false,
): CelulaContagem[] {
  const { eixoP, eixoS } = eixosPS(config);
  const contagem = new Map<string, number>();
  for (const i of itens) {
    const p = residual ? i.probabilidadeResidual : i.probabilidade;
    const s = residual ? i.severidadeResidual : i.severidade;
    if (p == null || s == null) continue;
    contagem.set(`${s}-${p}`, (contagem.get(`${s}-${p}`) ?? 0) + 1);
  }
  const out: CelulaContagem[] = [];
  for (const ns of eixoS.niveis) {
    for (const np of eixoP.niveis) {
      out.push({ linha: ns.valor, coluna: np.valor, contagem: contagem.get(`${ns.valor}-${np.valor}`) ?? 0, cor: COR_FAIXA[avaliarPS(config, np.valor, ns.valor).faixa] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- reavaliação

export interface LinhaParaReavaliacao {
  id: string;
  numero: number;
  atividade: string;
  modoReavaliacao: ModoReavaliacao;
  proximaReavaliacaoEm: string | null;
  obraId: string;
  obraNome: string;
  responsavelId: string | null;
  criadoPorId: string;
}

export interface GrupoReavaliacaoLinha {
  entidadeId: string;
  modo: ModoReavaliacao;
  dataReavaliacao: string;
  titulo: string;
  link: string;
  usuarioIds: string[];
}

/**
 * ITEM: um alerta por linha. GERAL: um alerta por obra (planilha da obra), com a data mais
 * próxima e link para a revisão geral daquela obra. `base` = "/hira" ou "/laia".
 */
export function agruparReavaliacaoPorObra(
  itens: readonly LinhaParaReavaliacao[],
  base: string,
  rotulo: string,
  codigo: (l: { numero: number }) => string,
): GrupoReavaliacaoLinha[] {
  const out: GrupoReavaliacaoLinha[] = [];
  const gerais = new Map<string, GrupoReavaliacaoLinha>();
  for (const l of itens) {
    if (!l.proximaReavaliacaoEm) continue;
    const usuarios = [l.responsavelId ?? l.criadoPorId];
    if (l.modoReavaliacao === "ITEM") {
      out.push({
        entidadeId: l.id,
        modo: "ITEM",
        dataReavaliacao: l.proximaReavaliacaoEm,
        titulo: `${codigo(l)} ${l.atividade}`.slice(0, 120),
        link: `${base}/${l.id}`,
        usuarioIds: usuarios,
      });
      continue;
    }
    const g = gerais.get(l.obraId);
    if (!g) {
      gerais.set(l.obraId, {
        entidadeId: l.obraId,
        modo: "GERAL",
        dataReavaliacao: l.proximaReavaliacaoEm,
        titulo: `Revisão geral ${rotulo} — ${l.obraNome}`.slice(0, 120),
        link: `${base}/revisao-geral?obra=${l.obraId}`,
        usuarioIds: usuarios,
      });
    } else {
      if (l.proximaReavaliacaoEm < g.dataReavaliacao) g.dataReavaliacao = l.proximaReavaliacaoEm;
      for (const u of usuarios) if (!g.usuarioIds.includes(u)) g.usuarioIds.push(u);
    }
  }
  return [...out, ...gerais.values()];
}
