"use client";

import { usePathname } from "next/navigation";
import styles from "@/paginas/css/layout-app.module.css";

/** Rotas fora do menu lateral que ainda precisam de rótulo na trilha. */
const ROTULOS_EXTRAS: { href: string; label: string }[] = [
  { href: "/notificacoes", label: "Notificações" },
  { href: "/configuracoes", label: "Configurações" },
];

/**
 * Trilha de navegação do cabeçalho, no formato "Empresa / Nome da página atual".
 * Descobre em que página o usuário está comparando o endereço atual (`usePathname`)
 * com a lista de itens do menu; se não achar nenhum, mostra "Painel".
 * Precisa ser "use client" porque lê o endereço do navegador.
 */
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
