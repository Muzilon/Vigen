import RiscoDetalhe from "@/paginas/html/risco-detalhe";

export default function Page(props: PageProps<"/riscos/[id]">) {
  return <RiscoDetalhe {...props} />;
}
