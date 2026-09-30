import Image from "next/image";
import type { ReactNode } from "react";
import type { MenuMontado } from "@/lib/menu-registro";
import styles from "@/paginas/css/layout-app.module.css";
import { Icone } from "@/paginas/html/componentes/icone";
import { PainelNotificacoes } from "@/paginas/html/componentes/painel-notificacoes";
import { NavLateral } from "@/paginas/html/componentes/nav-lateral";
import { Trilha } from "@/paginas/html/componentes/trilha";

// Nome amigável de cada papel de usuário (aparece como dica ao passar o mouse no cartão do usuário).
const ROTULO_PAPEL_CURTO: Record<string, string> = {
  ADMIN: "Administrador",
  GESTOR_SGI: "Gestor SGI",
  INSPETOR: "Inspetor",
  COLABORADOR: "Colaborador",
};

/** Pega as iniciais do nome para o "avatar" redondo: "Maria Silva" → "MS". */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Casca da área logada (Design System Vigen): sidebar teal fixa (logo, menu por seções e cartão do usuário)
 * + cabeçalho sticky com a trilha e o sino de notificações. `menu` vem pronto do servidor (quem vê o quê).
 * Ver docs/05-guia-paginas-css.md para a escala de z-index e as regras de "cabeçalho sempre no topo".
 */
export function LayoutApp({
  menu,
  empresaNome,
  usuarioNome,
  usuarioPapel,
  naoLidas,
  aoSair,
  children,
}: {
  menu: MenuMontado;
  empresaNome: string;
  usuarioNome: string;
  usuarioPapel: string;
  naoLidas: number;
  aoSair: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.casca} fonteBase`}>
      <aside className={styles.sidebar}>
        <LogoSidebar />

        <NavLateral topo={menu.topo} secoes={menu.secoes} rodape={menu.rodape} />

        {/* Cartão do usuário (rodapé): avatar com as iniciais, nome, empresa e o botão Sair. */}
        <div className={styles.rodapeUsuario} title={ROTULO_PAPEL_CURTO[usuarioPapel] ?? usuarioPapel}>
          <span className={styles.avatarUsuario}>{iniciais(usuarioNome)}</span>
          <span className={styles.textoUsuario}>
            <span className={styles.nomeUsuario}>{usuarioNome}</span>
            <span className={styles.cargoUsuario}>{empresaNome}</span>
          </span>
          <form action={aoSair}>
            <button type="submit" aria-label="Sair" className={styles.botaoSair}>
              <Icone nome="sair" />
            </button>
          </form>
        </div>
      </aside>

      <div className={styles.colunaPrincipal}>
        <header className={styles.cabecalho}>
          <Trilha empresaNome={empresaNome} itens={menu.rotulos} />
          <PainelNotificacoes naoLidas={naoLidas} />
        </header>

        <main className={styles.conteudo}>{children}</main>
      </div>
    </div>
  );
}

/**
 * Logo da sidebar: a versão horizontal clara no desktop e só o ícone "V" claro no celular
 * (a troca é feita pelo CSS, até 900px).
 */
function LogoSidebar() {
  return (
    <div className={styles.logo}>
      <Image src="/marca/vigen-logo-claro.svg" alt="Vigen" width={372} height={103} priority className={styles.logoCompleta} />
      <Image src="/marca/vigen-icone-claro.svg" alt="Vigen" width={276} height={278} priority className={styles.logoIcone} />
    </div>
  );
}
