import type { ReactNode } from "react";
import { JanelaFlutuante } from "@/paginas/html/componentes/janela-flutuante";
import styles from "@/paginas/css/carregando.module.css";

/** UUID completo (8-4-4-4-12): só ele abre janela; rotas fixas irmãs de [id] (ex.: "novo") não. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Propriedades que as páginas de detalhe recebem do Next (as mesmas de PageProps<"/modulo/[id]">). */
export type PropsJanela = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Propriedades da moldura da janela (layout da rota interceptada). */
export type PropsMoldura = { children: ReactNode; params: Promise<{ id: string }> };

/**
 * Layout de um módulo com janelas flutuantes: a página normal mais o espaço paralelo "modal",
 * onde o detalhe abre por cima da lista (ver @modal/(.)[id] do módulo).
 */
export function LayoutComJanela({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}

/** Espaço "modal" sem janela aberta: não mostra nada. */
export function SemJanela() {
  return null;
}

/**
 * Moldura da janela: fica montada enquanto o conteúdo (esqueleto → página) é trocado dentro dela.
 * Rotas fixas irmãs de [id] (ex.: /documentos/novo) também casam com a rota interceptada; para elas
 * não abre janela nenhuma.
 */
export async function MolduraJanela({ titulo, ampla = true, children, params }: PropsMoldura & { titulo: string; ampla?: boolean }) {
  const { id } = await params;
  if (!UUID.test(id)) return null;
  return <JanelaFlutuante titulo={titulo} ampla={ampla}>{children}</JanelaFlutuante>;
}

/** Esboço dentro da janela enquanto os dados do detalhe chegam. */
export function CarregandoJanela() {
  return (
    <div className={styles.pagina} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.somenteLeitor}>Carregando…</span>
      <div className={`${styles.bloco} ${styles.titulo}`} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`${styles.bloco} ${styles.linha}`} />
      ))}
    </div>
  );
}
