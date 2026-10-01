import { abasDoModulo } from "@/lib/menu-registro";
import { temModulo } from "@/lib/modulos";
import { getContexto, temPermissao } from "@/lib/tenant";
import { AbasNavegacao } from "@/paginas/html/componentes/abas-navegacao";

/**
 * Abas de um módulo, no topo de cada uma das suas páginas (ex.: Documentos = "Lista mestra" | "Meus documentos").
 * Como o menu lateral tem UM item por módulo, as outras páginas do módulo ficam nestas abas.
 * Só mostra as abas que a pessoa pode ver (módulo contratado + permissão) e nada se sobrar uma só.
 * `chave` é o identificador do item em src/lib/menu-registro.ts (ex.: "documentos", "treinamentos").
 */
export async function AbasModulo({ chave }: { chave: string }) {
  // Quem está logado (o resultado é reaproveitado na mesma requisição).
  const ctx = await getContexto();
  const abas = abasDoModulo({ temModulo: (m) => temModulo(ctx, m), temPermissao: (p) => temPermissao(ctx, p) }, chave);
  if (abas.length === 0) return null;
  return <AbasNavegacao abas={abas} />;
}
