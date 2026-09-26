import Link from "next/link";
import type { TipoEntidadeAprovacao } from "@prisma/client";
import { listarFluxosDaEntidade } from "@/lib/aprovacao";
import { ROTULO_TIPO_ALTERACAO } from "@/lib/aprovacao/rotulos";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { BadgeStatusFluxo } from "@/paginas/html/componentes/badge-aprovacao";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/componentes/aprovacoes-da-entidade.module.css";

/**
 * Lista os fluxos de aprovação de um registro (visíveis ao usuário), com status, progresso e
 * link para o detalhe. Server component: basta renderizar na página do módulo.
 */
export async function AprovacoesDaEntidade({
  entidadeTipo,
  entidadeId,
  titulo = "Aprovações",
}: {
  entidadeTipo: TipoEntidadeAprovacao;
  entidadeId: string;
  titulo?: string;
}) {
  const a = await getAtor();
  const [fuso, fluxos] = await Promise.all([fusoDaEmpresa(a), listarFluxosDaEntidade(a, entidadeTipo, entidadeId)]);
  return (
    <section className={styles.painel} aria-label={titulo}>
      <h2 className={styles.titulo}>{titulo}</h2>
      {fluxos.length === 0 ? (
        <EstadoVazio>Nenhuma aprovação para este registro.</EstadoVazio>
      ) : (
        <ul className={styles.lista}>
          {fluxos.map((f) => {
            const assinadas = f.etapas.filter((e) => e.status === "APROVADA").length;
            return (
              <li key={f.id} className={styles.item}>
                <div className={styles.principal}>
                  <Link href={`/aprovacoes/${f.id}`} className={styles.link}>
                    {f.resumo}
                  </Link>
                  <span className={styles.meta}>
                    {ROTULO_TIPO_ALTERACAO[f.tipoAlteracao]} · {f.solicitante.nome} · {formatarDataHora(f.criadoEm, fuso)}
                  </span>
                </div>
                <span className={styles.progresso}>
                  {assinadas}/{f.etapas.length}
                </span>
                <BadgeStatusFluxo status={f.status} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
