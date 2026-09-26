import InspecaoDetalhe from "@/paginas/html/inspecao-detalhe";

export default function Page(props: PageProps<"/inspecoes/[id]">) {
  return <InspecaoDetalhe {...props} />;
}
