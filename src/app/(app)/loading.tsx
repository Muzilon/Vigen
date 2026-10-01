import styles from "@/paginas/css/carregando.module.css";

/**
 * Esqueleto mostrado na hora ao navegar entre páginas da área logada, enquanto o servidor monta a página.
 * O menu e o topo (layout) continuam na tela; só o conteúdo é trocado por este esboço.
 */
export default function Carregando() {
  return (
    <div className={`${styles.pagina} fonteBase`} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.somenteLeitor}>Carregando…</span>
      <div className={`${styles.bloco} ${styles.titulo}`} />
      <div className={`${styles.bloco} ${styles.filtros}`} />
      <div className={styles.painel}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${styles.bloco} ${styles.linha}`} />
        ))}
      </div>
    </div>
  );
}
