import Link from "next/link";
import { signOut } from "@/auth";
import { getAtor } from "@/lib/ator-servidor";
import { contarNotificacoesNaoLidas } from "@/lib/notificacoes/servico";
import { getContexto, temPermissao } from "@/lib/tenant";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getContexto();
  // Contador único: mensagens de interação também geram notificação (INTERACAO_NOVA), então o
  // sino cobre tudo; "Mensagens" fica como caixa de conversas, sem contador próprio (evita
  // contar a mesma mensagem duas vezes).
  const naoLidas = await contarNotificacoesNaoLidas(await getAtor());
  const itens = [
    { href: "/", label: "Início" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/rncs", label: "RNCs" },
    { href: "/plano-acao", label: "Plano de Ação" },
    { href: "/mensagens", label: "Mensagens" },
    ...(temPermissao(ctx, "ADMIN_CONFIG") ? [{ href: "/configuracoes", label: "Configurações" }] : []),
  ];

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-5">
          <span className="text-2xl font-bold tracking-tight text-emerald-700">Vigen</span>
          <Link
            href="/notificacoes"
            aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lida(s)` : "Notificações"}
            className="relative rounded-md p-1.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            {naoLidas > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-5 text-white">
                {naoLidas > 99 ? "99+" : naoLidas}
              </span>
            )}
          </Link>
        </div>
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
