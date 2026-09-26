import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/paginas/css/layout-app.module.css";
import { NavLateral, type ItemMenuLateral } from "@/paginas/html/componentes/nav-lateral";
import { Trilha } from "@/paginas/html/componentes/trilha";
import { CampoBusca } from "@/paginas/html/componentes/campo-formulario";

const ROTULO_PAPEL_CURTO: Record<string, string> = {
  ADMIN: "Administrador",
  GESTOR_SGI: "Gestor SGI",
  INSPETOR: "Inspetor",
  COLABORADOR: "Colaborador",
};

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Casca da área logada (Direção A "Campo"): sidebar escura fixa + cabeçalho
 * sticky. Ver docs/05-guia-paginas-css.md para a escala de z-index e as
 * regras de "cabeçalho sempre no topo".
 */
export function LayoutApp({
  itensMenu,
  empresaNome,
  usuarioNome,
  usuarioPapel,
  naoLidas,
  aoSair,
  children,
}: {
  itensMenu: ItemMenuLateral[];
  empresaNome: string;
  usuarioNome: string;
  usuarioPapel: string;
  naoLidas: number;
  aoSair: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.casca} fonteIbmPlex`}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <IconeLogo />
          <span className={styles.logoTexto}>Vigen</span>
        </div>

        <button type="button" className={styles.seletorEmpresa}>
          <span className={styles.iniciaisEmpresa}>{iniciais(empresaNome)}</span>
          <span className={styles.textoEmpresa}>
            <span className={styles.nomeEmpresa}>{empresaNome}</span>
          </span>
        </button>

        <NavLateral itens={itensMenu} />

        <div className={styles.espacador} />

        <div className={styles.rodapeUsuario}>
          <span className={styles.avatarUsuario}>{iniciais(usuarioNome)}</span>
          <span className={styles.textoUsuario}>
            <span className={styles.nomeUsuario}>{usuarioNome}</span>
            <span className={styles.cargoUsuario}>{ROTULO_PAPEL_CURTO[usuarioPapel] ?? usuarioPapel}</span>
          </span>
          <form action={aoSair}>
            <button type="submit" aria-label="Sair" className={styles.botaoSair}>
              <IconeSair />
            </button>
          </form>
        </div>
      </aside>

      <div className={styles.colunaPrincipal}>
        <header className={styles.cabecalho}>
          <Trilha empresaNome={empresaNome} itens={itensMenu} />
          <div className={styles.buscaGlobal}>
            <CampoBusca id="busca-global" type="search" placeholder="Buscar RNC, item ou pessoa" aria-label="Buscar" />
          </div>
          <Link
            href="/notificacoes"
            aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lida(s)` : "Notificações"}
            className={styles.botaoSino}
          >
            <IconeSino />
            {naoLidas > 0 && <span className={styles.contadorSino}>{naoLidas > 99 ? "99+" : naoLidas}</span>}
          </Link>
        </header>

        <main className={styles.conteudo}>{children}</main>
      </div>
    </div>
  );
}

function IconeLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
      <path d="m8.5 9 3.5 6.5L15.5 9" />
    </svg>
  );
}

function IconeSino() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function IconeSair() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
