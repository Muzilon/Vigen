import type { ReactNode } from "react";
import { JanelaFlutuante } from "@/paginas/html/componentes/janela-flutuante";

/**
 * Moldura da janela: fica montada enquanto o conteúdo (loading → página) é trocado dentro dela.
 * Rotas fixas irmãs (ex.: /plano-acao/novo) também casam com [id]; para elas não abre janela nenhuma.
 */
export default async function JanelaItem({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return <JanelaFlutuante titulo="Item do plano de ação">{children}</JanelaFlutuante>;
}
