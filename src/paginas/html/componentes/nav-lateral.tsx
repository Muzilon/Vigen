"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { ItemMenu, SecaoMenu } from "@/lib/menu-registro";
import { Icone } from "@/paginas/html/componentes/icone";
import styles from "@/paginas/css/layout-app.module.css";

/** O item está ativo? = o endereço atual é o dele (ou uma sub-página dele, ex.: /rncs/123). A raiz "/" só vale se for exata. */
function ehAtivo(pathname: string, item: ItemMenu) {
  return item.hrefsAtivos.some((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)));
}

/**
 * Menu principal da sidebar, como no design do Figma: itens fixos no topo, depois SEÇÕES (Gestão, Qualidade, Segurança
 * do Trabalho, Meio Ambiente) que abrem e fecham ao CLICAR no título, e Configurações no rodapé.
 *
 *  - A seção da página atual abre sozinha; o usuário pode abrir/fechar as outras (vale enquanto navega, sem recarregar).
 *  - Seção com um só item não abre nem fecha: mostra o título e o item direto.
 *  - Até 900px (celular) a lista fica recolhida atrás do botão "Menu" e abre como painel sob a barra superior;
 *    fecha ao navegar, com Esc ou ao clicar fora.
 * A montagem do menu (quem vê o quê) vem pronta do servidor: `montarMenu()` em src/lib/menu-registro.ts.
 */
export function NavLateral({ topo, secoes, rodape }: { topo: ItemMenu[]; secoes: SecaoMenu[]; rodape: ItemMenu[] }) {
  // `pathname`: o endereço atual (ex.: "/rncs/123"), usado para destacar o item ativo.
  const pathname = usePathname();
  const idPainel = useId();
  // `aberto`: no celular, se o painel do menu está aberto ou recolhido.
  const [aberto, setAberto] = useState(false);
  // `escolhas`: seções que o usuário abriu (true) ou fechou (false) com o clique. Seção sem escolha segue a regra automática.
  const [escolhas, setEscolhas] = useState<Record<string, boolean>>({});
  // Guarda o endereço da renderização anterior, para detectar quando o usuário navegou.
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);

  // Seção que contém a página atual (abre sozinha).
  const secaoAtiva = secoes.find((s) => s.itens.some((i) => ehAtivo(pathname, i)))?.id;

  // Ao trocar de página: fecha o painel do celular e garante que a seção da nova página esteja aberta
  // (ajuste de estado durante a renderização, sem efeito).
  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setAberto(false);
    if (secaoAtiva) setEscolhas((e) => ({ ...e, [secaoAtiva]: true }));
  }

  // Enquanto o painel do celular está aberto, escuta o teclado (Esc) e os cliques fora dele para fechá-lo.
  // O `return` no final desliga as escutas quando o painel fecha (limpeza).
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    const aoClicar = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.("[data-menu-principal]")) setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("click", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("click", aoClicar);
    };
  }, [aberto]);

  // Item do menu que corresponde à página atual (o nome dele aparece ao lado do botão "Menu", no celular).
  const ativoAtual = [...topo, ...secoes.flatMap((s) => s.itens), ...rodape].find((i) => ehAtivo(pathname, i));

  /** Desenha um item (link com ícone, nome e, se houver, contador de pendências). */
  const renderItem = (item: ItemMenu) => {
    const ativo = ehAtivo(pathname, item);
    return (
      <li key={item.chave}>
        <Link
          href={item.href}
          aria-current={ativo ? "page" : undefined}
          className={`${styles.itemNav} ${ativo ? styles.itemNavAtivo : ""}`}
          onClick={() => setAberto(false)}
        >
          <Icone nome={item.icone} className={styles.iconeItemNav} />
          <span className={styles.rotuloItemNav}>{item.label}</span>
          {item.contador !== undefined && item.contador > 0 && (
            <span className={ativo ? styles.contadorItemNavAtivo : styles.contadorItemNav}>{item.contador > 99 ? "99+" : item.contador}</span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className={styles.menuPrincipal} data-menu-principal="">
      <button
        type="button"
        className={styles.botaoMenu}
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto((v) => !v)}
      >
        <Icone nome={aberto ? "fechar" : "menu"} />
        <span>Menu</span>
        {ativoAtual && <span className={styles.botaoMenuAtual}>· {ativoAtual.label}</span>}
      </button>

      <nav id={idPainel} aria-label="Principal" className={`${styles.navLateral} ${aberto ? styles.navLateralAberta : ""}`}>
        <ul className={styles.listaNav}>{topo.map(renderItem)}</ul>

        {secoes.map((secao) => {
          // Seção com um só item não precisa abrir/fechar: título fixo + o item.
          const colapsavel = secao.itens.length > 1;
          const secaoAberta = !colapsavel || (escolhas[secao.id] ?? secao.id === secaoAtiva);
          const idLista = `${idPainel}-${secao.id}`;
          // Soma das pendências dos itens: aparece no título quando a seção está fechada (não esconde trabalho a fazer).
          const pendencias = secao.itens.reduce((soma, i) => soma + (i.contador ?? 0), 0);
          return (
            <div key={secao.id} className={styles.secaoNav}>
              {colapsavel ? (
                <button
                  type="button"
                  className={styles.tituloSecao}
                  aria-expanded={secaoAberta}
                  aria-controls={idLista}
                  onClick={() => setEscolhas((e) => ({ ...e, [secao.id]: !secaoAberta }))}
                >
                  <span>{secao.titulo}</span>
                  {!secaoAberta && pendencias > 0 && <span className={styles.contadorItemNav}>{pendencias > 99 ? "99+" : pendencias}</span>}
                  <Icone nome="setaBaixo" tamanho={14} className={`${styles.setaSecao} ${secaoAberta ? styles.setaSecaoAberta : ""}`} />
                </button>
              ) : (
                <p className={styles.tituloSecaoFixo}>{secao.titulo}</p>
              )}
              <ul id={idLista} className={styles.listaNav} hidden={!secaoAberta}>
                {secao.itens.map(renderItem)}
              </ul>
            </div>
          );
        })}

        <ul className={`${styles.listaNav} ${styles.listaNavRodape}`}>{rodape.map(renderItem)}</ul>
      </nav>
    </div>
  );
}
