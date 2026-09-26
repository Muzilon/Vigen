import { LoginFormulario } from "@/paginas/html/login-formulario";
import styles from "@/paginas/css/login.module.css";

/** Página de entrada — Direção A "Campo" (ver Login.dc.html). */
export function LoginPagina() {
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <section className={styles.painelMarca}>
        <div className={styles.logoMarca}>
          <IconeLogo />
          <span className={styles.logoTextoMarca}>Vigen</span>
        </div>

        <div className={styles.conteudoMarca}>
          <p className={styles.selo}>QUALIDADE · MEIO AMBIENTE · SSO</p>
          <h1 className={styles.tituloMarca}>Cada não conformidade tratada até o fim.</h1>
          <p className={styles.descricaoMarca}>
            Do registro em campo à verificação de eficácia: RNC, causa raiz e plano de ação 5W2H no mesmo lugar, com
            prazos e responsáveis claros para toda a obra.
          </p>
          <ul className={styles.listaDestaques}>
            <li className={styles.itemDestaque}>
              <span className={styles.iconeDestaque} aria-hidden="true"><IconeRelogio /></span>
              Registro em campo em poucos minutos
            </li>
            <li className={styles.itemDestaque}>
              <span className={styles.iconeDestaque} aria-hidden="true"><IconeLista /></span>
              Planos 5W2H com ciclos e verificação de eficácia
            </li>
            <li className={styles.itemDestaque}>
              <span className={styles.iconeDestaque} aria-hidden="true"><IconeCadeado /></span>
              Dados pessoais de envolvidos protegidos (LGPD)
            </li>
          </ul>
        </div>

        <p className={styles.rodapeMarca}>© 2026 Vigen · Gestão de não conformidades para operações de campo</p>
      </section>

      <section className={styles.painelFormulario}>
        <LoginFormulario />
      </section>
    </div>
  );
}

function IconeLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
      <path d="m8.5 9 3.5 6.5L15.5 9" />
    </svg>
  );
}
function IconeRelogio() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconeLista() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 6h10" />
      <path d="M10 12h10" />
      <path d="M10 18h10" />
      <path d="m3.5 6 1.5 1.5L7.5 5" />
      <path d="m3.5 12 1.5 1.5 2.5-2.5" />
      <path d="m3.5 18 1.5 1.5 2.5-2.5" />
    </svg>
  );
}
function IconeCadeado() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
