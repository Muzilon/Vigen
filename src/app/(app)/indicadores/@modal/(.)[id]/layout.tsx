import { MolduraJanela, type PropsMoldura } from "@/paginas/html/componentes/janela-rota";

/** Moldura da janela flutuante: fica montada enquanto o conteúdo é trocado dentro dela. */
export default function Moldura(props: PropsMoldura) {
  return <MolduraJanela titulo="Indicador" {...props} />;
}