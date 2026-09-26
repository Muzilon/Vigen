import { notFound } from "next/navigation";
import { getContexto, temPermissao } from "@/lib/tenant";

export default async function Configuracoes() {
  const ctx = await getContexto();
  if (!temPermissao(ctx, "ADMIN_CONFIG")) notFound();
  return <h1 className="text-2xl font-semibold text-slate-900">Configurações</h1>;
}
