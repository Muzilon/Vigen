import type { ReactNode } from "react";
import styles from "@/paginas/css/componentes/cabecalho-pagina.module.css";

/** Faixa de título no topo do conteúdo de cada página (título + contador + subtítulo + ações). */
export function CabecalhoPagina({
  titulo,
  contador,
  subtitulo,
  acoes,
}: {
  titulo: ReactNode;
  contador?: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <div className={styles.faixa}>
      <div className={styles.blocoTitulo}>
        <div className={styles.linhaTitulo}>
          <h1 className={styles.titulo}>{titulo}</h1>
          {contador !== undefined && <span className={styles.contador}>{contador}</span>}
        </div>
        {subtitulo && <p className={styles.subtitulo}>{subtitulo}</p>}
      </div>
      {acoes && <div className={styles.acoes}>{acoes}</div>}
    </div>
  );
}
