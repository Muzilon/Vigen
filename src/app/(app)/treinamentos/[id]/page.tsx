import TreinamentoDetalhe from "@/paginas/html/treinamento-detalhe";

export default function Page(props: PageProps<"/treinamentos/[id]">) {
  return <TreinamentoDetalhe {...props} />;
}
