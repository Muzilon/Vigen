import type { Modulo, Permissao } from "@prisma/client";
import { GRUPO_MODULO, type GrupoModulo } from "@/lib/modulos";
// Só o TIPO do nome do ícone (apagado na compilação): garante que todo item do menu aponte para um ícone que existe.
import type { NomeIcone } from "@/paginas/html/componentes/icone";

/**
 * Menu lateral do Vigen: o que existe, onde fica e quem vê.
 *
 * O menu tem 3 zonas (conforme o design "Sidebar atual" do Figma):
 *  - TOPO: itens sempre visíveis (Início, Dashboard, Aprovações, Mensagens);
 *  - SEÇÕES: módulos agrupados por área (Gestão, Qualidade, Segurança do Trabalho, Meio Ambiente), que abrem e fecham;
 *  - RODAPÉ: Configurações (só administrador).
 *
 * Cada item do menu é UM módulo. Quando um módulo tem várias páginas (ex.: Documentos = "Lista mestra" + "Meus documentos"),
 * elas ficam em `entradas`: a 1ª entrada que a pessoa pode ver é o link do menu e as demais viram ABAS no topo da página
 * (componente AbasModulo). Uma entrada só aparece se o módulo está contratado (`modulo`) e a permissão (`permissao`) está presente.
 *
 * Esta parte é "pura" (não lê banco nem sessão): quem chama diz o que a pessoa pode (`Acesso`). Assim dá para testar (tests/menu.test.ts).
 */

/** Uma página de um módulo: endereço, nome (usado nas abas e na trilha) e as regras de acesso. */
export interface EntradaMenu {
  href: string;
  label: string;
  /** Módulo contratado exigido. Sem isso = base do sistema (RNC, Plano de Ação, Início...), sempre disponível. */
  modulo?: Modulo;
  /** Exige ao menos uma destas permissões (lista = qualquer uma). */
  permissao?: Permissao | readonly Permissao[];
}

/** Um item do menu (um módulo), com suas páginas. `entradas[0]` é a página principal. */
export interface ItemMenuRegistro {
  /** Identificador estável do item (usado nas abas e nos contadores). */
  chave: string;
  /** Texto mostrado no menu. */
  rotulo: string;
  icone: NomeIcone;
  entradas: EntradaMenu[];
}

/** Itens fixos no topo do menu, sem título de seção. */
export const MENU_TOPO: ItemMenuRegistro[] = [
  { chave: "inicio", rotulo: "Início", icone: "inicio", entradas: [{ href: "/", label: "Início" }] },
  { chave: "dashboard", rotulo: "Dashboard", icone: "dashboard", entradas: [{ href: "/dashboard", label: "Dashboard" }] },
  // Aprovações: motor transversal, não depende de módulo contratado. O contador de pendências é passado por quem monta o menu.
  { chave: "aprovacoes", rotulo: "Aprovações", icone: "aprovacoes", entradas: [{ href: "/aprovacoes", label: "Aprovações" }] },
  { chave: "mensagens", rotulo: "Mensagens", icone: "mensagens", entradas: [{ href: "/mensagens", label: "Mensagens" }] },
];

/** Seções do menu, na ordem do design. A ordem dos itens dentro de cada seção também é a do design. */
export const MENU_SECOES: { grupo: GrupoModulo; itens: ItemMenuRegistro[] }[] = [
  {
    grupo: GRUPO_MODULO.GESTAO,
    itens: [
      {
        chave: "indicadores",
        rotulo: "Indicadores",
        icone: "indicadores",
        entradas: [
          { href: "/indicadores", label: "Indicadores", modulo: "INDICADORES" },
          { href: "/indicadores/meus", label: "Meus indicadores", modulo: "INDICADORES" },
        ],
      },
      {
        chave: "documentos",
        rotulo: "Documentos",
        icone: "documentos",
        entradas: [
          { href: "/documentos", label: "Lista mestra", modulo: "DOCUMENTOS", permissao: ["DOCUMENTO_ELABORAR", "DOCUMENTO_GERENCIAR"] },
          { href: "/documentos/meus", label: "Meus documentos", modulo: "DOCUMENTOS" },
        ],
      },
      { chave: "plano-acao", rotulo: "Plano de Ação", icone: "planoAcao", entradas: [{ href: "/plano-acao", label: "Plano de Ação" }] },
      {
        chave: "ameacas",
        rotulo: "Ameaças e Oportunidades",
        icone: "ameacas",
        entradas: [{ href: "/riscos", label: "Ameaças e Oportunidades", modulo: "RISCOS_OPORTUNIDADES" }],
      },
      { chave: "swot", rotulo: "SWOT", icone: "swot", entradas: [{ href: "/swot", label: "SWOT", modulo: "SWOT" }] },
      {
        chave: "treinamentos",
        rotulo: "Treinamentos",
        icone: "treinamentos",
        entradas: [
          { href: "/treinamentos", label: "Catálogo", modulo: "TREINAMENTOS" },
          { href: "/treinamentos/matriz", label: "Matriz de competências", modulo: "TREINAMENTOS", permissao: "TREINAMENTO_GERENCIAR" },
          { href: "/treinamentos/meus", label: "Meus treinamentos", modulo: "TREINAMENTOS" },
          { href: "/treinamentos/auditoria", label: "Evidências p/ auditoria", modulo: "TREINAMENTOS", permissao: "TREINAMENTO_GERENCIAR" },
        ],
      },
    ],
  },
  {
    grupo: GRUPO_MODULO.QUALIDADE,
    itens: [
      { chave: "rncs", rotulo: "RNCs", icone: "rnc", entradas: [{ href: "/rncs", label: "RNCs" }] },
      { chave: "processos", rotulo: "Mapa de Processos", icone: "mapaProcessos", entradas: [{ href: "/processos", label: "Mapa de Processos", modulo: "MAPA_PROCESSOS" }] },
      { chave: "inspecoes", rotulo: "Inspeções", icone: "inspecoes", entradas: [{ href: "/inspecoes", label: "Inspeções", modulo: "INSPECOES" }] },
      { chave: "auditorias", rotulo: "Auditoria", icone: "auditoria", entradas: [{ href: "/auditorias", label: "Auditoria", modulo: "AUDITORIAS" }] },
    ],
  },
  {
    grupo: GRUPO_MODULO.SEGURANCA,
    itens: [
      // O módulo "HIRA" agora se chama "Perigos e Riscos" (só o nome; o endereço continua /hira).
      { chave: "perigos", rotulo: "Perigos e Riscos", icone: "perigos", entradas: [{ href: "/hira", label: "Perigos e Riscos", modulo: "HIRA" }] },
      { chave: "incidentes", rotulo: "Acidentes e Incidentes", icone: "acidentes", entradas: [{ href: "/incidentes", label: "Acidentes e Incidentes", modulo: "INCIDENTES" }] },
    ],
  },
  {
    grupo: GRUPO_MODULO.MEIO_AMBIENTE,
    itens: [
      { chave: "aspectos", rotulo: "Aspectos e Impactos", icone: "aspectos", entradas: [{ href: "/laia", label: "Aspectos e Impactos", modulo: "LAIA" }] },
    ],
  },
];

/** Itens fixos no rodapé do menu (acima do cartão do usuário). */
export const MENU_RODAPE: ItemMenuRegistro[] = [
  { chave: "configuracoes", rotulo: "Configurações", icone: "configuracoes", entradas: [{ href: "/configuracoes", label: "Configurações", permissao: "ADMIN_CONFIG" }] },
];

/** O que a pessoa logada pode: quem monta o menu liga isto ao contexto da sessão. */
export interface Acesso {
  temModulo: (modulo: Modulo) => boolean;
  temPermissao: (permissao: Permissao) => boolean;
}

/** Um item pronto para desenhar. `hrefsAtivos` são os endereços que deixam o item destacado (a página principal e as abas). */
export interface ItemMenu {
  chave: string;
  href: string;
  label: string;
  icone: NomeIcone;
  hrefsAtivos: string[];
  contador?: number;
}

/** Uma seção pronta para desenhar. */
export interface SecaoMenu {
  id: string;
  titulo: string;
  itens: ItemMenu[];
}

/** O menu inteiro pronto para a tela. `rotulos` é a lista plana de todas as páginas (alimenta a trilha do cabeçalho). */
export interface MenuMontado {
  topo: ItemMenu[];
  secoes: SecaoMenu[];
  rodape: ItemMenu[];
  rotulos: { href: string; label: string }[];
}

/** A pessoa pode ver esta página? (módulo contratado + permissão) */
function entradaVisivel(e: EntradaMenu, acesso: Acesso): boolean {
  if (e.modulo && !acesso.temModulo(e.modulo)) return false;
  if (!e.permissao) return true;
  const lista = Array.isArray(e.permissao) ? e.permissao : [e.permissao];
  return lista.some((p: Permissao) => acesso.temPermissao(p));
}

/** Transforma um item do registro em item pronto; devolve `null` se a pessoa não vê nenhuma página dele. */
function montarItem(item: ItemMenuRegistro, acesso: Acesso, contadores: Record<string, number>): ItemMenu | null {
  const visiveis = item.entradas.filter((e) => entradaVisivel(e, acesso));
  if (visiveis.length === 0) return null;
  return {
    chave: item.chave,
    href: visiveis[0].href, // a 1ª página visível é o destino do clique no menu
    label: item.rotulo,
    icone: item.icone,
    hrefsAtivos: visiveis.map((e) => e.href),
    contador: contadores[item.chave],
  };
}

/** Monta o menu que esta pessoa enxerga. Seção sem nenhum item visível some inteira. */
export function montarMenu(acesso: Acesso, contadores: Record<string, number> = {}): MenuMontado {
  const itens = (lista: ItemMenuRegistro[]) =>
    lista.map((i) => montarItem(i, acesso, contadores)).filter((i): i is ItemMenu => i !== null);

  const secoes: SecaoMenu[] = MENU_SECOES.map((s) => ({ id: s.grupo, titulo: s.grupo, itens: itens(s.itens) })).filter(
    (s) => s.itens.length > 0,
  );
  const topo = itens(MENU_TOPO);
  const rodape = itens(MENU_RODAPE);

  const todos = [...MENU_TOPO, ...MENU_SECOES.flatMap((s) => s.itens), ...MENU_RODAPE];
  const rotulos = todos.flatMap((i) => i.entradas.filter((e) => entradaVisivel(e, acesso)).map((e) => ({ href: e.href, label: e.label })));

  return { topo, secoes, rodape, rotulos };
}

/**
 * As abas de um módulo (suas páginas visíveis), para mostrar no topo de cada página dele.
 * Devolve lista vazia quando há só uma página visível (aí não precisa de abas).
 */
export function abasDoModulo(acesso: Acesso, chave: string): { href: string; label: string }[] {
  const item = [...MENU_TOPO, ...MENU_SECOES.flatMap((s) => s.itens), ...MENU_RODAPE].find((i) => i.chave === chave);
  const visiveis = (item?.entradas ?? []).filter((e) => entradaVisivel(e, acesso)).map((e) => ({ href: e.href, label: e.label }));
  return visiveis.length > 1 ? visiveis : [];
}
