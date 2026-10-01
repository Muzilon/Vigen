import styles from "@/paginas/css/carregando.module.css";

/** Esboço dentro da janela enquanto os dados do item chegam. */
export default function CarregandoItem() {
  return (
    <div className={styles.pagina} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.somenteLeitor}>Carregando item…</span>
      <div className={`${styles.bloco} ${styles.titulo}`} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`${styles.bloco} ${styles.linha}`} />
      ))}
    </div>
  );
}
