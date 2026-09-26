import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/alerta.module.css";

const CLASSE_VARIANTE = { erro: styles.erro, aviso: styles.aviso } as const;

/** Alerta inline (erro de formulário, aviso de bloqueio, etc.). */
export function Alerta({
  variante = "erro",
  icone,
  children,
  ...props
}: { variante?: keyof typeof CLASSE_VARIANTE; icone?: ReactNode; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.alerta} ${CLASSE_VARIANTE[variante]}`} {...props}>
      {icone && (
        <span className={styles.icone} aria-hidden="true">
          {icone}
        </span>
      )}
      <span>{children}</span>
    </div>
  );
}
