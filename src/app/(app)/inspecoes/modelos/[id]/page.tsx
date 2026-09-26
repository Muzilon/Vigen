import InspecaoModelo from "@/paginas/html/inspecao-modelo";

export default function Page(props: PageProps<"/inspecoes/modelos/[id]">) {
  return <InspecaoModelo {...props} />;
}
