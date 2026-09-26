import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/cartao.module.css";

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
