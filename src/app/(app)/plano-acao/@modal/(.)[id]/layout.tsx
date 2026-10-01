import { MolduraJanela, type PropsMoldura } from "@/paginas/html/componentes/janela-rota";

/** Moldura da janela flutuante do item de ação: fica montada enquanto o conteúdo é trocado dentro dela. */
export default function Moldura(props: PropsMoldura) {
  return <MolduraJanela titulo="Item do plano de ação" ampla={false} {...props} />;
}
