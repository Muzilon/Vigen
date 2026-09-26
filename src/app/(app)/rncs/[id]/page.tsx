import RncDetalhe from "@/paginas/html/rnc-detalhe";

export default function Page(props: PageProps<"/rncs/[id]">) {
  return <RncDetalhe {...props} />;
}
