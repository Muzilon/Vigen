import PlanoAcaoPlano from "@/paginas/html/plano-acao-plano";
import type { PropsJanela } from "@/paginas/html/componentes/janela-rota";

/** Detalhe em janela flutuante (rota interceptada). Recarregar a página ou abrir o link direto mostra a página inteira. */
export default function Page(props: PropsJanela) {
  return <PlanoAcaoPlano {...props} />;
}