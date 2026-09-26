import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/estado-vazio.module.css";

/** Mensagem central exibida quando uma lista/tabela não tem registros. */
export function EstadoVazio({ children }: { children: ReactNode }) {
  return <p className={styles.estadoVazio}>{children}</p>;
}
