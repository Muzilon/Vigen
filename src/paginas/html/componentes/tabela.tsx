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

/** Linha de cabeçalho da tabela (a que contém os títulos das colunas, os <Th>). */
export function LinhaCabecalhoTabela({ children }: { children: ReactNode }) {
  return <tr className={styles.linhaCabecalho}>{children}</tr>;
}

/** Célula de título de uma coluna (<th>) já com o estilo padrão das tabelas. */
export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`${styles.th} ${className ?? ""}`} {...props} />;
}

/** Uma linha de dados da tabela (<tr>) com o estilo padrão (borda, destaque ao passar o mouse). */
export function LinhaTabela({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={styles.linha} {...props}>
      {children}
    </tr>
  );
}

// Estilos possíveis de uma célula: texto normal, texto apagado (secundário), texto cortado com "..."
// quando é longo demais (truncado) ou fonte de código/número (mono).
type VarianteTd = "padrao" | "secundario" | "truncado" | "mono";
const CLASSE_TD: Record<VarianteTd, string> = {
  padrao: styles.td,
  secundario: styles.tdSecundario,
  truncado: styles.tdTruncado,
  mono: styles.tdMono,
};

/** Célula de dados da tabela (<td>). Escolha o estilo pela propriedade `variante`. */
export function Td({ variante = "padrao", className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { variante?: VarianteTd }) {
  return <td className={`${CLASSE_TD[variante]} ${className ?? ""}`} {...props} />;
}
