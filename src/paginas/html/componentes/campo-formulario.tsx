import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import styles from "@/paginas/css/componentes/campo-formulario.module.css";

/** Label de campo de formulário. `oculto` = visível só para leitor de tela. */
export function Rotulo({ oculto, className, ...props }: LabelHTMLAttributes<HTMLLabelElement> & { oculto?: boolean }) {
  return <label className={`${oculto ? styles.rotuloOculto : styles.rotulo} ${className ?? ""}`} {...props} />;
}

/** Input de texto/busca/senha/etc. no padrão da Direção A. */
export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.entrada} ${className ?? ""}`} {...props} />;
}

/** Select no padrão compacto usado nas barras de filtro. */
export function Selecao({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${styles.selecao} ${className ?? ""}`} {...props} />;
}

/** Campo de busca com ícone de lupa e atalho opcional (ex.: "Ctrl K"). */
export function CampoBusca({
  icone,
  atalho,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icone?: ReactNode; atalho?: string }) {
  return (
    <div className={styles.campoComIcone}>
      <span className={styles.iconeBusca} aria-hidden="true">
        {icone ?? <IconeLupa />}
      </span>
      <input className={`${styles.entradaComIcone} ${className ?? ""}`} {...props} />
      {atalho && <span className={styles.atalho}>{atalho}</span>}
    </div>
  );
}

function IconeLupa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
