/**
 * Regras puras de Riscos e Oportunidades (ISO 9001 6.1) — sem banco, testadas em
 * tests/riscos.test.ts: cálculo do nível pela escala configurável, regra "tratamento exige
 * plano de ação", normalização dos dados, células do heatmap e itens de reavaliação.
 */
import type {
  FaixaNivel,
  ModoReavaliacao,
  StatusRiscoOportunidade,
  TipoRiscoOportunidade,
  TratamentoRisco,
} from "@prisma/client";
import { calcularNivel, ErroEscala } from "@/lib/escala/calculo";
import type { ConfigEscala, CorFaixa } from "@/lib/escala/tipos";
import { ErroNegocio } from "@/lib/erros";

export const TIPOS_RISCO: readonly TipoRiscoOportunidade[] = ["RISCO", "OPORTUNIDADE"];
export const TRATAMENTOS: readonly TratamentoRisco[] = ["ACEITAR", "MITIGAR", "TRANSFERIR", "EVITAR", "EXPLORAR"];
export const STATUS_RISCO: readonly StatusRiscoOportunidade[] = ["IDENTIFICADO", "EM_TRATAMENTO", "MONITORADO", "ENCERRADO"];
export const FAIXAS: readonly FaixaNivel[] = ["BAIXO", "MEDIO", "ALTO", "CRITICO"];

export const ROTULO_TIPO_RISCO: Record<TipoRiscoOportunidade, string> = { RISCO: "Risco", OPORTUNIDADE: "Oportunidade" };
export const ROTULO_TRATAMENTO: Record<TratamentoRisco, string> = {
  ACEITAR: "Aceitar",
  MITIGAR: "Mitigar",
  TRANSFERIR: "Transferir",
  EVITAR: "Evitar",
  EXPLORAR: "Explorar",
};
export const ROTULO_STATUS_RISCO: Record<StatusRiscoOportunidade, string> = {
  IDENTIFICADO: "Identificado",
  EM_TRATAMENTO: "Em tratamento",
  MONITORADO: "Monitorado",
  ENCERRADO: "Encerrado",
};
export const ROTULO_FAIXA: Record<FaixaNivel, string> = { BAIXO: "Baixo", MEDIO: "Médio", ALTO: "Alto", CRITICO: "Crítico" };
export const COR_FAIXA: Record<FaixaNivel, CorFaixa> = { BAIXO: "baixa", MEDIO: "media", ALTO: "alta", CRITICO: "critica" };

export const MAX_DESCRICAO = 2000;
export const MAX_TEXTO = 4000;

// ---------------------------------------------------------------- cálculo

export interface Avaliacao {
  probabilidade: number;
  impacto: number;
  score: number;
  faixa: FaixaNivel;
}

/** Eixo 1 = probabilidade, eixo 2 = impacto (pela posição na configuração da escala). */
export function eixosPI(config: ConfigEscala) {
  if (config.eixos.length < 2) throw new ErroNegocio("A escala de riscos precisa de dois eixos (probabilidade e impacto).");
  return { eixoP: config.eixos[0], eixoI: config.eixos[1] };
}

/** P×I → score e faixa pela escala resolvida. Valores fora da escala viram ErroNegocio. */
export function avaliar(config: ConfigEscala, probabilidade: number, impacto: number): Avaliacao {
  const { eixoP, eixoI } = eixosPI(config);
  try {
    const r = calcularNivel(config, { [eixoP.chave]: probabilidade, [eixoI.chave]: impacto, ...extrasNeutros(config) });
    return { probabilidade, impacto, score: r.score, faixa: r.nivel };
  } catch (e) {
    if (e instanceof ErroEscala) throw new ErroNegocio(`${e.message} Use valores da escala configurada.`);
    throw e;
  }
}

/** Escalas com mais de dois eixos: os demais entram com o menor valor (neutro para o P×I). */
function extrasNeutros(config: ConfigEscala): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of config.eixos.slice(2)) out[e.chave] = Math.min(...e.niveis.map((n) => n.valor));
  return out;
}

// ---------------------------------------------------------------- tratamento → plano

/** MITIGAR/EVITAR com faixa ALTO/CRITICO exige plano de ação vinculado. */
export function exigePlano(tratamento: TratamentoRisco | null | undefined, faixa: FaixaNivel): boolean {
  return (tratamento === "MITIGAR" || tratamento === "EVITAR") && (faixa === "ALTO" || faixa === "CRITICO");
}

/** Tratamento coerente com o tipo: EXPLORAR só para oportunidade; MITIGAR/EVITAR/TRANSFERIR só para risco. */
export function validarTratamento(tipo: TipoRiscoOportunidade, tratamento: TratamentoRisco | null | undefined) {
  if (!tratamento) return;
  if (tipo === "OPORTUNIDADE" && !["ACEITAR", "EXPLORAR"].includes(tratamento)) {
    throw new ErroNegocio("Para oportunidade, use o tratamento Explorar ou Aceitar.");
  }
  if (tipo === "RISCO" && tratamento === "EXPLORAR") throw new ErroNegocio("Explorar é tratamento de oportunidade.");
}

/** Lança se a combinação exige plano e não há plano vinculado (nem sendo criado junto). */
export function exigirPlanoSeNecessario(tratamento: TratamentoRisco | null | undefined, faixa: FaixaNivel, temPlano: boolean) {
  if (exigePlano(tratamento, faixa) && !temPlano) {
    throw new ErroNegocio(
      `Tratamento ${ROTULO_TRATAMENTO[tratamento!]} com nível ${ROTULO_FAIXA[faixa]} exige plano de ação: informe a primeira ação (o quê, quem, quando) ou gere o plano antes.`,
    );
  }
}

// ---------------------------------------------------------------- dados

export interface DadosRisco {
  tipo: TipoRiscoOportunidade;
  descricao: string;
  causa?: string | null;
  consequencia?: string | null;
  processoId?: string | null;
  obraId?: string | null;
  responsavelId?: string | null;
  probabilidade: number;
  impacto: number;
  modoReavaliacao?: ModoReavaliacao;
  periodicidadeMeses?: number;
}

const texto = (v: string | null | undefined, campo: string, max = MAX_TEXTO) => {
  const t = v?.trim() ?? "";
  if (t.length > max) throw new ErroNegocio(`${campo} excede ${max} caracteres.`);
  return t || null;
};

export function normalizarRisco(d: DadosRisco) {
  const descricao = d.descricao.trim();
  if (descricao.length < 3) throw new ErroNegocio("Descreva o risco/oportunidade (mínimo 3 caracteres).");
  if (descricao.length > MAX_DESCRICAO) throw new ErroNegocio(`Descrição com no máximo ${MAX_DESCRICAO} caracteres.`);
  if (!TIPOS_RISCO.includes(d.tipo)) throw new ErroNegocio("Tipo inválido.");
  const periodicidadeMeses = d.periodicidadeMeses ?? 12;
  if (!Number.isInteger(periodicidadeMeses) || periodicidadeMeses < 1 || periodicidadeMeses > 60) {
    throw new ErroNegocio("Periodicidade de reavaliação entre 1 e 60 meses.");
  }
  return {
    tipo: d.tipo,
    descricao,
    causa: texto(d.causa, "Causa"),
    consequencia: texto(d.consequencia, "Consequência"),
    processoId: d.processoId || null,
    obraId: d.obraId || null,
    responsavelId: d.responsavelId || null,
    probabilidade: d.probabilidade,
    impacto: d.impacto,
    modoReavaliacao: d.modoReavaliacao ?? "ITEM",
    periodicidadeMeses,
  };
}

export const codigoRisco = (r: { tipo: TipoRiscoOportunidade; numero: number }) =>
  `${r.tipo === "RISCO" ? "R" : "O"}-${String(r.numero).padStart(3, "0")}`;

// ---------------------------------------------------------------- heatmap

export interface CelulaContagem {
  linha: number;
  coluna: number;
  contagem: number;
  cor: CorFaixa;
}

/**
 * Células do heatmap (linha = impacto, coluna = probabilidade) com a cor pela escala e a
 * contagem de itens em cada combinação. `residual` usa P/I residual (itens sem residual ficam de fora).
 */
export function celulasHeatmap(
  config: ConfigEscala,
  itens: readonly { probabilidade: number; impacto: number; probabilidadeResidual: number | null; impactoResidual: number | null }[],
  residual = false,
): CelulaContagem[] {
  const { eixoP, eixoI } = eixosPI(config);
  const contagem = new Map<string, number>();
  for (const i of itens) {
    const p = residual ? i.probabilidadeResidual : i.probabilidade;
    const im = residual ? i.impactoResidual : i.impacto;
    if (p == null || im == null) continue;
    contagem.set(`${im}-${p}`, (contagem.get(`${im}-${p}`) ?? 0) + 1);
  }
  const out: CelulaContagem[] = [];
  for (const ni of eixoI.niveis) {
    for (const np of eixoP.niveis) {
      const a = avaliar(config, np.valor, ni.valor);
      out.push({ linha: ni.valor, coluna: np.valor, contagem: contagem.get(`${ni.valor}-${np.valor}`) ?? 0, cor: COR_FAIXA[a.faixa] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- reavaliação

export interface RiscoParaReavaliacao {
  id: string;
  numero: number;
  tipo: TipoRiscoOportunidade;
  descricao: string;
  modoReavaliacao: ModoReavaliacao;
  proximaReavaliacaoEm: string | null;
  processoId: string | null;
  processoCodigo: string | null;
  responsavelId: string | null;
  criadoPorId: string;
}

export interface GrupoReavaliacao {
  entidadeId: string;
  modo: ModoReavaliacao;
  dataReavaliacao: string;
  titulo: string;
  link: string;
  usuarioIds: string[];
}

/**
 * ITEM: um alerta por risco (link para o detalhe). GERAL: um alerta por processo (ou "sem
 * processo" = empresa), com a data mais próxima do grupo e link para a revisão geral.
 */
export function agruparReavaliacao(itens: readonly RiscoParaReavaliacao[], empresaId: string): GrupoReavaliacao[] {
  const out: GrupoReavaliacao[] = [];
  const gerais = new Map<string, GrupoReavaliacao>();
  for (const r of itens) {
    if (!r.proximaReavaliacaoEm) continue;
    const usuarios = [r.responsavelId ?? r.criadoPorId];
    if (r.modoReavaliacao === "ITEM") {
      out.push({
        entidadeId: r.id,
        modo: "ITEM",
        dataReavaliacao: r.proximaReavaliacaoEm,
        titulo: `${codigoRisco(r)} ${r.descricao}`.slice(0, 120),
        link: `/riscos/${r.id}`,
        usuarioIds: usuarios,
      });
      continue;
    }
    const chave = r.processoId ?? empresaId;
    const g = gerais.get(chave);
    if (!g) {
      gerais.set(chave, {
        entidadeId: chave,
        modo: "GERAL",
        dataReavaliacao: r.proximaReavaliacaoEm,
        titulo: `Revisão geral de riscos${r.processoCodigo ? ` — ${r.processoCodigo}` : " (sem processo)"}`,
        link: `/riscos/revisao-geral${r.processoId ? `?processo=${r.processoId}` : "?processo=sem"}`,
        usuarioIds: usuarios,
      });
    } else {
      if (r.proximaReavaliacaoEm < g.dataReavaliacao) g.dataReavaliacao = r.proximaReavaliacaoEm;
      for (const u of usuarios) if (!g.usuarioIds.includes(u)) g.usuarioIds.push(u);
    }
  }
  return [...out, ...gerais.values()];
}
