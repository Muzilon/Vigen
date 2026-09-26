/**
 * Regras puras da LAIA (ISO 14001 — aspectos e impactos ambientais), sem banco; testadas em
 * tests/laia.test.ts. Pontuação = produto dos eixos da escala ASPECTO_IMPACTO, localizados pela
 * CHAVE (severidade, frequencia, abrangencia; eixo ausente na configuração não entra no score).
 * Critérios extras (requisitoLegal, partesInteressadas) elevam a faixa; significativo = ALTO/CRÍTICO.
 */
import type { CondicaoOperacional, FaixaNivel, Incidencia, ModoReavaliacao, Temporalidade } from "@prisma/client";
import { calcularNivel, ErroEscala } from "@/lib/escala/calculo";
import { ehSignificativo, nivelComCriteriosExtras } from "@/lib/escala/significancia";
import type { ConfigEscala, CorFaixa } from "@/lib/escala/tipos";
import { ErroNegocio } from "@/lib/erros";
import { CONDICOES, COR_FAIXA, MAX_TEXTO } from "@/lib/hira/regras";

export { agruparReavaliacaoPorObra, diffCampos, ROTULO_ACAO_HISTORICO, ROTULO_FAIXA, ROTULO_STATUS_LINHA, STATUS_LINHA, FAIXAS } from "@/lib/hira/regras";

export const TEMPORALIDADES: readonly Temporalidade[] = ["PASSADA", "ATUAL", "FUTURA"];
export const INCIDENCIAS: readonly Incidencia[] = ["DIRETA", "INDIRETA"];
export const ROTULO_SITUACAO: Record<CondicaoOperacional, string> = { NORMAL: "Normal", ANORMAL: "Anormal", EMERGENCIA: "Emergência" };
export const SIGLA_SITUACAO: Record<CondicaoOperacional, string> = { NORMAL: "N", ANORMAL: "A", EMERGENCIA: "E" };
export const ROTULO_TEMPORALIDADE: Record<Temporalidade, string> = { PASSADA: "Passada", ATUAL: "Atual", FUTURA: "Futura" };
export const ROTULO_INCIDENCIA: Record<Incidencia, string> = { DIRETA: "Direta", INDIRETA: "Indireta" };

export const EIXOS_LAIA = ["severidade", "frequencia", "abrangencia"] as const;
export type EixoLaia = (typeof EIXOS_LAIA)[number];

export interface ValoresLaia {
  severidade: number;
  frequencia: number;
  abrangencia: number;
  requisitoLegal: boolean;
  partesInteressadas: boolean;
}

export interface PontuacaoLaia {
  score: number;
  /** Faixa só pela pontuação (antes dos critérios extras). */
  faixaBase: FaixaNivel;
  /** Faixa final (após critérios extras). */
  faixa: FaixaNivel;
  significativo: boolean;
}

/** Eixo da configuração por chave (ou undefined se a empresa não usa aquele eixo). */
export function eixoLaia(config: ConfigEscala, chave: EixoLaia) {
  return config.eixos.find((e) => e.chave === chave);
}

export function pontuarLaia(config: ConfigEscala, v: ValoresLaia): PontuacaoLaia {
  const desconhecido = config.eixos.find((e) => !(EIXOS_LAIA as readonly string[]).includes(e.chave));
  if (desconhecido) throw new ErroNegocio(`Escala LAIA com eixo desconhecido "${desconhecido.chave}" (use severidade, frequencia e abrangencia).`);
  const valores: Record<string, number> = {};
  for (const e of config.eixos) valores[e.chave] = v[e.chave as EixoLaia];
  try {
    const r = calcularNivel(config, valores);
    const criterios = (config.criteriosExtras ?? []).filter((c) => (c.chave === "requisitoLegal" && v.requisitoLegal) || (c.chave === "partesInteressadas" && v.partesInteressadas));
    const faixa = nivelComCriteriosExtras({ nivelBase: r.nivel, criteriosAtendidos: criterios });
    return { score: r.score, faixaBase: r.nivel, faixa, significativo: ehSignificativo(faixa) };
  } catch (e) {
    if (e instanceof ErroEscala) throw new ErroNegocio(`${e.message} Use valores da escala configurada.`);
    throw e;
  }
}

export interface DadosLaia {
  obraId: string;
  processoId?: string | null;
  atividade: string;
  aspecto: string;
  impacto: string;
  situacao: CondicaoOperacional;
  temporalidade: Temporalidade;
  incidencia: Incidencia;
  severidade: number;
  frequencia: number;
  abrangencia: number;
  requisitoLegal: boolean;
  partesInteressadas: boolean;
  controles?: string | null;
  responsavelId?: string | null;
  modoReavaliacao?: ModoReavaliacao;
  periodicidadeMeses?: number;
}

const obrig = (v: string | null | undefined, campo: string) => {
  const t = v?.trim() ?? "";
  if (t.length < 2) throw new ErroNegocio(`Informe ${campo}.`);
  if (t.length > MAX_TEXTO) throw new ErroNegocio(`Campo "${campo}" excede ${MAX_TEXTO} caracteres.`);
  return t;
};

export function normalizarLaia(d: DadosLaia) {
  if (!d.obraId) throw new ErroNegocio("Informe a obra (a LAIA é sempre por obra).");
  if (!CONDICOES.includes(d.situacao)) throw new ErroNegocio("Situação inválida.");
  if (!TEMPORALIDADES.includes(d.temporalidade)) throw new ErroNegocio("Temporalidade inválida.");
  if (!INCIDENCIAS.includes(d.incidencia)) throw new ErroNegocio("Incidência inválida.");
  for (const k of EIXOS_LAIA) if (!Number.isInteger(d[k])) throw new ErroNegocio("Severidade, frequência e abrangência inválidas.");
  const periodicidadeMeses = d.periodicidadeMeses ?? 12;
  if (!Number.isInteger(periodicidadeMeses) || periodicidadeMeses < 1 || periodicidadeMeses > 60) throw new ErroNegocio("Periodicidade de reavaliação entre 1 e 60 meses.");
  const controles = d.controles?.trim() || null;
  if (controles && controles.length > MAX_TEXTO) throw new ErroNegocio(`Controles excedem ${MAX_TEXTO} caracteres.`);
  return {
    obraId: d.obraId,
    processoId: d.processoId || null,
    atividade: obrig(d.atividade, "a atividade"),
    aspecto: obrig(d.aspecto, "o aspecto"),
    impacto: obrig(d.impacto, "o impacto"),
    situacao: d.situacao,
    temporalidade: d.temporalidade,
    incidencia: d.incidencia,
    severidade: d.severidade,
    frequencia: d.frequencia,
    abrangencia: d.abrangencia,
    requisitoLegal: !!d.requisitoLegal,
    partesInteressadas: !!d.partesInteressadas,
    controles,
    responsavelId: d.responsavelId || null,
    modoReavaliacao: d.modoReavaliacao ?? "ITEM",
    periodicidadeMeses,
  };
}

/** Dados normalizados + pontuação: o que é gravado na linha. */
export function calcularLinhaLaia(config: ConfigEscala, d: DadosLaia) {
  const n = normalizarLaia(d);
  const { score, faixa, significativo } = pontuarLaia(config, n);
  return { ...n, score, faixa, significativo };
}

export const codigoLaia = (l: { numero: number }) => `A-${String(l.numero).padStart(3, "0")}`;

export const CAMPOS_DIFF_LAIA = [
  "atividade",
  "aspecto",
  "impacto",
  "situacao",
  "temporalidade",
  "incidencia",
  "severidade",
  "frequencia",
  "abrangencia",
  "requisitoLegal",
  "partesInteressadas",
  "score",
  "faixa",
  "significativo",
  "controles",
] as const;

export interface CelulaContagem {
  linha: number;
  coluna: number;
  contagem: number;
  cor: CorFaixa;
}

/**
 * Heatmap severidade (linha) × frequência (coluna). Cor pela pontuação com abrangência no menor
 * nível (sem critérios extras); contagem das linhas em cada combinação.
 */
export function celulasHeatmapLaia(config: ConfigEscala, itens: readonly { severidade: number; frequencia: number }[]): CelulaContagem[] {
  const eS = eixoLaia(config, "severidade");
  const eF = eixoLaia(config, "frequencia");
  if (!eS || !eF) return [];
  const eA = eixoLaia(config, "abrangencia");
  const aMin = eA ? Math.min(...eA.niveis.map((n) => n.valor)) : 1;
  const cont = new Map<string, number>();
  for (const i of itens) cont.set(`${i.severidade}-${i.frequencia}`, (cont.get(`${i.severidade}-${i.frequencia}`) ?? 0) + 1);
  const out: CelulaContagem[] = [];
  for (const s of eS.niveis) {
    for (const f of eF.niveis) {
      const p = pontuarLaia(config, { severidade: s.valor, frequencia: f.valor, abrangencia: aMin, requisitoLegal: false, partesInteressadas: false });
      out.push({ linha: s.valor, coluna: f.valor, contagem: cont.get(`${s.valor}-${f.valor}`) ?? 0, cor: COR_FAIXA[p.faixa] });
    }
  }
  return out;
}
