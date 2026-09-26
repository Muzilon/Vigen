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

/** Status do fluxo de aprovação (Pendente / Aprovado / Rejeitado / Cancelado). */
export function BadgeStatusFluxo({ status }: { status: StatusFluxoAprovacao }) {
  return (
    <span className={`${styles.badge} ${CLASSE_FLUXO[status]}`}>
      <span className={styles.ponto} aria-hidden="true" />
      {ROTULO_STATUS_FLUXO[status]}
    </span>
  );
}

/** Status de uma assinatura (etapa) do fluxo. */
export function BadgeStatusEtapa({ status }: { status: StatusEtapaAprovacao }) {
  return (
    <span className={`${styles.badge} ${CLASSE_ETAPA[status]}`}>
      <span className={styles.ponto} aria-hidden="true" />
      {ROTULO_STATUS_ETAPA[status]}
    </span>
  );
}
