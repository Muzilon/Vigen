import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/cartao.module.css";

/**
 * "Cartão": a caixa branca com borda que agrupa um bloco de conteúdo na página.
 * - `titulo`: título opcional no topo do cartão.
 * - `acoes`: botões/links opcionais exibidos à direita do título.
 * - `children`: o conteúdo de dentro do cartão.
 * - `className`: classe CSS extra, se precisar personalizar.
 */
export function Cartao({ titulo, acoes, children, className }: { titulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${styles.cartao} ${className ?? ""}`}>
      {titulo && (
        <div className={styles.cabecalhoInterno}>
          <h2 className={styles.titulo}>{titulo}</h2>
          {acoes}
        </div>
      )}
      <div className={styles.corpo}>{children}</div>
    </section>
  );
}
