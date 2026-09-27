import IncidenteDetalhe from "@/paginas/html/incidente-detalhe";

export default function Page(props: PageProps<"/incidentes/[id]">) {
  return <IncidenteDetalhe {...props} />;
}
