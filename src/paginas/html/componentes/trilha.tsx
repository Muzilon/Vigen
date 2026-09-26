"use client";

import { usePathname } from "next/navigation";
import styles from "@/paginas/css/layout-app.module.css";

/** Rotas fora do menu lateral que ainda precisam de rótulo na trilha. */
const ROTULOS_EXTRAS: { href: string; label: string }[] = [
  { href: "/notificacoes", label: "Notificações" },
  { href: "/configuracoes", label: "Configurações" },
];

/** Trilha (breadcrumb) do cabeçalho: "Empresa / Rótulo da rota atual". */
export function Trilha({ empresaNome, itens }: { empresaNome: string; itens: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const atual = [...ROTULOS_EXTRAS, ...itens].reverse().find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));
  return (
    <nav aria-label="Trilha" className={styles.trilha}>
      <span>{empresaNome}</span>
      <span aria-hidden="true">/</span>
      <span className={styles.trilhaAtual}>{atual?.label ?? "Painel"}</span>
    </nav>
  );
}
