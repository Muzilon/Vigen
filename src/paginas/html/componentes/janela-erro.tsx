"use client";

import botoes from "@/paginas/css/componentes/botao.module.css";
import styles from "@/paginas/css/carregando.module.css";

/**
 * Erro ao carregar o detalhe dentro da janela flutuante. Como o error.tsx fica na pasta da rota interceptada,
 * a moldura da janela (com o botão de fechar) continua na tela e a lista por baixo não é afetada.
 */
export function ErroNaJanela({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.aviso} role="alert">
      <h2 className={styles.tituloAviso}>Não foi possível abrir este item</h2>
      <p className={styles.textoAviso}>Ocorreu um erro ao carregar os dados. Tente de novo ou feche a janela e volte à lista.</p>
      <button type="button" className={`${botoes.botao} ${botoes.secundario}`} onClick={reset}>
        Tentar de novo
      </button>
    </div>
  );
}

/** Item inexistente ou sem acesso (notFound() da página de detalhe), mostrado dentro da janela. */
export function NaoEncontradoNaJanela() {
  return (
    <div className={styles.aviso} role="alert">
      <h2 className={styles.tituloAviso}>Item não encontrado</h2>
      <p className={styles.textoAviso}>Este item não existe ou você não tem acesso a ele. Feche a janela para voltar à lista.</p>
    </div>
  );
}
