/**
 * Layout do Plano de Ação: além da página, tem o espaço paralelo "modal", onde o detalhe do item abre como
 * janela flutuante por cima da lista (ver @modal/(.)[id]). Nas demais rotas o espaço fica vazio.
 */
export default function PlanoAcaoLayout({ children, modal }: LayoutProps<"/plano-acao">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
