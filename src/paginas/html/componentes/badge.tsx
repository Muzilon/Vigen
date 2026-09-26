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

const CLASSE_STATUS: Record<StatusRncBadge, string> = {
  ABERTO: styles.statusAberto,
  EM_ANALISE: styles.statusEmAnalise,
  PLANO_EM_EXECUCAO: styles.statusPlanoEmExecucao,
  EM_VERIFICACAO: styles.statusEmVerificacao,
  ENCERRADO: styles.statusEncerrado,
  REABERTO: styles.statusReaberto,
  CANCELADO: styles.statusCancelado,
};

const CLASSE_GRAVIDADE: Record<GravidadeBadge, string> = {
  BAIXA: styles.gravidadeBaixa,
  MEDIA: styles.gravidadeMedia,
  ALTA: styles.gravidadeAlta,
  CRITICA: styles.gravidadeCritica,
};

export function BadgeStatusRnc({ status, rotulo }: { status: StatusRncBadge; rotulo: string }) {
  return (
    <span className={`${styles.badge} ${CLASSE_STATUS[status]}`}>
      <span className={styles.ponto} aria-hidden="true" />
      {rotulo}
    </span>
  );
}

export function BadgeGravidade({ gravidade, rotulo }: { gravidade: GravidadeBadge; rotulo: string }) {
  return <span className={`${styles.gravidade} ${CLASSE_GRAVIDADE[gravidade]}`}>{rotulo}</span>;
}

/** Faixa de nível da escala (Riscos/HIRA/LAIA): BAIXO/MEDIO/ALTO/CRITICO com as cores de gravidade. */
export type FaixaBadge = "BAIXO" | "MEDIO" | "ALTO" | "CRITICO";
const GRAVIDADE_DA_FAIXA: Record<FaixaBadge, GravidadeBadge> = { BAIXO: "BAIXA", MEDIO: "MEDIA", ALTO: "ALTA", CRITICO: "CRITICA" };
const ROTULO_FAIXA_BADGE: Record<FaixaBadge, string> = { BAIXO: "Baixo", MEDIO: "Médio", ALTO: "Alto", CRITICO: "Crítico" };

export function BadgeFaixa({ faixa, score }: { faixa: FaixaBadge; score?: number | null }) {
  return <BadgeGravidade gravidade={GRAVIDADE_DA_FAIXA[faixa]} rotulo={score != null ? `${ROTULO_FAIXA_BADGE[faixa]} · ${score}` : ROTULO_FAIXA_BADGE[faixa]} />;
}

export function BadgeAtrasado({ children }: { children: ReactNode }) {
  return <span className={`${styles.badge} ${styles.atrasado}`}>{children}</span>;
}

/** Status de documento (Tramitação de Documentos) — reaproveita as cores de status da RNC. */
export type StatusDocumentoBadge = "ELABORACAO" | "EM_REVISAO" | "EM_APROVACAO" | "APROVADO" | "PUBLICADO" | "OBSOLETO" | "CANCELADO";
const COR_STATUS_DOCUMENTO: Record<StatusDocumentoBadge, StatusRncBadge> = {
  ELABORACAO: "ABERTO",
  EM_REVISAO: "EM_ANALISE",
  EM_APROVACAO: "EM_VERIFICACAO",
  APROVADO: "PLANO_EM_EXECUCAO",
  PUBLICADO: "ENCERRADO",
  OBSOLETO: "CANCELADO",
  CANCELADO: "CANCELADO",
};

export function BadgeStatusDocumento({ status, rotulo }: { status: StatusDocumentoBadge; rotulo: string }) {
  return <BadgeStatusRnc status={COR_STATUS_DOCUMENTO[status]} rotulo={rotulo} />;
}
