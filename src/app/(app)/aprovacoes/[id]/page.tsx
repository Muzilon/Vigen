import AprovacaoDetalhe from "@/paginas/html/aprovacao-detalhe";

export default function Page(props: PageProps<"/aprovacoes/[id]">) {
  return <AprovacaoDetalhe {...props} />;
}
