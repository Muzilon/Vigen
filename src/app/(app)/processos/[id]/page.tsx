import ProcessoDetalhe from "@/paginas/html/processo-detalhe";

export default function Page(props: PageProps<"/processos/[id]">) {
  return <ProcessoDetalhe {...props} />;
}
