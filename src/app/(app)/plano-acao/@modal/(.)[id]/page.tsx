import PlanoAcaoItem from "@/paginas/html/plano-acao-item";

/**
 * Detalhe do item de ação em janela flutuante (rota interceptada de /plano-acao/[id]).
 * Reaproveita a página inteira do item: as ações (iniciar, concluir, editar, cancelar) já aparecem
 * conforme o perfil do usuário. Recarregar a página ou abrir o link direto mostra a página normal.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // Rotas fixas irmãs (ex.: /plano-acao/novo) também casam com [id]; elas não abrem janela.
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return <PlanoAcaoItem params={params} emJanela />;
}
