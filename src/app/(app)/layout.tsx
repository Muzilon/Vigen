import { signOut } from "@/auth";
import { contarAguardandoMim } from "@/lib/aprovacao";
import { getAtor } from "@/lib/ator-servidor";
import { montarMenu } from "@/lib/menu-registro";
import { temModulo } from "@/lib/modulos";
import { contarNotificacoesNaoLidas } from "@/lib/notificacoes/servico";
import { getContexto, temPermissao } from "@/lib/tenant";
import { LayoutApp } from "@/paginas/html/layout-app";

/** Layout da área logada: descobre quem é o usuário, monta o menu que ele pode ver e entrega tudo à casca (LayoutApp). */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Contador único: mensagens de interação também geram notificação (INTERACAO_NOVA), então o
  // sino cobre tudo; "Mensagens" fica como caixa de conversas, sem contador próprio (evita
  // contar a mesma mensagem duas vezes).
  const ator = await getAtor();
  const [naoLidas, aprovacoesPendentes] = await Promise.all([contarNotificacoesNaoLidas(ator), contarAguardandoMim(ator)]);

  // Menu: a lista de itens, seções e quem vê o quê está em src/lib/menu-registro.ts.
  // Aqui só dizemos o que ESTE usuário pode (módulos contratados + permissões) e o contador de aprovações pendentes.
  const menu = montarMenu(
    { temModulo: (modulo) => temModulo(ctx, modulo), temPermissao: (permissao) => temPermissao(ctx, permissao) },
    { aprovacoes: aprovacoesPendentes },
  );

  // Sai da conta (server action): encerra a sessão e volta para o login.
  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <LayoutApp
      menu={menu}
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
