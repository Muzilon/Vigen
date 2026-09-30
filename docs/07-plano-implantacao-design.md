# 07 — Plano de implantação do novo design

> **Status:** plano em **execução** (Fases 0 e 1 concluídas, Fase 2 iniciada pelo login — ver §9). Proposto pelo Claude em 2026-09-30. Quem codifica: Antigravity
> (ou Claude, quando o Eric pedir). Nada deste plano mexe em regra de negócio: é **só apresentação** (CSS, marcação e textos).
> Fonte do design: Figma `Vigen — Sistema (SGI)` (chave `gf2F5oM27eFBoFirIAnW1L`).

## 1. Decisões do dono registradas em 2026-09-30

| # | Decisão | Efeito |
|---|---|---|
| 1 | **Requisitos Legais descontinuado** (complexidade). Apagar tudo, inclusive as interações com outros módulos. | Código, telas, seed, testes e integrações removidos; migração `20260930100000_remove_requisitos_legais` (ainda **não aplicada**: rodar `npx prisma migrate deploy` e reiniciar o `npm run dev`). Valores de enum legados permanecem no banco. Ver guia §8.12. |
| 2 | **HIRA passa a se chamar "Perigos e Riscos".** | Textos visíveis e menu trocados. URLs (`/hira`), nomes de arquivo, permissão `HIRA_GERENCIAR` e enum **não mudam** (ver pergunta P2 abaixo). |
| 3 | **Nova sidebar** por seções em lista (abre ao clicar/passar o mouse). | Desenho abaixo (§3). |
| 4 | **Nova logo.** A versão com a frase "Sistema de Gestão Integrado" é a **logomarca principal** e vai na **tela de login**. | §4. |
| 5 | Aplicar o design a **todos** os módulos, telas, avisos e janelas flutuantes; onde o Figma não tem quadro, seguir o padrão. | §5 e §6. |
| 6 | **Manter os comentários** em português; se a função mudar, **ajustar o comentário**. | Regra de ouro em §7. |

## 2. Bloqueio atual: acesso ao Figma

O plano Starter do Figma tem limite de chamadas por mês e ele **foi atingido** durante esta sessão. Consegui ler só a estrutura da
página "01 · Telas (desktop)" (minhas 27 telas + complementares). **Não consegui abrir** a página onde estão a **"sidebar atual"**
e as **logos novas**. Três caminhos (escolher um):

1. **Exportar manualmente** do Figma (recomendado, não gasta cota): PNG 2× da "sidebar atual" (aberta e com uma seção expandida),
   logo principal (SVG, com a frase), logo compacta/ícone (SVG) e, se existirem, os tokens (cores, fontes). Salvar em
   `docs/design/` (criar) e me avisar.
2. **Esperar a cota renovar** (início do mês) ou **fazer upgrade** para o plano pago.
3. Me passar **capturas de tela** de cada tela nova (mesmo as 27 já feitas) — posso desenhar a partir delas.

## 3. Sidebar — opinião de UX/UI

**Recomendo: seções em acordeão, abertas por clique/toque — e NÃO por passar o mouse.** Motivos:

- **Celular/tablet não têm "passar o mouse".** O Vigen é usado em campo: o comportamento principal precisa funcionar por toque.
- **Hover abre e fecha sem querer** (o mouse atravessa a barra a caminho do conteúdo) e falha na acessibilidade (WCAG 1.4.13, teclado e
  leitor de tela). Clique é previsível.
- Dá para **agradar quem usa mouse** sem perder isso: em desktop, abrir por *hover-intent* (atraso de ~150 ms e só se o mouse
  ficar parado sobre o título) é um **extra opcional da fase 2**, sempre com o clique funcionando igual.

**Estrutura sugerida (2 níveis no máximo):**

```
[logo compacta]
Início · Dashboard · Aprovações(3) · Notificações · Mensagens      ← fixos, sempre visíveis
─────────
▸ QUALIDADE        Mapa de processos · Documentos · Inspeções · Auditorias · RNC
▸ SEGURANÇA        Perigos e Riscos · Incidentes
▸ MEIO AMBIENTE    Aspectos e impactos (LAIA)
▸ GESTÃO           Riscos e oportunidades · SWOT · Indicadores · Treinamentos · Plano de ação
─────────
Configurações · [usuário/empresa]                                  ← rodapé fixo
```

**Regras de comportamento:**

1. O título da seção é um **botão** (`aria-expanded`, `aria-controls`), com seta que gira; Enter/Espaço abre e fecha.
2. A seção que contém a **página atual abre sozinha** e o item ativo fica destacado; as outras começam recolhidas.
3. Pode haver **mais de uma seção aberta** (não force "uma por vez": é irritante comparar módulos). Lembrar o estado em
   `localStorage` (por usuário, dentro de try/catch).
4. **Seção com um só item** (hoje: Meio Ambiente) vira **link direto** com o nome da seção, sem acordeão inútil.
5. **Sub-visões viram abas dentro da página, não itens do menu.** Hoje Treinamentos tem 4 itens no menu (Catálogo, Matriz, Meus,
   Evidências), Documentos 2 e Indicadores 2. Sugiro **um item por módulo** e as abas (`Catálogo | Matriz | Meus | Evidências`) no topo
   da página. O menu encolhe ~30% e fica dentro dos 2 níveis.
6. **Seção recolhida mostra pendências:** um ponto/contador no título se houver algo dentro que precisa de ação (atrasos, aprovações).
7. **Só aparece o que a empresa contratou e o usuário pode ver** (já é assim em `menu-registro.ts`); seção sem nenhum item visível
   some inteira.
8. **Celular:** vira gaveta (drawer) com o mesmo acordeão; alvos de toque ≥ 44 px; fecha ao navegar, no Esc e fora dela (já existe).
9. **Fase 2 (opcional):** modo "trilho" só com ícones (recolher a barra) e busca rápida (Ctrl+K).

**Impacto técnico (pequeno):** `menu-registro.ts` já tem `grupo` por item; `nav-lateral.tsx` passa a agrupar por `grupo`
(`GRUPO_MODULO`) e renderizar o acordeão; o CSS vem de `layout-app.module.css`. Nenhuma regra de negócio muda. Os comentários de
`nav-lateral.tsx` serão reescritos para a nova função.

## 4. Logos e identidade

- **Logo principal (com "Sistema de Gestão Integrado")** → **tela de login** (`login.tsx`) e documentos/e-mails institucionais.
- **Logo compacta/ícone** → topo da sidebar, favicon e cabeçalho do celular. (Se só existir a versão principal, o Eric decide a
  compacta; eu não recorto logo sozinho.)
- Formato: **SVG** em `public/marca/` (`vigen-logo-principal.svg`, `vigen-logo-compacto.svg`, favicon em `src/app/favicon.ico`),
  usados com `next/image` e `alt="Vigen — Sistema de Gestão Integrado"`. Nada de redesenhar/recolorir o SVG; só usar a variante
  clara/escura que o Figma fornecer.

## 5. Plano de implantação (ordem e motivos)

Princípio: **trocar os tokens primeiro** (muda o sistema inteiro de uma vez, com pouco risco), depois a casca, depois os componentes
e só então módulo a módulo. Uma entrega = um commit, **um módulo por vez**, sempre com o sistema funcionando.

| Fase | O que entra | Por quê / saída |
|---|---|---|
| **0. Preparação** | Receber assets do Figma (§2); criar `docs/design/` com capturas e tokens; decidir as perguntas P1–P4; criar branch `design/novo`. | Sem insumo não há fidelidade. Saída: tabela de tokens (cores, fontes, raios, sombras) aprovada pelo Eric. |
| **1. Fundação** | Trocar os **tokens do `base.css`** (cores, fontes, raio, espaços, z-index) e fontes em `layout.tsx`; logos e favicon. **Nada de cor solta nas páginas.** | Uma mudança, efeito em todo o sistema. Saída: sistema inteiro já com a nova identidade (ainda imperfeito). |
| **2. Casca** | `layout-app` + `nav-lateral` (acordeão §3) + cabeçalho + `login` (logo principal). | É o que aparece em 100% das telas. |
| **3. Componentes compartilhados** | `badge`, `botao`, `tabela`, `cartao`, `campo-formulario`, `alerta`, `form-acao`, `heatmap`, `anexos`, `item-acoes`, `trilha-assinaturas`, `painel-notificacoes`, estados vazios. **Janelas flutuantes e avisos** (confirmações, toasts, painéis) padronizados aqui (§6). | Corrigir uma vez, herdar em todas as páginas. |
| **4a. Base** | Início, Dashboard, Notificações, Mensagens, Aprovações. | Alto tráfego. |
| **4b. RNC e Plano de Ação** | `rncs-*`, `rnc-*`, `plano-acao-*`. | Coração do sistema; testado em `test:fluxo-rnc`. |
| **4c. Qualidade** | Mapa de processos, Documentos, Inspeções (campo/celular), Auditorias. | |
| **4d. Gestão** | Riscos e oportunidades, SWOT, Indicadores, Treinamentos. | |
| **4e. Segurança e Meio Ambiente** | **Perigos e Riscos** (ex-HIRA), Incidentes (celular), LAIA. | |
| **4f. Administração** | Configurações (10 abas). | Menos usada, maior (680 linhas). |
| **5. Fechamento** | Varredura de "cor solta", acessibilidade, 390/768/1440 px, atualização do `docs/05-guia-paginas-css.md` e do guia §10. | Saída: checklist final assinado. |

**Inventário (arquivos de página a revisar):** base 10 · RNC 5 · Plano de Ação 6 · Processos 4 · Riscos 4 · SWOT 2 · Perigos e Riscos 6 ·
LAIA 6 · Documentos 6 · Inspeções 5 · Auditorias 5 · Incidentes 4 · Indicadores 4 · Treinamentos 7 · Configurações 1 · componentes 28
(+ 26 CSS de componentes).

## 6. Telas, avisos e janelas que **não** estão no Figma

Regra: **não inventar linguagem nova.** Derivar do que já existe no Figma, nesta ordem de prioridade:

1. Reaproveitar o componente equivalente já redesenhado (ex.: um formulário novo usa `Cartao` + `campo-formulario` + `FormAcao`).
2. Copiar a **composição** de uma tela irmã do mesmo módulo (ex.: "nova linha" segue "novo risco").
3. Só se não houver nada parecido: desenhar pelo padrão de tokens e **mostrar ao Eric antes** de aplicar.

Padrões a definir na Fase 3 (hoje cada página faz do seu jeito): **aviso/alerta** (sucesso, atenção, erro — `componentes/alerta`),
**confirmação** (hoje `confirmar="…"` do `FormAcao`, que usa o diálogo do navegador — sugiro um modal próprio e acessível),
**painel de notificações** (flutuante), **estado vazio**, **carregando** e **erro**. Todos com foco preso no modal, Esc fecha,
`aria-live` para avisos e `prefers-reduced-motion`.

## 7. Regras de execução (valem para quem codificar)

1. **Só apresentação:** CSS Module, marcação e texto. Nenhuma regra de negócio, serviço, schema ou permissão muda. Se o design exigir
   dado novo, **parar e perguntar**.
2. **Só tokens** do `base.css` (nunca cor/medida solta). Um `.module.css` por página, com o mesmo nome, seções numeradas.
3. **Comentários:** manter todos os comentários em português. **Ao mudar o que um trecho faz, reescrever o comentário dele** (ex.:
   `nav-lateral.tsx` deixa de ser "lista vertical" e vira "acordeão por seção"). Comentário desatualizado é pior que nenhum.
4. **Reaproveitar** `src/paginas/html/componentes/` antes de criar; componente novo só se o design exigir.
5. **Por tela:** ler o quadro do Figma → mapear para componentes → ajustar → estados (vazio/erro/carregando/sem permissão) → teclado e
   foco → **390 / 768 / 1440 px** sem rolagem horizontal da página → conferir com o quadro.
6. **Verificação a cada módulo:** `npx tsc --noEmit -p .`, `npx eslint <arquivos>`, `npm test`, `npm run test:<modulo>` e abrir a tela.
   Os 3 testes vitest com regex "obra" e os 2 erros `EDICAO` (client Prisma) são **pré-existentes**.
7. **Um commit por módulo**, mensagem `design(<modulo>): …`. Não misturar módulos.
8. **Agentes** (em `.claude/agents/`): `agente-ux-ui` (implementa), `agente-responsivo` (breakpoints), `agente-feedback-acessibilidade`
   (formulários/avisos), `agente-visao-minimalista` (hierarquia/densidade), `agente-qa-revisao` (revisa cada módulo antes do Eric).
   `agente-arquitetura-dados` **só** se algo exigir dado novo.
9. **Cota do Figma:** usar `get_design_context` **por tela** só quando necessário; preferir as capturas exportadas (§2).

## 8. Perguntas em aberto para o Eric

| # | Pergunta | Minha sugestão |
|---|---|---|
| **P1** | Paleta e fonte do design novo: continua âmbar/IBM Plex ("Campo") ou muda (ex.: teal/Inter da proposta em `docs/ideias/ideias_design/`)? | Decidir ao receber os tokens do Figma. |
| **P2** | "HIRA → Perigos e Riscos": renomear também **URL** (`/hira` → `/perigos-e-riscos`), arquivos e permissão (`HIRA_GERENCIAR`)? | **Não agora.** Só texto. Renomear URL/arquivos é refatoração grande e sem ganho para o usuário; se quiser, fazemos depois com redirecionamento. |
| **P3** | Os campos de texto "Requisito legal" dentro do HIRA e do LAIA (e o critério que **eleva o nível** da LAIA) ficam? | **Ficam** (são dados da linha, não o módulo). Se quiser tirar, é mudança de banco e de pontuação. |
| **P4** | Sidebar: aprova o desenho do §3 (clique, abas nas sub-visões, link direto para seção de 1 item)? | Sim. |
| **P5** | Aplicar a migração que apaga as tabelas de Requisitos Legais **agora**? | Sim, depois de confirmar que não há dado seu ali (é seed/teste). |

## 9. Andamento (atualizado em 2026-09-30)

**Insumos recebidos:** o Eric exportou o Figma inteiro em SVG para `docs/ideias/ideias_design/Vigen — Sistema (SGI)/` (55 MB, fora do git).
Com isso o bloqueio de cota do §2 deixou de valer: a referência visual passa a ser **essa pasta** (renderizada em PNG quando preciso).
Os textos das telas viraram curvas no SVG, então **textos e medidas exatas** saem dos quadros renderizados e dos estilos de texto do Design System.

**Decisões confirmadas:** paleta **teal** (P1) com **Inter**; migração do banco aplicada (Requisitos Legais removido, tabelas estavam vazias);
campos "requisito legal" do HIRA/LAIA ficam (P3); só os textos do HIRA mudam (P2).

| Fase | Situação | O que foi feito |
|---|---|---|
| 0. Preparação | ✅ | Assets lidos; logos cortados do quadro "Logo e Ícones — Vigen" em `public/marca/`; pasta do Figma no `.gitignore`. |
| 1. Fundação | ✅ | `base.css` reescrito com a paleta teal (primitivos `--cor-primaria-*`, `--cor-neutro-*`, semânticas), tokens de fonte/raio/sombra/badges; **Inter** no lugar de IBM Plex (`layout.tsx`); classe `fonteIbmPlex` → `fonteBase` (55 arquivos); `cartao` com raio 16 + sombra; ícone do app (`src/app/icon.svg`). |
| 2. Casca | 🟡 em andamento | **Login** refeito conforme o Figma (logo principal + frase, chamada, selos ISO, cartão com sombra, aviso de bloqueio; logo escura no celular). **Falta:** sidebar (aguarda as respostas abaixo) e cabeçalho. |
| 3–5 | ⏳ | Componentes, módulos e fechamento, na ordem do §5. |

**Logos em `public/marca/`:** `vigen-logo-principal(.claro).svg` (com "Sistema de Gestão Integrado"; claro = fundo escuro),
`vigen-logo(.claro).svg` (horizontal), `vigen-icone.svg` e `vigen-icone-app.svg` (favicon). As versões `-claro` usam o mesmo
mapeamento de cores da variante oficial "sobre escuro" do Figma (#0F2B34→branco, #4B798F→#90AFBD).

**Sidebar do Figma ("Sidebar atual") × sistema real — pontos para decidir (P6):**
1. O Figma lista **Gestão** (Indicadores, Documentos, Plano de Ação), **Qualidade** (Mapa de Processos, *Ameaças e Oportunidades*, Auditoria),
   **Segurança do Trabalho** (Perigos e Riscos, Acidentes e Incidentes, Auditoria) e **Meio Ambiente** (Aspectos e Impactos). Faltam itens que
   existem no sistema: **RNC, Dashboard, Aprovações, Mensagens, Notificações, SWOT, Inspeções, Treinamentos**.
2. "Ameaças e Oportunidades" é o **Riscos e Oportunidades** renomeado? (ele está em Qualidade no desenho, e hoje está em Gestão.)
3. "Auditoria" aparece **duas vezes** (Qualidade e Segurança). Hoje há um só módulo de Auditorias internas.
4. Documentos e Plano de Ação estão em **Gestão** no desenho; hoje Documentos está em Qualidade.
5. Itens do desenho usam ícones repetidos (provisórios). Precisam dos ícones finais (Casa e usuário já exportados).
