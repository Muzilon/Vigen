"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import styles from "@/paginas/css/layout-app.module.css";

export type ItemMenuLateral = { href: string; label: string; icone: ReactNode; contador?: number };

/** Item ativo = pathname exato, ou prefixo para rotas com sub-páginas (ex.: /rncs/123). */
function ehAtivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Menu principal. No desktop é a lista vertical da sidebar; até 900px a lista
 * fica recolhida atrás do botão "Menu" (hambúrguer) e abre como painel sob a
 * barra superior — fecha ao navegar, com Esc ou ao clicar fora.
 */
export function NavLateral({ itens }: { itens: ItemMenuLateral[] }) {
  const pathname = usePathname();
  const idPainel = useId();
  const [aberto, setAberto] = useState(false);
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);

  // Fecha ao trocar de rota (ajuste de estado durante o render, sem efeito)
  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    const aoClicar = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.("[data-menu-principal]")) setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("click", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("click", aoClicar);
    };
  }, [aberto]);

  const ativoAtual = itens.find((i) => ehAtivo(pathname, i.href));

  return (
    <div className={styles.menuPrincipal} data-menu-principal="">
      <button
        type="button"
        className={styles.botaoMenu}
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto((v) => !v)}
      >
        <IconeMenu aberto={aberto} />
        <span>Menu</span>
        {ativoAtual && <span className={styles.botaoMenuAtual}>· {ativoAtual.label}</span>}
      </button>
      <nav id={idPainel} aria-label="Principal" className={`${styles.navLateral} ${aberto ? styles.navLateralAberta : ""}`}>
        {itens.map((item) => {
          const ativo = ehAtivo(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`${styles.itemNav} ${ativo ? styles.itemNavAtivo : ""}`}
              onClick={() => setAberto(false)}
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
    </div>
  );
}

function IconeMenu({ aberto }: { aberto: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      {aberto ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}
