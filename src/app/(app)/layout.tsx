import { signOut } from "@/auth";
import { getAtor } from "@/lib/ator-servidor";
import { contarNotificacoesNaoLidas } from "@/lib/notificacoes/servico";
import { getContexto, temPermissao } from "@/lib/tenant";
import { LayoutApp } from "@/paginas/html/layout-app";
import type { ItemMenuLateral } from "@/paginas/html/componentes/nav-lateral";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await getContexto();
  // Contador único: mensagens de interação também geram notificação (INTERACAO_NOVA), então o
  // sino cobre tudo; "Mensagens" fica como caixa de conversas, sem contador próprio (evita
  // contar a mesma mensagem duas vezes).
  const naoLidas = await contarNotificacoesNaoLidas(await getAtor());

  const itensMenu: ItemMenuLateral[] = [
    { href: "/", label: "Início", icone: <IconeInicio /> },
    { href: "/dashboard", label: "Dashboard", icone: <IconeDashboard /> },
    { href: "/rncs", label: "RNCs", icone: <IconeRncs /> },
    { href: "/plano-acao", label: "Plano de Ação", icone: <IconePlanoAcao /> },
    { href: "/mensagens", label: "Mensagens", icone: <IconeMensagens /> },
    ...(temPermissao(ctx, "ADMIN_CONFIG")
      ? [{ href: "/configuracoes", label: "Configurações", icone: <IconeConfiguracoes /> }]
      : []),
  ];

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <LayoutApp
      itensMenu={itensMenu}
      empresaNome={ctx.usuario.empresaNome}
      usuarioNome={ctx.usuario.nome}
      usuarioPapel={ctx.usuario.papel}
      naoLidas={naoLidas}
      aoSair={sair}
    >
      {children}
    </LayoutApp>
  );
}

function IconeInicio() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function IconeDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M21 20H3" />
    </svg>
  );
}
function IconeRncs() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H6.5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7.5z" />
      <path d="M14 3v4.5h4.5" />
      <path d="M12 11v4" />
      <path d="M12 18h.01" />
    </svg>
  );
}
function IconePlanoAcao() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 6h10" />
      <path d="M10 12h10" />
      <path d="M10 18h10" />
      <path d="m3.5 6 1.5 1.5L7.5 5" />
      <path d="m3.5 12 1.5 1.5 2.5-2.5" />
      <path d="m3.5 18 1.5 1.5 2.5-2.5" />
    </svg>
  );
}
function IconeMensagens() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 15a2 2 0 0 1-2 2H8l-4.5 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconeConfiguracoes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3" />
      <path d="M12 18.5v3" />
      <path d="m5.3 5.3 2.1 2.1" />
      <path d="m16.6 16.6 2.1 2.1" />
      <path d="M2.5 12h3" />
      <path d="M18.5 12h3" />
      <path d="m5.3 18.7 2.1-2.1" />
      <path d="m16.6 7.4 2.1-2.1" />
    </svg>
  );
}
