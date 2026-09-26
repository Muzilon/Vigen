import Link from "next/link";
import { signOut } from "@/auth";
import { getAtor } from "@/lib/ator-servidor";
import { contarNaoLidas } from "@/lib/interacoes/servico";
import { getContexto, temPermissao } from "@/lib/tenant";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getContexto();
  const naoLidas = await contarNaoLidas(await getAtor());
  const itens = [
    { href: "/", label: "Início" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/rncs", label: "RNCs" },
    { href: "/plano-acao", label: "Plano de Ação" },
    { href: "/mensagens", label: naoLidas > 0 ? `Mensagens (${naoLidas})` : "Mensagens" },
    ...(temPermissao(ctx, "ADMIN_CONFIG") ? [{ href: "/configuracoes", label: "Configurações" }] : []),
  ];

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5 text-2xl font-bold tracking-tight text-emerald-700">Vigen</div>
        <nav className="flex-1 space-y-1 px-3">
          {itens.map((i) => (
            <Link key={i.href} href={i.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800">
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium text-slate-900">{ctx.usuario.nome}</p>
          <p className="truncate text-xs text-slate-500">{ctx.usuario.empresaNome}</p>
          <form action={sair} className="mt-3">
            <button type="submit" className="text-sm text-slate-600 hover:text-red-700">Sair</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
