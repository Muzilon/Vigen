# 05 — Guia de páginas e CSS (Direção A "Campo")

Este guia documenta a nova organização de arquivos de UI adotada a partir desta
etapa. É a referência para qualquer pessoa (ou agente) que for migrar mais uma
página do Tailwind/`src/app/**` antigo para o novo padrão.

## 1. Estrutura de pastas

```
src/paginas/
  css/
    base.css                     # tokens globais, reset, tipografia (importado 1x no layout raiz)
    layout-app.module.css        # sidebar + cabeçalho da área logada
    login.module.css             # página de login
    rncs-lista.module.css        # página "Lista de RNCs"
    componentes/
      badge.module.css
      botao.module.css
      cabecalho-pagina.module.css
      campo-formulario.module.css
      cartao.module.css
      estado-vazio.module.css
      alerta.module.css
      tabela.module.css
  html/
    layout-app.tsx                # casca da área logada (sidebar + cabeçalho)
    login.tsx                     # página de login (server component)
    login-formulario.tsx          # formulário de login (client component, específico da página)
    rncs-lista.tsx                # página "Lista de RNCs"
    componentes/
      badge.tsx                   # BadgeStatusRnc / BadgeGravidade / BadgeAtrasado
      botao.tsx                   # Botao / LinkBotao (variantes primario/secundario/perigo/texto)
      cabecalho-pagina.tsx        # CabecalhoPagina (título + contador + subtítulo + ações)
      campo-formulario.tsx        # Rotulo / Entrada / Selecao / CampoBusca
      cartao.tsx                  # Cartao (painel com borda)
      estado-vazio.tsx            # EstadoVazio (mensagem de lista/tabela sem dados)
      alerta.tsx                  # Alerta (erro/aviso inline)
      tabela.tsx                  # EnvoltorioTabela / Tabela / Th / Td / Linha*
      nav-lateral.tsx             # NavLateral (client — menu da sidebar, item ativo)
      trilha.tsx                  # Trilha (client — breadcrumb do cabeçalho)
      legado-ui.tsx               # Badge/Cabecalho/Cartao/Campo/cls do ui.tsx antigo (Tailwind)
```

Os arquivos em `src/app/**/page.tsx` e `layout.tsx` viram **cascas finas**: só
importam o componente de `paginas/html` e o renderizam, repassando `params`/
`searchParams`. Toda a lógica de servidor (Prisma, permissões, server actions)
continua exatamente onde estava — ela só passou a viver dentro do arquivo de
`paginas/html/<pagina>.tsx` em vez do antigo `src/app/.../page.tsx` (o conteúdo
foi movido, não reescrito).

Exemplo (`src/app/(app)/rncs/page.tsx`):

```tsx
import RncsLista from "@/paginas/html/rncs-lista";

export default function Page(props: PageProps<"/rncs">) {
  return <RncsLista {...props} />;
}
```

## 2. Convenção de nomes

- Um arquivo `.tsx` em `paginas/html/` ⇄ um arquivo `.module.css` em
  `paginas/css/` com o **mesmo nome base** (`rncs-lista.tsx` ↔
  `rncs-lista.module.css`). Nunca dois componentes de página dividindo um CSS.
- Componentes compartilhados (usados por 2+ páginas) ficam em
  `paginas/html/componentes/<nome>.tsx` + `paginas/css/componentes/<nome>.module.css`.
- Classes CSS em **português**, descritivas do papel visual/semântico, nunca
  do valor (`.linhaAtrasada`, não `.textoVermelho`; `.cabecalho`, não `.flexRow`).
- Exceções (não seguem 1-para-1): `base.css` (global, tokens/reset) e o par
  `layout-app.tsx` + `layout-app.module.css` (sidebar + cabeçalho, únicos e
  compartilhados por toda a área logada).

## 3. Seções numeradas dentro de cada CSS

Todo `.module.css` novo começa com um índice em comentário e cada bloco tem um
cabeçalho numerado, por exemplo:

```css
/* ==========================================================
   ÍNDICE
   01. Página — espaçamento vertical geral
   02. Filtros — barra de busca e selects acima da tabela
   ...
   ========================================================== */

/* ==========================================================
   02. FILTROS
   ========================================================== */
.barraFiltros { ... }
```

Ao editar uma página, use `Ctrl+F` pelo número/título da seção no índice — não
precisa ler o arquivo inteiro. Comentários curtos só onde a propriedade não é
óbvia (ex.: por que um `z-index` específico, por que `max-width: 0` num `td`
truncado).

## 4. Tokens disponíveis (`src/paginas/css/base.css`)

| Grupo | Exemplos | Uso |
|---|---|---|
| Sidebar | `--cor-sidebar-fundo`, `--cor-sidebar-texto`, `--cor-sidebar-item-ativo-fundo` | só dentro de `layout-app.module.css` |
| Acento | `--cor-acento` (#B45309), `--cor-acento-hover`, `--cor-acento-claro` | botões primários, item ativo, ícones de destaque |
| Superfície | `--cor-fundo`, `--cor-fundo-sutil`, `--cor-superficie` | fundo de página / cabeçalho de tabela / cartões |
| Borda | `--cor-borda`, `--cor-borda-forte`, `--cor-borda-sutil` | cartões, inputs, linhas de tabela |
| Texto | `--cor-texto`, `--cor-texto-secundario`, `--cor-texto-fraco` | hierarquia de texto |
| Status de RNC | `--cor-status-<status>-fundo` / `-texto` (aberto, em-analise, plano-execucao, em-verificacao, encerrado, reaberto, cancelado) | `BadgeStatusRnc` |
| Gravidade | `--cor-gravidade-<nivel>-fundo` / `-texto` (baixa, media, alta, critica) | `BadgeGravidade` |
| Atraso | `--cor-atrasado-texto`, `--cor-atrasado-fundo` | `BadgeAtrasado` |
| Tipografia | `--fonte-ui` (IBM Plex Sans), `--fonte-mono` (IBM Plex Mono) | aplicar via classe utilitária `.fonteIbmPlex` (definida em `base.css`) no elemento raiz da página migrada |
| Espaço/raio | `--espaco-1`…`--espaco-8`, `--raio-padrao` (6px), `--raio-pill` | espaçamento e cantos |

**Nunca usar hex solto fora de `base.css`.** Se precisar de uma cor nova,
adicione o token em `base.css` (seção correta) e use `var(--...)` no CSS do
componente/página.

As fontes IBM Plex Sans/Mono são carregadas via `next/font/google` em
`src/app/layout.tsx` (variáveis `--font-ibm-plex-sans` / `--font-ibm-plex-mono`),
e `base.css` as expõe como `--fonte-ui` / `--fonte-mono`. Uma página migrada
aplica a classe `fonteIbmPlex` no seu elemento raiz para herdar a fonte; páginas
ainda não migradas continuam com a fonte Geist/Tailwind de `globals.css`.

## 5. Escala de z-index (`base.css`, seção 07)

```
--z-conteudo:  1   (mídia, imagens, vídeos, cards dentro da área de conteúdo)
--z-cabecalho: 10  (cabeçalho sticky do app)
--z-sidebar:   10  (sidebar sticky)
--z-dropdown:  20
--z-modal:     30
--z-toast:     40
```

Regra fixa: **o cabeçalho e a sidebar ficam sempre acima de qualquer conteúdo**
(`position: sticky; top: 0; z-index: var(--z-cabecalho)` no cabeçalho;
`position: sticky; top: 0; height: 100vh` na sidebar). A área de conteúdo
(`.conteudo` em `layout-app.module.css`) usa `isolation: isolate` + `z-index:
var(--z-conteudo)` — isso garante que qualquer `img`/`video`/`iframe` futuro
dentro dela nunca crie um stacking context que vaze acima do cabeçalho, mesmo
que alguém coloque um `z-index` alto num card de conteúdo por engano. Só
modais e toasts (`--z-modal`, `--z-toast`) devem ficar acima do cabeçalho.

## 6. Componentes compartilhados — o que usar e quando

- **Badges**: `BadgeStatusRnc`, `BadgeGravidade`, `BadgeAtrasado` (novos,
  tokens de `base.css`). Para páginas ainda não migradas, o `Badge` antigo
  (Tailwind, recebe `cor` como classe pronta) continua em
  `src/components/ui.tsx` → reexporta de `paginas/html/componentes/legado-ui.tsx`.
- **Botões**: `Botao` (button) / `LinkBotao` (Link), variantes `primario`
  (padrão), `secundario`, `perigo`, `texto`.
- **Campos de formulário**: `Rotulo` (label, com `oculto` para rótulo só de
  leitor de tela), `Entrada` (input), `Selecao` (select), `CampoBusca` (input
  com ícone de lupa + atalho opcional).
- **Cartão**: `Cartao` (painel com borda, título opcional).
- **Cabeçalho de página**: `CabecalhoPagina` (título + contador + subtítulo +
  ações) — não confundir com o cabeçalho do app em `layout-app.tsx`.
- **Tabela**: `EnvoltorioTabela`, `Tabela`, `LinhaCabecalhoTabela`, `Th`,
  `LinhaTabela`, `Td` (variantes `padrao`/`secundario`/`truncado`/`mono`).
- **Estado vazio**: `EstadoVazio`.
- **Alerta**: `Alerta` (variantes `erro`/`aviso`).

Todos em `src/paginas/html/componentes/`.

## 7. Sobre `src/components/ui.tsx` e outros compartilhados (`anexos.tsx`,
`tabela-5w2h.tsx`, `interacoes.tsx`, `item-acoes.tsx`, `campo-arquivos.tsx`,
`form-acao.tsx`, `atualizar-contadores.tsx`)

`src/components/ui.tsx` foi transformado num **shim de reexport**: a
implementação real (Tailwind, inalterada) está em
`src/paginas/html/componentes/legado-ui.tsx`. Isso evita quebrar as 18+
páginas que ainda não migraram e ainda importam de `@/components/ui`. Ao
migrar uma dessas páginas, troque a importação para os componentes novos
(`@/paginas/html/componentes/badge`, `.../botao`, etc.) em vez de
`@/components/ui`.

Os demais componentes citados acima (`anexos.tsx`, `tabela-5w2h.tsx`, etc.)
**ainda não foram migrados** nesta etapa — continuam em `src/components/` com
Tailwind, e devem seguir o checklist abaixo quando for a vez deles.

## 8. Checklist para migrar uma página

1. Leia o mockup `.dc.html` correspondente em
   `scratchpad/design/project/<Nome>.dc.html` (ou peça ao dono do produto o
   nome do artboard) e o `BRIEF.md` ao lado para os tokens de cor/fonte.
2. Crie `src/paginas/html/<nome-da-pagina>.tsx` movendo (não reescrevendo) a
   lógica de servidor do `page.tsx`/`layout.tsx` original: mesmas queries,
   mesmas permissões, mesmos server actions. Se a página tiver uma parte
   client-only (formulário com `useActionState`, por exemplo), separe em
   `src/paginas/html/<nome>-<parte>.tsx` com `"use client"`.
3. Crie `src/paginas/css/<nome-da-pagina>.module.css` com índice numerado,
   usando só `var(--...)` de `base.css` (mais os tokens de
   `paginas/css/componentes/*` via `composes`, se fizer sentido).
4. Troque cada elemento Tailwind por: (a) um componente de
   `paginas/html/componentes/` já existente, ou (b) markup próprio da página
   estilizado pelo novo `.module.css`.
5. Torne `src/app/**/page.tsx` (e `layout.tsx`, se for o caso) uma casca fina
   que só importa e renderiza o componente novo, repassando `params`/
   `searchParams` sem alterar nenhuma regra de negócio.
6. Rode `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` e os
   `npm run test:*` relevantes, depois `npm run build`.
7. Atualize a lista de "páginas migradas" abaixo.

## 9. Status desta etapa

**Migradas (Direção A "Campo"):**
- Layout da área logada — `src/app/(app)/layout.tsx` → `paginas/html/layout-app.tsx`
- Lista de RNCs — `src/app/(app)/rncs/page.tsx` → `paginas/html/rncs-lista.tsx`
- Login — `src/app/login/page.tsx` → `paginas/html/login.tsx` (+ `login-formulario.tsx`)
- `base.css` com tokens + fontes IBM Plex Sans/Mono (`src/app/layout.tsx`)

**Ainda não migradas (continuam em Tailwind, usando `src/components/ui.tsx` /
`@/components/*`):**
- `src/app/(app)/page.tsx` (Início)
- `src/app/(app)/dashboard/page.tsx` (+ `graficos.tsx`)
- `src/app/(app)/rncs/[id]/page.tsx` (+ `causa-form.tsx`)
- `src/app/(app)/rncs/nova/page.tsx` (+ `form-nova.tsx`)
- `src/app/(app)/plano-acao/page.tsx`
- `src/app/(app)/plano-acao/[id]/page.tsx`
- `src/app/(app)/plano-acao/novo/page.tsx` (+ `form-novo.tsx`)
- `src/app/(app)/plano-acao/planos/[id]/page.tsx` (+ `editar-form.tsx`)
- `src/app/(app)/mensagens/page.tsx`
- `src/app/(app)/notificacoes/page.tsx`
- `src/app/(app)/configuracoes/page.tsx`
- Componentes compartilhados: `src/components/anexos.tsx`, `tabela-5w2h.tsx`,
  `interacoes.tsx`, `item-acoes.tsx`, `campo-arquivos.tsx`, `form-acao.tsx`,
  `atualizar-contadores.tsx`

## 10. Pendências conhecidas

- O filtro "Somente atrasadas" e o botão "Exportar CSV" aparecem no mockup
  `Main.dc.html`, mas não existem no código atual (nenhuma rota de exportação,
  nenhum campo de filtro de atraso em `esquemaFiltros`). Não foram
  implementados nesta etapa para não inventar regra de negócio nova — ver
  dono do produto antes de adicionar.
- O mockup de login mostra "Manter conectado", "Esqueci minha senha" e links
  de rodapé (privacidade/termos) sem funcionalidade correspondente no app hoje;
  foram omitidos para não sugerir recursos que não existem.
- O Tailwind continua no projeto (não pode ser removido) até que as páginas
  da seção 9 acima também migrem.
