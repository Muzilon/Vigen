import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/alerta.module.css";

const CLASSE_VARIANTE = { erro: styles.erro, aviso: styles.aviso } as const;

/**
 * Faixa de alerta dentro da página (mensagem de erro de formulário, aviso de bloqueio etc.).
 * - `variante`: "erro" (vermelho, padrão) ou "aviso" (amarelo).
 * - `icone`: ícone opcional à esquerda do texto.
 * - `children`: o texto do alerta.
 */
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
