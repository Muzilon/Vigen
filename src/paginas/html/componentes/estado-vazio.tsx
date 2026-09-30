import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/estado-vazio.module.css";

/**
 * Mensagem exibida quando uma lista ou tabela não tem nenhum registro
 * (ex.: "Nenhuma RNC encontrada").
 * `children` é o texto que você escreve entre as tags: <EstadoVazio>Nada aqui</EstadoVazio>.
 */
export function EstadoVazio({ children }: { children: ReactNode }) {
  return <p className={styles.estadoVazio}>{children}</p>;
}
