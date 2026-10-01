"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import styles from "@/paginas/css/componentes/janela-flutuante.module.css";

/**
 * Janela flutuante (modal) sobre a página atual. Usa o <dialog> nativo: Esc fecha, o foco fica preso
 * dentro da janela e o fundo fica inerte. Ao fechar (X, Esc ou clique fora) volta uma página no histórico,
 * que é o que fecha a rota interceptada e devolve a lista por baixo.
 *
 * Para que "uma página atrás" seja sempre a lista, a janela não deixa o histórico crescer nem o usuário sair dela:
 * - links de arquivo/baixar (/api/..., .../conteudo) abrem em NOVA aba (um erro do servidor não troca a página);
 * - links que só mudam a query da mesma página (abas do detalhe) trocam a entrada do histórico em vez de empilhar.
 */
export function JanelaFlutuante({ titulo, ampla = false, children }: { titulo: string; ampla?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // Abre como modal assim que aparece na tela.
  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  /** Trata os cliques em links de dentro da janela (ver a regra no comentário do componente). */
  function aoClicarEmLink(e: MouseEvent<HTMLDialogElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
    const destino = new URL(link.href, window.location.href);
    if (destino.origin !== window.location.origin) return;
    if (destino.pathname.startsWith("/api/") || destino.pathname.endsWith("/conteudo")) {
      e.preventDefault();
      window.open(destino.href, "_blank", "noopener,noreferrer");
    } else if (destino.pathname === window.location.pathname && destino.search !== window.location.search) {
      e.preventDefault();
      router.replace(`${destino.pathname}${destino.search}${destino.hash}`);
    }
  }

  return (
    <dialog
      ref={ref}
      className={ampla ? `${styles.janela} ${styles.ampla}` : styles.janela}
      aria-label={titulo}
      onClose={() => router.back()}
      onClickCapture={aoClicarEmLink}
      onClick={(e) => {
        // Clique no fundo escurecido (o próprio <dialog>, fora do conteúdo) fecha a janela.
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className={styles.conteudo}>
        <div className={styles.barra}>
          <button type="button" className={styles.fechar} aria-label="Fechar janela" onClick={() => ref.current?.close()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
