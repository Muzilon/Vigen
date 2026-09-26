import AuditoriaDetalhe from "@/paginas/html/auditoria-detalhe";

export default function Page(props: PageProps<"/auditorias/[id]">) {
  return <AuditoriaDetalhe {...props} />;
}
