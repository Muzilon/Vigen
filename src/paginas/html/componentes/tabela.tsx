import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import styles from "@/paginas/css/componentes/tabela.module.css";

/** Moldura branca com borda que envolve uma tabela densa (linhas de 44px). */
export function EnvoltorioTabela({ children }: { children: ReactNode }) {
  return <div className={styles.envoltorio}>{children}</div>;
}

/** <table> com layout fixo — cada página define a largura das colunas via <colgroup>. */
export function Tabela({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={`${styles.tabela} ${className ?? ""}`}>{children}</table>;
}

export function LinhaCabecalhoTabela({ children }: { children: ReactNode }) {
  return <tr className={styles.linhaCabecalho}>{children}</tr>;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`${styles.th} ${className ?? ""}`} {...props} />;
}

export function LinhaTabela({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={styles.linha} {...props}>
      {children}
    </tr>
  );
}

type VarianteTd = "padrao" | "secundario" | "truncado" | "mono";
const CLASSE_TD: Record<VarianteTd, string> = {
  padrao: styles.td,
  secundario: styles.tdSecundario,
  truncado: styles.tdTruncado,
  mono: styles.tdMono,
};

export function Td({ variante = "padrao", className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { variante?: VarianteTd }) {
  return <td className={`${CLASSE_TD[variante]} ${className ?? ""}`} {...props} />;
}
