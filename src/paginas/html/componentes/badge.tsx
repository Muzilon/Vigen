import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/badge.module.css";

/**
 * Badges de status/gravidade da Direção A "Campo". Usam os tokens de cor de
 * src/paginas/css/base.css (seções 03 e 04) — nunca hex solto aqui.
 */

export type StatusRncBadge =
  | "ABERTO"
  | "EM_ANALISE"
  | "PLANO_EM_EXECUCAO"
  | "EM_VERIFICACAO"
  | "ENCERRADO"
  | "REABERTO"
  | "CANCELADO";

export type GravidadeBadge = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

// Liga cada status da RNC à classe de cor do CSS (ex.: ENCERRADO → verde).
const CLASSE_STATUS: Record<StatusRncBadge, string> = {
  ABERTO: styles.statusAberto,
  EM_ANALISE: styles.statusEmAnalise,
  PLANO_EM_EXECUCAO: styles.statusPlanoEmExecucao,
  EM_VERIFICACAO: styles.statusEmVerificacao,
  ENCERRADO: styles.statusEncerrado,
  REABERTO: styles.statusReaberto,
  CANCELADO: styles.statusCancelado,
};

// Liga cada gravidade à sua classe de cor do CSS (baixa → verde ... crítica → vermelho).
const CLASSE_GRAVIDADE: Record<GravidadeBadge, string> = {
  BAIXA: styles.gravidadeBaixa,
  MEDIA: styles.gravidadeMedia,
  ALTA: styles.gravidadeAlta,
  CRITICA: styles.gravidadeCritica,
};

/**
 * Etiqueta colorida com um ponto e o texto do status. É a base dos outros badges de status:
 * eles só traduzem o seu status para um status de RNC (para reaproveitar as cores) e chamam esta função.
 * - `status`: decide a cor. `rotulo`: o texto que aparece.
 */
export function BadgeStatusRnc({ status, rotulo }: { status: StatusRncBadge; rotulo: string }) {
  return (
    <span className={`${styles.badge} ${CLASSE_STATUS[status]}`}>
      <span className={styles.ponto} aria-hidden="true" />
      {rotulo}
    </span>
  );
}

/** Etiqueta de gravidade (Baixa, Média, Alta, Crítica) — sem ponto, só texto colorido. */
export function BadgeGravidade({ gravidade, rotulo }: { gravidade: GravidadeBadge; rotulo: string }) {
  return <span className={`${styles.gravidade} ${CLASSE_GRAVIDADE[gravidade]}`}>{rotulo}</span>;
}

/** Faixa de nível da escala (Riscos/HIRA/LAIA): BAIXO/MEDIO/ALTO/CRITICO com as cores de gravidade. */
export type FaixaBadge = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";
// Traduz a faixa de nível (Baixo...Crítico) para uma gravidade, para reaproveitar as mesmas cores.
// Logo abaixo, os textos em português de cada faixa.
const GRAVIDADE_DA_FAIXA: Record<FaixaBadge, GravidadeBadge> = { BAIXO: "BAIXA", MEDIO: "MEDIA", ALTO: "ALTA", CRITICO: "CRITICA" };
const ROTULO_FAIXA_BADGE: Record<FaixaBadge, string> = { BAIXO: "Baixo", MEDIO: "Médio", ALTO: "Alto", CRITICO: "Crítico" };

/** Etiqueta do nível de risco (Baixo/Médio/Alto/Crítico); se passar `score`, mostra junto: "Alto · 12". */
export function BadgeFaixa({ faixa, score }: { faixa: FaixaBadge; score?: number | null }) {
  return <BadgeGravidade gravidade={GRAVIDADE_DA_FAIXA[faixa]} rotulo={score != null ? `${ROTULO_FAIXA_BADGE[faixa]} · ${score}` : ROTULO_FAIXA_BADGE[faixa]} />;
}

/** Etiqueta vermelha para indicar atraso (o texto é o que você colocar dentro). */
export function BadgeAtrasado({ children }: { children: ReactNode }) {
  return <span className={`${styles.badge} ${styles.atrasado}`}>{children}</span>;
}

/** Status de documento (Tramitação de Documentos) — reaproveita as cores de status da RNC. */
export type StatusDocumentoBadge = "ELABORACAO" | "EM_REVISAO" | "EM_APROVACAO" | "APROVADO" | "PUBLICADO" | "OBSOLETO" | "CANCELADO";
// Cada status de documento "empresta" a cor de um status de RNC (ex.: Publicado usa o verde de Encerrado).
const COR_STATUS_DOCUMENTO: Record<StatusDocumentoBadge, StatusRncBadge> = {
  ELABORACAO: "ABERTO",
  EM_REVISAO: "EM_ANALISE",
  EM_APROVACAO: "EM_VERIFICACAO",
  APROVADO: "PLANO_EM_EXECUCAO",
  PUBLICADO: "ENCERRADO",
  OBSOLETO: "CANCELADO",
  CANCELADO: "CANCELADO",
};

/** Etiqueta do status de um documento (Elaboração, Em revisão, Publicado, Obsoleto...). */
export function BadgeStatusDocumento({ status, rotulo }: { status: StatusDocumentoBadge; rotulo: string }) {
  return <BadgeStatusRnc status={COR_STATUS_DOCUMENTO[status]} rotulo={rotulo} />;
}

/** Gravidade de incidente (P6) — sem afastamento / com afastamento / fatalidade nas cores de gravidade. */
export type GravidadeIncidenteBadge = "SEM_AFASTAMENTO" | "COM_AFASTAMENTO" | "FATALIDADE";
// Cor de cada gravidade de incidente (sem afastamento = média, com afastamento = alta, fatalidade = crítica).
const COR_GRAVIDADE_INCIDENTE: Record<GravidadeIncidenteBadge, GravidadeBadge> = { SEM_AFASTAMENTO: "MEDIA", COM_AFASTAMENTO: "ALTA", FATALIDADE: "CRITICA" };

/** Etiqueta da gravidade de um incidente/acidente. */
export function BadgeGravidadeIncidente({ gravidade, rotulo }: { gravidade: GravidadeIncidenteBadge; rotulo: string }) {
  return <BadgeGravidade gravidade={COR_GRAVIDADE_INCIDENTE[gravidade]} rotulo={rotulo} />;
}

/** Status de incidente (P6) — aberto / em investigação / concluído nas cores de status da RNC. */
export type StatusIncidenteBadge = "ABERTO" | "EM_INVESTIGACAO" | "CONCLUIDO";
// Cor de cada status de incidente.
const COR_STATUS_INCIDENTE: Record<StatusIncidenteBadge, StatusRncBadge> = { ABERTO: "ABERTO", EM_INVESTIGACAO: "EM_ANALISE", CONCLUIDO: "ENCERRADO" };

/** Etiqueta do status de um incidente (Aberto, Em investigação, Concluído). */
export function BadgeStatusIncidente({ status, rotulo }: { status: StatusIncidenteBadge; rotulo: string }) {
  return <BadgeStatusRnc status={COR_STATUS_INCIDENTE[status]} rotulo={rotulo} />;
}

/** Situação do indicador (P7) no último período fechado — atingido verde, não atingido vermelho, sem lançamento cinza. */
export type SituacaoIndicadorBadge = "ATINGIDO" | "NAO_ATINGIDO" | "SEM_LANCAMENTO";
// Cor de cada situação de indicador (atingido = verde, não atingido = vermelho, sem lançamento = cinza).
const COR_SITUACAO_INDICADOR: Record<SituacaoIndicadorBadge, StatusRncBadge> = { ATINGIDO: "ENCERRADO", NAO_ATINGIDO: "REABERTO", SEM_LANCAMENTO: "CANCELADO" };

/** Etiqueta da situação de um indicador no último período fechado. */
export function BadgeSituacaoIndicador({ situacao, rotulo }: { situacao: SituacaoIndicadorBadge; rotulo: string }) {
  return <BadgeStatusRnc status={COR_SITUACAO_INDICADOR[situacao]} rotulo={rotulo} />;
}

/** Status de competência (P7 — treinamentos): em dia verde, a vencer âmbar, vencido vermelho, não realizado cinza. */
export type StatusCompetenciaBadge = "EM_DIA" | "A_VENCER" | "VENCIDO" | "NAO_REALIZADO" | "RECICLAGEM_PENDENTE";
// Cor de cada status de competência de treinamento.
const COR_STATUS_COMPETENCIA: Record<StatusCompetenciaBadge, StatusRncBadge> = {
  EM_DIA: "ENCERRADO",
  A_VENCER: "PLANO_EM_EXECUCAO",
  VENCIDO: "REABERTO",
  NAO_REALIZADO: "CANCELADO",
  RECICLAGEM_PENDENTE: "ABERTO",
};

/** Etiqueta do status de um treinamento de uma pessoa (Em dia, A vencer, Vencido, Não realizado, Reciclagem pendente). */
export function BadgeStatusCompetencia({ status, rotulo }: { status: StatusCompetenciaBadge; rotulo: string }) {
  return <BadgeStatusRnc status={COR_STATUS_COMPETENCIA[status]} rotulo={rotulo} />;
}

/**
 * Etiqueta "Apto" (verde) ou "Inapto" (vermelho) de uma pessoa para o trabalho.
 * `titulo` é um texto que aparece ao passar o mouse (ex.: o motivo da inaptidão).
 */
export function BadgeAptidao({ apto, titulo }: { apto: boolean; titulo?: string }) {
  return (
    <span title={titulo}>
      <BadgeStatusRnc status={apto ? "ENCERRADO" : "REABERTO"} rotulo={apto ? "Apto" : "Inapto"} />
    </span>
  );
}

/** Situações possíveis da avaliação de eficácia de um treinamento. */
export type SituacaoEficaciaBadge = "EFICAZ" | "NAO_EFICAZ" | "AGUARDANDO" | "PENDENTE";
// Cor de cada situação de eficácia.
const COR_EFICACIA: Record<SituacaoEficaciaBadge, StatusRncBadge> = { EFICAZ: "ENCERRADO", NAO_EFICAZ: "REABERTO", AGUARDANDO: "CANCELADO", PENDENTE: "PLANO_EM_EXECUCAO" };

/** Etiqueta da avaliação de eficácia (Eficaz, Não eficaz, Aguardando prazo, Avaliação pendente). */
export function BadgeEficacia({ situacao, rotulo }: { situacao: SituacaoEficaciaBadge; rotulo: string }) {
  return <BadgeStatusRnc status={COR_EFICACIA[situacao]} rotulo={rotulo} />;
}
