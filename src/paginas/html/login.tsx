import Image from "next/image";
import { LoginFormulario } from "@/paginas/html/login-formulario";
import styles from "@/paginas/css/login.module.css";

/**
 * Página de entrada (login): à esquerda o painel da marca (logo principal "Vigen — Sistema de Gestão Integrado",
 * mensagem de apresentação e as normas atendidas), à direita o cartão com o formulário de e-mail e senha
 * (login-formulario.tsx). No celular só o formulário aparece, com a logo principal escura acima dele.
 */
export function LoginPagina() {
  return (
    <div className={`${styles.pagina} fonteBase`}>
      <section className={styles.painelMarca}>
        <div className={styles.conteudoMarca}>
          {/* Logo principal (versão clara, para fundo escuro) — inclui a frase "Sistema de Gestão Integrado". */}
          <Image
            src="/marca/vigen-logo-principal-claro.svg"
            alt="Vigen — Sistema de Gestão Integrado"
            width={377}
            height={137}
            priority
            className={styles.logoMarca}
          />
          <h1 className={styles.tituloMarca}>Qualidade, meio ambiente e segurança num só lugar.</h1>
          <p className={styles.descricaoMarca}>
            RNCs, planos de ação, riscos, documentos, inspeções, auditorias e treinamentos — com evidência pronta para o
            auditor.
          </p>
          <ul className={styles.listaNormas} aria-label="Normas atendidas">
            <li className={styles.etiquetaNorma}>ISO 9001</li>
            <li className={styles.etiquetaNorma}>ISO 14001</li>
            <li className={styles.etiquetaNorma}>ISO 45001</li>
          </ul>
        </div>
      </section>

      <section className={styles.painelFormulario}>
        {/* No celular o painel da marca some; a logo principal (versão escura) aparece aqui, acima do formulário. */}
        <Image
          src="/marca/vigen-logo-principal.svg"
          alt="Vigen — Sistema de Gestão Integrado"
          width={377}
          height={137}
          priority
          className={styles.logoMobile}
        />
        <LoginFormulario />
      </section>
    </div>
  );
}
