import type { StatusEfetivoItem, StatusGeralPlano } from "@/lib/plano-acao/status";
import { ROTULO_STATUS_ITEM, ROTULO_STATUS_PLANO } from "@/lib/rnc/rotulos";
import styles from "@/paginas/css/componentes/badge-status-item.module.css";

/**
 * Badges de status de item 5W2H e de status geral de plano de ação (Direção A "Campo").
 * Tokens de cor de src/paginas/css/base.css (sem hex solto).
 */
const CLASSE_STATUS: Record<StatusEfetivoItem | StatusGeralPlano, string> = {
  SEM_ITENS: styles.semItens,
  PENDENTE: styles.pendente,
  EM_ANDAMENTO: styles.emAndamento,
  CONCLUIDO: styles.concluido,
  CANCELADO: styles.cancelado,
  ATRASADO: styles.atrasado,
};

/**
 * Peça interna usada pelos dois badges abaixo: desenha a etiqueta colorida com o texto.
 * Se o status for ATRASADO, acrescenta um ícone de relógio antes do texto.
 */
function Conteudo({ status, rotulo }: { status: StatusEfetivoItem | StatusGeralPlano; rotulo: string }) {
  return (
    <span className={`${styles.badge} ${CLASSE_STATUS[status]}`}>
      {status === "ATRASADO" && <IconeRelogio />}
      {rotulo}
    </span>
  );
}

/** Etiqueta com o status de UM item do plano 5W2H (Pendente, Em andamento, Concluído, Atrasado...). */
export function BadgeStatusItem({ status }: { status: StatusEfetivoItem }) {
  return <Conteudo status={status} rotulo={ROTULO_STATUS_ITEM[status]} />;
}

/** Etiqueta com o status geral do plano de ação inteiro (calculado a partir dos itens dele). */
export function BadgeStatusPlano({ status }: { status: StatusGeralPlano }) {
  return <Conteudo status={status} rotulo={ROTULO_STATUS_PLANO[status]} />;
}

/** Badge neutro de origem (ex.: "Manual" para plano avulso, sem RNC). */
export function BadgeOrigem({ children }: { children: React.ReactNode }) {
  return <span className={`${styles.badge} ${styles.origem}`}>{children}</span>;
}

/**
 * Etiqueta "Sem evidência": mostrada ao lado do status de um item concluído sem anexo, descrição nem link.
 * Não aparece em item em aberto nem em item concluído com evidência.
 */
export function BadgeSemEvidencia({ item }: { item: { status: string; semEvidencia: boolean } }) {
  if (item.status !== "CONCLUIDO" || !item.semEvidencia) return null;
  return (
    <span className={`${styles.badge} ${styles.semEvidencia}`} title="Concluída sem anexo, descrição ou link de evidência">
      Sem evidência
    </span>
  );
}

/** Desenho (SVG) de um relógio, mostrado nos itens atrasados. */
function IconeRelogio() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
