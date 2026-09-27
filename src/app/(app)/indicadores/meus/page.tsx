import IndicadoresLista from "@/paginas/html/indicadores-lista";

export default function Page(props: PageProps<"/indicadores/meus">) {
  return <IndicadoresLista {...props} meus />;
}
