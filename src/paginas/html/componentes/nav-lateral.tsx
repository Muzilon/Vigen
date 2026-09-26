"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "@/paginas/css/layout-app.module.css";

export type ItemMenuLateral = { href: string; label: string; icone: ReactNode; contador?: number };

/** Item ativo = pathname exato, ou prefixo para rotas com sub-páginas (ex.: /rncs/123). */
function ehAtivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLateral({ itens }: { itens: ItemMenuLateral[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className={styles.navLateral}>
      {itens.map((item) => {
        const ativo = ehAtivo(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`${styles.itemNav} ${ativo ? styles.itemNavAtivo : ""}`}
          >
            <span className={styles.iconeItemNav} aria-hidden="true">
              {item.icone}
            </span>
            <span className={styles.rotuloItemNav}>{item.label}</span>
            {item.contador !== undefined && item.contador > 0 && (
              <span className={ativo ? styles.contadorItemNavAtivo : styles.contadorItemNav}>
                {item.contador > 99 ? "99+" : item.contador}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
