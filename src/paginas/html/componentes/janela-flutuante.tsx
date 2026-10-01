"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import styles from "@/paginas/css/componentes/janela-flutuante.module.css";

/**
 * Janela flutuante (modal) sobre a página atual. Usa o <dialog> nativo: Esc fecha, o foco fica preso
 * dentro da janela e o fundo fica inerte. Ao fechar (X, Esc ou clique fora) volta uma página no histórico,
 * que é o que fecha a rota interceptada e devolve a lista por baixo.
 */
export function JanelaFlutuante({ titulo, ampla = false, children }: { titulo: string; ampla?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // Abre como modal assim que aparece na tela.
  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={ampla ? `${styles.janela} ${styles.ampla}` : styles.janela}
      aria-label={titulo}
      onClose={() => router.back()}
      onClick={(e) => {
        // Clique no fundo escurecido (o próprio <dialog>, fora do conteúdo) fecha a janela.
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <button type="button" className={styles.fechar} aria-label="Fechar janela" onClick={() => ref.current?.close()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
      <div className={styles.conteudo}>{children}</div>
    </dialog>
  );
}
