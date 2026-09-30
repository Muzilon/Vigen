import type { StatusEtapaAprovacao, StatusFluxoAprovacao } from "@prisma/client";
import { ROTULO_STATUS_ETAPA, ROTULO_STATUS_FLUXO } from "@/lib/aprovacao/rotulos";
import styles from "@/paginas/css/componentes/badge-aprovacao.module.css";

const CLASSE_FLUXO: Record<StatusFluxoAprovacao, string> = {
  PENDENTE: styles.pendente,
  APROVADO: styles.aprovado,
  REJEITADO: styles.rejeitado,
  CANCELADO: styles.neutro,
};

const CLASSE_ETAPA: Record<StatusEtapaAprovacao, string> = {
  AGUARDANDO: styles.neutro,
  PENDENTE: styles.pendente,
  APROVADA: styles.aprovado,
  REJEITADA: styles.rejeitado,
  IGNORADA: styles.neutro,
};

/**
 * Etiqueta colorida (badge) com o status do fluxo de aprovação inteiro:
 * Pendente, Aprovado, Rejeitado ou Cancelado. A cor vem do mapa CLASSE_FLUXO acima,
 * e o texto em português vem de ROTULO_STATUS_FLUXO.
 */
export function BadgeStatusFluxo({ status }: { status: StatusFluxoAprovacao }) {
  return (
    <span className={`${styles.badge} ${CLASSE_FLUXO[status]}`}>
      <span className={styles.ponto} aria-hidden="true" />
      {ROTULO_STATUS_FLUXO[status]}
    </span>
  );
}

/**
 * Etiqueta colorida com o status de uma assinatura individual (etapa) do fluxo:
 * Aguardando, Pendente, Aprovada, Rejeitada ou Ignorada.
 */
export function BadgeStatusEtapa({ status }: { status: StatusEtapaAprovacao }) {
  return (
    <span className={`${styles.badge} ${CLASSE_ETAPA[status]}`}>
      <span className={styles.ponto} aria-hidden="true" />
      {ROTULO_STATUS_ETAPA[status]}
    </span>
  );
}
