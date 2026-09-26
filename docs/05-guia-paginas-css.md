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
      form-acao.tsx               # FormAcao / RetornoAcao (client — server action + feedback)
      campo-arquivos.tsx          # CampoArquivos (client — upload múltiplo com prévia)
      anexos.tsx                  # GaleriaAnexos / EnviarAnexos
      interacoes.tsx              # Interacoes (thread da entidade, server)
      item-acoes.tsx              # ItemAcoes (Iniciar/Concluir/Editar/Cancelar item 5W2H)
      tabela-5w2h.tsx             # Tabela5W2H / ItensForm (client)
    rnc-detalhe.tsx               # detalhe da RNC (+ rnc-detalhe-causa.tsx, client)
    rnc-nova.tsx                  # nova RNC (+ rnc-nova-formulario.tsx, client)
```

(Cada `.tsx` acima tem o `.module.css` de mesmo nome em `paginas/css/` ou
`paginas/css/componentes/`.)

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
| Destaque escuro | `--cor-destaque-escuro`, `--cor-destaque-escuro-texto` | etapa concluída do stepper, selo "Ciclo N", opção marcada de segmentados (fora da sidebar) |
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
aplica a classe `fonteIbmPlex` no seu elemento raiz (reforça a fonte em
controles de formulário); o `body` também já usa `--fonte-ui`.

O Tailwind foi **removido** do projeto (sem `globals.css`, sem
`postcss.config.mjs`, sem dependências). O reset que o "preflight" do
Tailwind fazia agora vive em `base.css`, seção 08, dentro de
`@layer reset` — qualquer regra de `.module.css` (sem layer) sempre vence.
Não use classes utilitárias em `className`: toda classe vem de um
`.module.css`.

## 5. Escala de z-index (`base.css`, seção 07)

```
--z-conteudo:  1   (mídia, imagens, vídeos, cards dentro da área de conteúdo)
--z-cabecalho: 10  (cabeçalho sticky do app)
--z-sidebar:   10  (sidebar sticky)
--z-dropdown:  20
--z-popover:   25  (painéis flutuantes ancorados, ex.: notificações do sino)
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
popovers, modais e toasts (`--z-popover`, `--z-modal`, `--z-toast`) devem ficar
acima do cabeçalho. Observação: um popover renderizado *dentro* do cabeçalho
(como o do sino) já herda o stacking context do cabeçalho; o `--z-popover`
ordena-o em relação aos demais filhos do cabeçalho e a futuros popovers fora dele.

## 6. Componentes compartilhados — o que usar e quando

- **Badges**: `BadgeStatusRnc`, `BadgeGravidade`, `BadgeAtrasado`
  (`badge.tsx`) e `BadgeStatusItem`, `BadgeStatusPlano`, `BadgeOrigem`
  (`badge-status-item.tsx`) — tokens de `base.css`. Status de item 5W2H e de
  plano **sempre** pelo `BadgeStatusItem`/`BadgeStatusPlano`, nunca com
  classes locais da página.
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
- **Painel de notificações**: `PainelNotificacoes`
  (`painel-notificacoes.tsx` + `componentes/painel-notificacoes.module.css`)
  — componente client que substitui o link do sino no cabeçalho
  (`layout-app.tsx`). Clicar no sino abre um popover ancorado (camada
  `--z-popover`) com título, filtro Todas/Não lidas, últimas 20 notificações
  (ícone por tipo, título, texto curto, tempo relativo, ponto de não lida),
  "Marcar todas como lidas" e "Ver todas" (`/notificacoes`, página mantida).
  Os dados vêm da server action `listarPainelAcao` (em
  `app/(app)/notificacoes/actions.ts`), chamada ao abrir e ao trocar o filtro;
  ela usa `listarNotificacoes` (só do próprio usuário) e devolve apenas os
  campos exibidos. Clicar num item envia `abrirNotificacaoAcao` (marca lida +
  redirect só para caminho interno); o contador do sino atualiza via
  `revalidatePath` / `router.refresh()`. Acessibilidade: sino com
  `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; painel
  `role="dialog"` com `aria-label`; foco vai para o painel ao abrir e volta ao
  sino ao fechar (Esc); fecha também com clique fora e ao navegar. Celular
  (≤640px): `.ancora` vira `position: static` e o painel se ancora no cabeçalho
  (sticky) — `top: 100%`, largura total,
  `max-height: 70vh` com rolagem interna.
  **Animação** (seção 01 do CSS, variáveis em `.ancora`):
  `--painel-anim-duracao` (160ms), `--painel-anim-curva` (ease-out),
  `--painel-anim-deslocamento` (-6px) e `--painel-anim-escala` (0.97) — fade +
  deslize/escala a partir do sino (`transform-origin: top right`). Com
  `prefers-reduced-motion: reduce` a animação é desligada. Só a entrada é
  animada (o painel usa `hidden` ao fechar).

Todos em `src/paginas/html/componentes/`.

## 7. `src/components/`

Os antigos `ui.tsx` (Tailwind) e os shims de reexport (`anexos`,
`tabela-5w2h`, `interacoes`, `item-acoes`, `campo-arquivos`, `form-acao`)
foram **removidos**; importe sempre de `@/paginas/html/componentes/<nome>`.
Só `atualizar-contadores.tsx` continua em `src/components/` (não tem markup,
só efeito).

`FormAcao` ganhou as props `variante` (`primario`/`secundario`/`perigo`/`texto`,
mesmo visual do `Botao`) e `tamanho` (`normal`/`pequeno`). Sem `variante`, uma
`classeBotao` recebida é usada sozinha (compatível com quem ainda passa classes
próprias); com `variante`, `classeBotao` entra como classe extra. Para
formulários com `useActionState` próprio, `RetornoAcao` renderiza as mesmas
mensagens de erro/aviso/sucesso.

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
- Plano de Ação (lista unificada, agrupada por prazo) — `src/app/(app)/plano-acao/page.tsx` → `paginas/html/plano-acao-lista.tsx`
- Item de ação (responsivo, estilo `Mobile-Item.dc.html`) — `plano-acao/[id]/page.tsx` → `paginas/html/plano-acao-item.tsx`
- Novo plano avulso — `plano-acao/novo/page.tsx` → `paginas/html/plano-acao-novo.tsx` (+ `plano-acao-novo-formulario.tsx`)
- Detalhe do plano avulso — `plano-acao/planos/[id]/page.tsx` → `paginas/html/plano-acao-plano.tsx` (+ `plano-acao-plano-editar.tsx`)
- Badges de status de item/plano — `paginas/html/componentes/badge-status-item.tsx` (`BadgeStatusItem`, `BadgeStatusPlano`, `BadgeOrigem`)
- `base.css` com tokens + fontes IBM Plex Sans/Mono (`src/app/layout.tsx`)
- Início — `src/app/(app)/page.tsx` → `paginas/html/inicio.tsx`
- Dashboard — `src/app/(app)/dashboard/page.tsx` → `paginas/html/dashboard.tsx`;
  `dashboard/graficos.tsx` → `paginas/html/dashboard-graficos.tsx` (cores via
  classes de `dashboard-graficos.module.css`, só tokens de `base.css`)
- Mensagens — `src/app/(app)/mensagens/page.tsx` → `paginas/html/mensagens.tsx`
- Notificações — `src/app/(app)/notificacoes/page.tsx` → `paginas/html/notificacoes.tsx`
  (actions continuam em `src/app/(app)/notificacoes/actions.ts`)
- Administração — `src/app/(app)/configuracoes/page.tsx` → `paginas/html/configuracoes.tsx`
  (todas as abas; actions continuam em `src/app/(app)/configuracoes/actions.ts`;
  botões do `FormAcao` via `composes` de `componentes/botao.module.css`)
- `src/components/atualizar-contadores.tsx` não tem markup (só efeito) — nada a migrar
- Detalhe da RNC — `src/app/(app)/rncs/[id]/page.tsx` → `paginas/html/rnc-detalhe.tsx`
  (+ `rnc-detalhe-causa.tsx`, ex-`causa-form.tsx`; o antigo `itens-form.tsx` foi
  removido — a página usa `ItensForm` de `componentes/tabela-5w2h` com
  `adicionarItensAcao`)
- Nova RNC (responsiva, `NovaRnc.dc.html` + `Mobile-NovaRnc.dc.html`) —
  `src/app/(app)/rncs/nova/page.tsx` → `paginas/html/rnc-nova.tsx`
  (+ `rnc-nova-formulario.tsx`, ex-`form-nova.tsx`)
- Componentes compartilhados `anexos`, `tabela-5w2h`, `interacoes`,
  `item-acoes`, `campo-arquivos`, `form-acao` → `paginas/html/componentes/`
  (os shims em `src/components/` foram removidos, ver seção 7)

**Ainda não migrado:** nenhuma página. Limpeza final: Tailwind removido
(dependências, PostCSS, `globals.css`, `legado-ui.tsx`, `COR_*` de
`lib/rnc/rotulos.ts`), reset próprio em `base.css` (seção 08), detalhe da
RNC usando `BadgeStatusItem`/`BadgeStatusPlano` e `layout-app.module.css`
com seção 08 "Responsivo" (até 900px a sidebar vira barra superior com botão
"Menu" que abre painel com todos os itens; o cabeçalho continua sticky).

## 10. Pendências conhecidas

- O filtro "Somente atrasadas" e o botão "Exportar CSV" aparecem no mockup
  `Main.dc.html`, mas não existem no código atual (nenhuma rota de exportação,
  nenhum campo de filtro de atraso em `esquemaFiltros`). Não foram
  implementados nesta etapa para não inventar regra de negócio nova — ver
  dono do produto antes de adicionar.
- O mockup de login mostra "Manter conectado", "Esqueci minha senha" e links
  de rodapé (privacidade/termos) sem funcionalidade correspondente no app hoje;
  foram omitidos para não sugerir recursos que não existem.
- Mockup `Inicio.dc.html` sem lastro no código (não implementado): saudação por
  horário ("Bom dia") e frase-resumo com data, botão "Nova RNC", cartões
  "Vencem nesta semana" e "RNCs aguardando você", painel "Minhas pendências"
  (atrasados / nesta semana / próximos), lista "RNCs aguardando você" com
  botões de ação rápida (Verificar, Assumir análise, Registrar causa) e o
  código da RNC em cada mensagem (a query `listarNaoLidas` não traz o código).
  A página mantém os 3 indicadores e as mensagens não lidas que já existiam.
- Mockup `A-Dashboard.dc.html` sem lastro no código (não implementado):
  seletor de período pré-definido ("Últimos 12 meses"…) — o app usa De/Até;
  botão "Exportar"; "atualizado hoje às…"; sublinhas dos KPIs com quebra por
  status, comparação com período anterior, meta interna e "x de y"; nota
  "SSO concentra…"; barra empilhada de gravidade; tabela de responsáveis com
  RNCs/itens em aberto e % no prazo (os indicadores só trazem a contagem de
  atrasados por responsável). O KPI "Canceladas" e o filtro de setor, que
  existem no código mas não no mockup, foram mantidos.
- Mensagens, Notificações e Administração não têm mockup próprio; seguem os
  mesmos tokens/padrões (painel branco com borda, abas com sublinhado âmbar).
- As mensagens de retorno do `FormAcao` (erro/aviso/sucesso) são do
  componente compartilhado `src/components/form-acao.tsx`, migrado à parte.
- Plano de Ação (`PlanoAcao.dc.html`, `PlanoManual.dc.html`, `Mobile-Item.dc.html`):
  elementos do mockup **sem lastro** no código e por isso não implementados —
  busca "Buscar em O quê", filtro de origem (Todas/RNC/Manual/**Inspeção** — não
  existe origem inspeção), coluna "Obra" (a query não traz o nome da obra),
  contadores nas abas "Meus itens"/"Todos" (exigiriam queries extras), opção
  "Próximos 30 dias", truncamento "Mostrando 4 de 7 · ver todos" por grupo,
  menu "⋯" por linha (as ações continuam no `ItemAcoes` compartilhado),
  "Rascunho salvo automaticamente" no novo plano, "item 1 de 3" / "Mais opções"
  e compositor fixo de mensagem no rodapé do item em celular (as interações
  usam o componente compartilhado `Interacoes`). O agrupamento por prazo
  (Atrasados / Próximos 7 dias / Depois / Concluídos-cancelados) e o chip
  "vence em N dias" são só derivados de `status` + `quando` já existentes.
- Detalhe da RNC (`A-Detalhe.dc.html`, `Verificacao.dc.html`): elementos
  **sem lastro** e não implementados — botão "⋯ Mais ações"; "Iniciado em" do
  ciclo; "Prazo do plano" e "Atualizada em … por …" nos detalhes; contador de
  mensagens na aba Interações (exigiria query extra); anexos por item na coluna
  de ações da verificação (só são carregados na aba Plano); link "Encaminhar
  para <pessoa>" na nota de verificador (não existe reatribuição de
  verificação). Mantidos do código, fora do mockup: aba Cancelamento, coluna
  "Ações" do 5W2H (`ItemAcoes`), ciclos anteriores esmaecidos. Derivados sem
  regra nova: stepper (a partir de `status` + `historicoStatus`; REABERTO volta à
  etapa 1, CANCELADO marca a etapa onde parou), "N dia(s) em aberto",
  progresso "x de y concluído(s)" e custo total por ciclo, botão "Solicitar
  cancelamento" no cabeçalho (só um link para a aba já existente). O painel
  lateral "Detalhes" agora aparece em todas as abas; "Anexos" da RNC continua só
  no Resumo (onde a lista é carregada).
- Nova RNC (`NovaRnc.dc.html`, `Mobile-NovaRnc.dc.html`): sem lastro e não
  implementados — selo "Leva menos de 2 minutos", "Rascunho salvo às…",
  descrições das gravidades ("Sem impacto relevante"…) e "O responsável é
  avisado e pode reatribuir" (critérios/comportamentos não definidos no
  código), botão "Tirar foto"/contador "2 de 6" e remoção individual de foto
  (o upload é um `<input type="file" multiple>`), "Pré-selecionada pela sua
  última obra" (só há pré-seleção quando o usuário tem uma única obra) e a
  frase sobre quem vê RNC restrita (mantido o texto real do código).
- Tokens `--cor-destaque-escuro`/`-texto` (base.css, seção 02) foram criados
  para o tom escuro usado no conteúdo (stepper, selo de ciclo, segmentados),
  em vez de reaproveitar os tokens de sidebar.
- A busca global do cabeçalho foi **removida** (era só visual, sem rota de
  busca). O cabeçalho do app tem só trilha + sino. Se uma busca global for
  especificada, reintroduzir com rota/API própria.
- Ajustes visuais (5W2H sem rolagem, menu mobile, dashboard, verificação):
  - 5W2H: `Tabela5W2H` (editável) virou grade de campos com rótulo visível por
    linha, arranjo por container query (1 faixa ≥ 960px, 2 faixas no cartão do
    detalhe da RNC, empilhado ≤ 560px) — nunca rola na horizontal. As tabelas de
    leitura do detalhe da RNC e do plano avulso usam `table-layout: fixed` com
    larguras em % (textos quebram linha; Quando/Quanto/Status compactas), um
    `<tbody>` por item e as ações (`ItemAcoes`) numa linha própria abaixo do item
    (`itemTemAcoes` decide se a linha existe). Até 640px viram cartões
    empilhados (rótulos via `data-rotulo`). A coluna "Ações" deixou de existir.
  - Menu ≤ 900px: `NavLateral` (client) tem botão "Menu" (`aria-expanded`,
    `aria-controls`) que abre o painel sob a barra; fecha ao navegar, com Esc ou
    clique fora. A sidebar usa `--z-dropdown` nessa faixa para o painel ficar
    acima do cabeçalho sticky.
  - Dashboard: rótulos dos eixos do gráfico mensal saíram do SVG (HTML
    posicionado em %), então têm 11,5px em qualquer largura; o SVG estica com
    `preserveAspectRatio="none"` e traço sem escala. No celular, meses
    alternados somem (container query).
  - Verificação: o código da RNC em "Sim, eficaz" não quebra (`white-space: nowrap`).
  - Não verificado visualmente: detalhe de plano avulso (`/plano-acao/planos/[id]`)
    — nenhum plano avulso na base de teste; o CSS segue o mesmo padrão do detalhe da RNC.
