"use client";

import { usePathname } from "next/navigation";
import styles from "@/paginas/css/layout-app.module.css";

/** Trilha (breadcrumb) do cabeçalho: "Empresa / Rótulo da rota atual". */
export function Trilha({ empresaNome, itens }: { empresaNome: string; itens: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const atual = [...itens].reverse().find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));
  return (
    <nav aria-label="Trilha" className={styles.trilha}>
      <span>{empresaNome}</span>
      <span aria-hidden="true">/</span>
      <span className={styles.trilhaAtual}>{atual?.label ?? "Painel"}</span>
    </nav>
  );
}
