import type { ModoAprovacao, StatusEtapaAprovacao } from "@prisma/client";
import { formatarDataHora } from "@/lib/datas";
import { ROTULO_MODO_APROVACAO } from "@/lib/aprovacao/rotulos";
import { BadgeStatusEtapa } from "@/paginas/html/componentes/badge-aprovacao";
import styles from "@/paginas/css/componentes/trilha-assinaturas.module.css";

export interface EtapaTrilha {
  id: string;
  ordem: number;
  status: StatusEtapaAprovacao;
  decididoEm: Date | null;
  comentario: string | null;
  aprovador: { nome: string };
}

const CLASSE_MARCADOR: Record<StatusEtapaAprovacao, string> = {
  AGUARDANDO: styles.marcadorAguardando,
  PENDENTE: styles.marcadorPendente,
  APROVADA: styles.marcadorAprovada,
  REJEITADA: styles.marcadorRejeitada,
  IGNORADA: styles.marcadorIgnorada,
};

const SIMBOLO: Partial<Record<StatusEtapaAprovacao, string>> = {
  APROVADA: "✓",
  REJEITADA: "✕",
  IGNORADA: "–",
};

/**
 * Trilha de assinaturas (linha do tempo vertical, estilo DocuSign): ordem, aprovador, status,
 * data da decisão e comentário. Reutilizável em qualquer página que mostre um fluxo.
 */
export function TrilhaAssinaturas({
  etapas,
  modo,
  fuso,
  solicitante,
}: {
  etapas: EtapaTrilha[];
  modo: ModoAprovacao;
  fuso: string;
  /** Opcional: primeiro marco da linha do tempo ("Solicitou"). */
  solicitante?: { nome: string; em: Date };
}) {
  const assinadas = etapas.filter((e) => e.status === "APROVADA").length;
  return (
    <div className={styles.trilha}>
      <p className={styles.resumo}>
        {ROTULO_MODO_APROVACAO[modo]} · {assinadas} de {etapas.length} assinatura(s)
        {modo === "SEQUENCIAL" ? " — um aprovador por vez, na ordem abaixo" : " — todos podem assinar ao mesmo tempo"}
      </p>
      <ol className={styles.lista}>
        {solicitante && (
          <li className={styles.passo}>
            <span className={`${styles.marcador} ${styles.marcadorSolicitado}`} aria-hidden="true">
              ●
            </span>
            <div className={styles.conteudo}>
              <div className={styles.linhaTopo}>
                <span className={styles.nome}>{solicitante.nome}</span>
                <span className={styles.etiqueta}>Solicitou</span>
              </div>
              <span className={styles.data}>{formatarDataHora(solicitante.em, fuso)}</span>
            </div>
          </li>
        )}
        {etapas.map((e) => (
          <li key={e.id} className={styles.passo}>
            <span className={`${styles.marcador} ${CLASSE_MARCADOR[e.status]}`} aria-hidden="true">
              {SIMBOLO[e.status] ?? e.ordem}
            </span>
            <div className={styles.conteudo}>
              <div className={styles.linhaTopo}>
                {modo === "SEQUENCIAL" && <span className={styles.ordem}>{e.ordem}º</span>}
                <span className={styles.nome}>{e.aprovador.nome}</span>
                <BadgeStatusEtapa status={e.status} />
              </div>
              {e.decididoEm && <span className={styles.data}>{formatarDataHora(e.decididoEm, fuso)}</span>}
              {e.comentario && <blockquote className={styles.comentario}>{e.comentario}</blockquote>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
