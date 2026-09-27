import IndicadorDetalhe from "@/paginas/html/indicador-detalhe";

export default function Page(props: PageProps<"/indicadores/[id]">) {
  return <IndicadorDetalhe {...props} />;
}
