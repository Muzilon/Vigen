import PlanoAcaoItem from "@/paginas/html/plano-acao-item";

export default function Page(props: PageProps<"/plano-acao/[id]">) {
  return <PlanoAcaoItem {...props} />;
}
