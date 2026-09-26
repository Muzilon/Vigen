import DocumentoDetalhe from "@/paginas/html/documento-detalhe";

export default function Page(props: PageProps<"/documentos/[id]">) {
  return <DocumentoDetalhe {...props} />;
}
