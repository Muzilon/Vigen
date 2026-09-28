/**
 * Treinamentos e competências (P7) — regras puras: validade, status por pessoa × treinamento, obrigatoriedade e a
 * matriz de competências (ISO 9001 7.2, ISO 45001 7.2).
 */
import type { ModalidadeTreinamento, MotivoGatilhoReciclagem, ResultadoEficacia, TipoTreinamento } from "@prisma/client";
import { somarDias } from "@/lib/datas";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";

export const ROTULO_MODALIDADE: Record<ModalidadeTreinamento, string> = { PRESENCIAL: "Presencial", EAD: "EAD", SEMIPRESENCIAL: "Semipresencial" };
export const MODALIDADES = Object.keys(ROTULO_MODALIDADE) as ModalidadeTreinamento[];

export const ROTULO_MOTIVO_GATILHO: Record<MotivoGatilhoReciclagem, string> = {
  MUDANCA_FUNCAO: "Mudança de função/atividade",
  RETORNO_AFASTAMENTO: "Retorno de afastamento",
  ACIDENTE_INCIDENTE: "Acidente ou incidente grave",
  MUDANCA_PROCEDIMENTO: "Mudança de procedimento/equipamento",
  OUTRO: "Outro",
};
export const MOTIVOS_GATILHO = Object.keys(ROTULO_MOTIVO_GATILHO) as MotivoGatilhoReciclagem[];

export const ROTULO_RESULTADO_EFICACIA: Record<ResultadoEficacia, string> = { EFICAZ: "Eficaz", NAO_EFICAZ: "Não eficaz" };

export const ROTULO_TIPO_TREINAMENTO: Record<TipoTreinamento, string> = {
  INTEGRACAO: "Integração",
  NR: "Norma regulamentadora (NR)",
  RECICLAGEM: "Reciclagem",
  TECNICO: "Técnico",
  CONSCIENTIZACAO: "Conscientização (ISO 7.3)",
  OUTRO: "Outro",
};
export const TIPOS_TREINAMENTO = Object.keys(ROTULO_TIPO_TREINAMENTO) as TipoTreinamento[];

/** Antecedência para "a vencer" (e para o alerta do cron). */
export const DIAS_A_VENCER = 30;

export type StatusCompetencia = "EM_DIA" | "A_VENCER" | "VENCIDO" | "NAO_REALIZADO" | "RECICLAGEM_PENDENTE";
export const ROTULO_STATUS_COMPETENCIA: Record<StatusCompetencia, string> = {
  EM_DIA: "Em dia",
  A_VENCER: "A vencer",
  VENCIDO: "Vencido",
  NAO_REALIZADO: "Não realizado",
  RECICLAGEM_PENDENTE: "Reciclagem pendente",
};
/** Status que tornam a pessoa inapta quando o treinamento é crítico e obrigatório para ela. */
export const STATUS_PENDENTES: readonly StatusCompetencia[] = ["VENCIDO", "NAO_REALIZADO", "RECICLAGEM_PENDENTE"];

/** Validade = data de realização + validadeMeses (YYYY-MM-DD). null = não vence. */
export function calcularValidade(dataRealizacao: string, validadeMeses: number | null | undefined): string | null {
  return validadeMeses ? calcularProximaReavaliacao(dataRealizacao, validadeMeses) : null;
}

/**
 * Status de uma competência a partir da última realização válida (presente):
 * sem realização → NAO_REALIZADO; sem validade → EM_DIA; validade < hoje → VENCIDO;
 * validade até hoje + `dias` → A_VENCER; senão EM_DIA. (Vence no próprio dia = ainda válido.)
 * Gatilho de reciclagem com data posterior à última realização → RECICLAGEM_PENDENTE (vencido tem precedência);
 * realização no mesmo dia do evento o resolve.
 */
export function statusCompetencia(
  realizado: { dataValidade: string | null; dataRealizacao?: string } | null,
  hoje: string,
  dias = DIAS_A_VENCER,
  ultimoGatilho: string | null = null,
): StatusCompetencia {
  if (!realizado) return "NAO_REALIZADO";
  const v = realizado.dataValidade;
  if (v && v < hoje) return "VENCIDO";
  if (ultimoGatilho && realizado.dataRealizacao && ultimoGatilho > realizado.dataRealizacao) return "RECICLAGEM_PENDENTE";
  if (!v) return "EM_DIA";
  if (v <= somarDias(hoje, dias)) return "A_VENCER";
  return "EM_DIA";
}

export interface RegraObrigatoriedade {
  obrigatorioTodos: boolean;
  obrigatorioSetorIds: readonly string[];
  obrigatorioFuncaoIds?: readonly string[];
}

/** Obrigatório para todos os usuários ativos OU para os setores listados OU para as funções listadas (união). */
export function ehObrigatorio(t: RegraObrigatoriedade, u: { setorId: string | null; funcaoId?: string | null }): boolean {
  return (
    t.obrigatorioTodos ||
    (!!u.setorId && t.obrigatorioSetorIds.includes(u.setorId)) ||
    (!!u.funcaoId && !!t.obrigatorioFuncaoIds?.includes(u.funcaoId))
  );
}

export interface ParticipacaoMatriz {
  usuarioId: string;
  treinamentoId: string;
  presente: boolean;
  /** YYYY-MM-DD */
  dataRealizacao: string;
  dataValidade: string | null;
}

/** Última realização (presente) por usuário×treinamento: maior data de realização; empate → maior validade. */
export function ultimasRealizacoes(ps: readonly ParticipacaoMatriz[]): Map<string, ParticipacaoMatriz> {
  const m = new Map<string, ParticipacaoMatriz>();
  for (const p of ps) {
    if (!p.presente) continue;
    const k = `${p.usuarioId}:${p.treinamentoId}`;
    const a = m.get(k);
    if (!a || p.dataRealizacao > a.dataRealizacao || (p.dataRealizacao === a.dataRealizacao && (p.dataValidade ?? "9999") > (a.dataValidade ?? "9999"))) m.set(k, p);
  }
  return m;
}

export interface CelulaMatriz {
  treinamentoId: string;
  obrigatorio: boolean;
  /** null = não obrigatório e nunca realizado (célula vazia na matriz). */
  status: StatusCompetencia | null;
  dataRealizacao: string | null;
  dataValidade: string | null;
}

export interface Aptidao {
  apto: boolean;
  /** Treinamentos críticos obrigatórios com pendência (motivo da inaptidão). */
  pendencias: { treinamentoId: string; status: StatusCompetencia }[];
}

export interface LinhaMatriz<U> {
  usuario: U;
  celulas: CelulaMatriz[];
  aptidao: Aptidao;
}

export interface GatilhoMatriz {
  usuarioId: string;
  treinamentoId: string;
  /** YYYY-MM-DD */
  dataEvento: string;
}

/** Data do gatilho mais recente por usuário×treinamento. */
export function ultimosGatilhos(gs: readonly GatilhoMatriz[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of gs) {
    const k = `${g.usuarioId}:${g.treinamentoId}`;
    const a = m.get(k);
    if (!a || g.dataEvento > a) m.set(k, g.dataEvento);
  }
  return m;
}

/** Aptidão calculada: inapto se algum treinamento crítico obrigatório estiver vencido, não realizado ou com reciclagem pendente. */
export function calcularAptidao(celulas: readonly CelulaMatriz[], criticos: ReadonlySet<string>): Aptidao {
  const pendencias = celulas
    .filter((c) => c.obrigatorio && criticos.has(c.treinamentoId) && c.status && STATUS_PENDENTES.includes(c.status))
    .map((c) => ({ treinamentoId: c.treinamentoId, status: c.status! }));
  return { apto: pendencias.length === 0, pendencias };
}

/** Matriz usuário × treinamento com status por célula, aptidão por pessoa e o resumo (% em dia entre as obrigatórias). */
export function montarMatriz<U extends { id: string; setorId: string | null; funcaoId?: string | null }, T extends RegraObrigatoriedade & { id: string; critico?: boolean }>(
  usuarios: readonly U[],
  treinamentos: readonly T[],
  participacoes: readonly ParticipacaoMatriz[],
  hoje: string,
  dias = DIAS_A_VENCER,
  gatilhos: readonly GatilhoMatriz[] = [],
) {
  const ultimas = ultimasRealizacoes(participacoes);
  const eventos = ultimosGatilhos(gatilhos);
  const criticos = new Set(treinamentos.filter((t) => t.critico).map((t) => t.id));
  const linhas: LinhaMatriz<U>[] = usuarios.map((u) => {
    const celulas = treinamentos.map((t) => {
      const k = `${u.id}:${t.id}`;
      const r = ultimas.get(k) ?? null;
      const obrigatorio = ehObrigatorio(t, u);
      return {
        treinamentoId: t.id,
        obrigatorio,
        status: r || obrigatorio ? statusCompetencia(r, hoje, dias, eventos.get(k) ?? null) : null,
        dataRealizacao: r?.dataRealizacao ?? null,
        dataValidade: r?.dataValidade ?? null,
      };
    });
    return { usuario: u, celulas, aptidao: calcularAptidao(celulas, criticos) };
  });
  return { linhas, resumo: { ...resumirMatriz(linhas.flatMap((l) => l.celulas)), inaptos: linhas.filter((l) => !l.aptidao.apto).length } };
}

/** % em dia = obrigatórias EM_DIA ou A_VENCER ÷ obrigatórias. Contagens de a vencer/vencidos consideram todas as células. */
export function resumirMatriz(celulas: readonly Pick<CelulaMatriz, "obrigatorio" | "status">[]) {
  const obrig = celulas.filter((c) => c.obrigatorio);
  const validas = obrig.filter((c) => c.status === "EM_DIA" || c.status === "A_VENCER").length;
  return {
    obrigatorias: obrig.length,
    emDia: validas,
    percentualEmDia: obrig.length ? Math.round((validas / obrig.length) * 100) : null,
    aVencer: celulas.filter((c) => c.status === "A_VENCER").length,
    vencidos: celulas.filter((c) => c.status === "VENCIDO").length,
    naoRealizados: obrig.filter((c) => c.status === "NAO_REALIZADO").length,
    reciclagemPendente: celulas.filter((c) => c.status === "RECICLAGEM_PENDENTE").length,
  };
}

// ---------------------------------------------------------------- avaliação de eficácia (ISO 9001 7.2 c)

export type SituacaoEficacia = "EFICAZ" | "NAO_EFICAZ" | "AGUARDANDO" | "PENDENTE";
export const ROTULO_SITUACAO_EFICACIA: Record<SituacaoEficacia, string> = {
  EFICAZ: "Eficaz",
  NAO_EFICAZ: "Não eficaz",
  AGUARDANDO: "Aguardando prazo",
  PENDENTE: "Avaliação pendente",
};

/**
 * Situação da eficácia de uma participação. null = não se aplica (ausente ou treinamento sem avaliação).
 * Antes do prazo (data da sessão + dias) = AGUARDANDO; a partir dele sem resultado = PENDENTE. Pode-se avaliar antes do prazo.
 */
export function situacaoEficacia(
  p: { presente: boolean; eficaciaResultado: ResultadoEficacia | null },
  dataRealizacao: string,
  diasAvaliacao: number | null | undefined,
  hoje: string,
): SituacaoEficacia | null {
  if (!p.presente) return null;
  if (p.eficaciaResultado) return p.eficaciaResultado;
  if (!diasAvaliacao) return null;
  return hoje >= somarDias(dataRealizacao, diasAvaliacao) ? "PENDENTE" : "AGUARDANDO";
}

// ---------------------------------------------------------------- conformidade da sessão com a NR-1 (item 1.7 e Anexo II)

/** Tipos cujo certificado precisa atender à NR-1. */
export const TIPOS_COM_NR1: readonly TipoTreinamento[] = ["NR", "RECICLAGEM"];

/**
 * Pendências da sessão frente à NR-1: conteúdo programático, instrutor com qualificação e carga horária ≥ a do catálogo.
 * Lista vazia = conforme. Não se aplica (null) a tipos fora de TIPOS_COM_NR1.
 */
export function pendenciasNr1(
  t: { tipo: TipoTreinamento; cargaHoraria: number | null },
  s: { cargaHoraria: number | null; conteudoProgramatico: string | null; qualificacaoInstrutor: string | null },
): string[] | null {
  if (!TIPOS_COM_NR1.includes(t.tipo)) return null;
  const out: string[] = [];
  if (!s.conteudoProgramatico?.trim()) out.push("Conteúdo programático não informado");
  if (!s.qualificacaoInstrutor?.trim()) out.push("Qualificação do instrutor não informada");
  if (!s.cargaHoraria) out.push("Carga horária da sessão não informada");
  else if (t.cargaHoraria && s.cargaHoraria < t.cargaHoraria) out.push(`Carga horária (${s.cargaHoraria} h) abaixo do mínimo do treinamento (${t.cargaHoraria} h)`);
  return out;
}
