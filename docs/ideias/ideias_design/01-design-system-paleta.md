# Design System Vigen: Especificação de UI/UX e Paleta de Cores

## 1. Avaliação Crítica da Paleta e Layout B2B

### A Paleta (Teal / Azul-Petróleo)
A paleta sugerida (#0F2B34, #193942, #396276, #6E94A9) é **excelente** para um SaaS corporativo (especialmente para os setores de qualidade, meio ambiente e segurança no trabalho - ISOs).
- **Legibilidade e Contraste (WCAG):** O tom mais escuro (`#0F2B34`) oferece contraste suficiente (acima de 4.5:1, idealmente 7:1) contra texto branco e tons claros de cinza/teal, permitindo o uso como background principal de sidebars ou headers.
- **Psicologia das Cores:** O azul-petróleo transmite confiança, estabilidade, tecnologia e sustentabilidade (o que tem tudo a ver com as normas 14001/45001). 
- **Adequação:** Ela foge do "azul corporativo chato" e do "preto absoluto", dando uma personalidade sofisticada e moderna ao sistema.

### O Layout (Referência AeuxGlobal)
A referência mostra um padrão de **Bento UI** com **Sidebar Fixa**. 
- **O que funciona bem:** A separação visual forte entre a navegação (escura) e a área de trabalho (clara). Cards com bordas arredondadas (aproximadamente `12px` ou `16px`) dão um tom amigável. A estruturação de widgets cria uma leitura em blocos, ideal para dashboards complexos.
- **Adaptação para Vigen:** Substituiremos o tom de verde da referência pelos tons de teal do Vigen. A área principal deve ter um fundo levemente acinzentado (off-white) e os cards devem ser brancos puros, para criar profundidade através de sombras sutis (soft shadows) e borders delicadas.

---

## 2. Paleta Expandida e Cores Semânticas

Vamos expandir a base para uma escala completa (50 a 900), garantindo flexibilidade para estados (hover, active, disabled, borders, backgrounds).

### Escala Primária (Teal/Vigen)
- `--color-primary-50`: `#F0F4F6` (Backgrounds muito sutis)
- `--color-primary-100`: `#D9E3E8` (Hover de linhas ou backgrounds de cards secudários)
- `--color-primary-200`: `#B8CBD4` 
- `--color-primary-300`: `#90AFBD`
- `--color-primary-400`: `#6E94A9` (A cor mais clara enviada, boa para destaques sutis e charts)
- `--color-primary-500`: `#4B798F` (Cor primária padrão para botões e links)
- `--color-primary-600`: `#396276` (Cor original enviada, boa para hover de botões)
- `--color-primary-700`: `#254A59`
- `--color-primary-800`: `#193942` (Cor original enviada, boa para active states)
- `--color-primary-900`: `#0F2B34` (Cor original enviada, principal para a Sidebar e tipografia de alto contraste)

### Escala de Base (Neutros / Cinzas Frios)
- `--color-neutral-50`: `#F8FAFC` (Fundo global da aplicação)
- `--color-neutral-100`: `#F1F5F9` (Bordas leves, separadores)
- `--color-neutral-200`: `#E2E8F0` (Bordas de inputs desabilitados)
- `--color-neutral-300`: `#CBD5E1` (Bordas padrão de inputs)
- `--color-neutral-400`: `#94A3B8` (Placeholder text)
- `--color-neutral-500`: `#64748B` (Texto de apoio, legendas, ícones)
- `--color-neutral-600`: `#475569` (Texto secundário)
- `--color-neutral-700`: `#334155` (Texto primário leve)
- `--color-neutral-800`: `#1E293B` (Texto primário para alto contraste)
- `--color-neutral-900`: `#0F172A` (Títulos pesados)
- `--color-white`: `#FFFFFF` (Cards, modais, painéis)

### Cores Semânticas (Utilitárias)
Para manter a sobriedade, os tons utilitários devem ser um pouco dessaturados.
- **Success (Verde):**
  - Base/Icones: `--color-success-500`: `#10B981`
  - Fundo sutil: `--color-success-50`: `#ECFDF5`
  - Texto escuro: `--color-success-700`: `#047857`
- **Warning (Amarelo/Laranja):**
  - Base/Icones: `--color-warning-500`: `#F59E0B`
  - Fundo sutil: `--color-warning-50`: `#FFFBEB`
  - Texto escuro: `--color-warning-700`: `#B45309`
- **Danger/Error (Vermelho):**
  - Base/Icones: `--color-danger-500`: `#EF4444`
  - Fundo sutil: `--color-danger-50`: `#FEF2F2`
  - Texto escuro: `--color-danger-700`: `#B91C1C`
- **Info (Azul padrão - opcional, pois o primary pode servir):**
  - Base: `--color-info-500`: `#3B82F6`

---

## 3. Especificação CSS (Variáveis para o `:root`)

Aqui estão as variáveis em formato pronto para o Claude implementar nos CSS Modules (`variables.css` ou `global.css`).

```css
:root {
  /* Brand Primary - Teal Scale */
  --color-primary-50: #F0F4F6;
  --color-primary-100: #D9E3E8;
  --color-primary-200: #B8CBD4;
  --color-primary-300: #90AFBD;
  --color-primary-400: #6E94A9;
  --color-primary-500: #4B798F;
  --color-primary-600: #396276;
  --color-primary-700: #254A59;
  --color-primary-800: #193942;
  --color-primary-900: #0F2B34;

  /* Neutrals - Cold Grays */
  --color-neutral-50: #F8FAFC;
  --color-neutral-100: #F1F5F9;
  --color-neutral-200: #E2E8F0;
  --color-neutral-300: #CBD5E1;
  --color-neutral-400: #94A3B8;
  --color-neutral-500: #64748B;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1E293B;
  --color-neutral-900: #0F172A;
  --color-white: #FFFFFF;

  /* Semantic - Success */
  --color-success-50: #ECFDF5;
  --color-success-500: #10B981;
  --color-success-700: #047857;

  /* Semantic - Warning */
  --color-warning-50: #FFFBEB;
  --color-warning-500: #F59E0B;
  --color-warning-700: #B45309;

  /* Semantic - Danger */
  --color-danger-50: #FEF2F2;
  --color-danger-500: #EF4444;
  --color-danger-700: #B91C1C;

  /* Typography */
  --font-family-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-xs: 0.75rem;     /* 12px */
  --font-size-sm: 0.875rem;    /* 14px */
  --font-size-base: 1rem;      /* 16px */
  --font-size-lg: 1.125rem;    /* 18px */
  --font-size-xl: 1.25rem;     /* 20px */
  --font-size-2xl: 1.5rem;     /* 24px */
  --font-size-3xl: 1.875rem;   /* 30px */
  
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1rem;     /* 16px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2rem;     /* 32px */
  --spacing-12: 3rem;    /* 48px */
  --spacing-16: 4rem;    /* 64px */

  /* Radii (Bordas Arredondadas) */
  --radius-sm: 0.25rem;  /* 4px - Inputs, badges */
  --radius-md: 0.5rem;   /* 8px - Botões, dropdowns */
  --radius-lg: 0.75rem;  /* 12px - Cards secundários */
  --radius-xl: 1rem;     /* 16px - Cards principais do dashboard */

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.05), 0 4px 6px -4px rgba(15, 23, 42, 0.05);
  
  /* Layout Component Variables */
  --sidebar-width: 260px;
  --sidebar-bg: var(--color-primary-900);
  --sidebar-text: var(--color-primary-100);
  --sidebar-item-hover: var(--color-primary-800);
  --sidebar-item-active: var(--color-primary-700);

  --body-bg: var(--color-neutral-50);
  --card-bg: var(--color-white);
  --card-border: 1px solid var(--color-neutral-100);
}
```

---

## 4. Tipografia e Espaçamento

- **Fonte:** Recomendo a **Inter** (do Google Fonts), por ser incrivelmente legível em tabelas de dados e dashboards densos. Ela tem um aspecto "neo-grotesco" muito profissional.
- **Espaçamento (Whitespace):** O dashboard deve usar um respiro generoso.
  - Padding interno dos cards (Bento UI): `--spacing-6` (24px) ou no mínimo `--spacing-4` (16px).
  - Gap entre os cards do grid: `--spacing-6` (24px).
  - Títulos de seções devem ter um margin-bottom de `--spacing-4` para não sufocar o conteúdo.

---

## 5. Elementos de Interação (UX)

- **Hover States:** Botões primários (cor `--color-primary-500`) devem ir para `--color-primary-600` no hover. Links na sidebar escuros (`--color-primary-900`) recebem background `--color-primary-800` no hover e ficam com texto totalmente branco.
- **Skeleton Loaders:** Para carregar os dados dos cards do dashboard, use um gradiente suave indo de `--color-neutral-100` para `--color-neutral-200` em loop (animação de pulse ou shimmer).
- **Glassmorphism (Opcional):** Se usar modais, pode-se usar um backdrop de `rgba(15, 23, 42, 0.4)` com `backdrop-filter: blur(4px)`. Fica sofisticado sem ser exagerado.

---

## 6. Prompts para Geração de Mockups no Gemini

Use estes prompts detalhados para gerar visualizações realistas das telas do Vigen. Cada prompt contém o contexto completo do projeto para que a IA entenda exatamente o que desenhar.

---

**Prompt 1 — Dashboard Principal do SGI (Visão do Gestor):**
> "Design a highly detailed, pixel-perfect UI/UX mockup of the main dashboard for 'Vigen', a B2B SaaS platform for Integrated Management Systems (SGI) covering ISO 9001 (Quality), ISO 14001 (Environment), and ISO 45001 (Health & Safety). The system is sold to construction companies, industries, and mining companies in Brazil.
>
> Layout structure: Left sidebar, fixed, 260px wide, background color very dark teal (#0F2B34). The sidebar has the 'Vigen' logo at the top in white, followed by a navigation menu with sleek minimalist icons and labels in light teal (#D9E3E8). Menu items include: Dashboard, RNC (Non-Conformance Reports), Plano de Ação (Action Plans), Processos (Process Map), Riscos (Risk Matrix), SWOT, HIRA, LAIA, Documentos, Inspeções, Auditorias. The active menu item has a slightly lighter teal background (#193942) with a left accent bar in #6E94A9. At the bottom of the sidebar, show a user avatar with name and company. Main content area: light gray background (#F8FAFC), using a Bento UI grid layout with white cards (#FFFFFF) that have soft rounded corners (16px border-radius), very subtle drop shadows, and thin borders (#F1F5F9).
>
> Dashboard content inside the cards: Top row has 3 small KPI cards showing: 'RNCs Abertas: 12' with a tiny red badge, 'Planos no Prazo: 87%' with a green progress bar, 'Próxima Auditoria: 15 dias' with a calendar icon. Middle row has a larger card with a 5x5 Risk Heatmap (Probability x Impact matrix) using colored cells from green (low) to red (critical), with small numbers inside each cell. Next to it, a card showing a donut chart of 'RNCs por Tipo' (Quality, Environment, Safety) using muted teal, slate, and coral tones. Bottom row has a card with a horizontal bar chart showing 'Planos de Ação por Status' (Pendente, Em Andamento, Concluído, Atrasado) using the teal palette. Next to it, a card showing 'Dias Sem Acidentes: 142' in large bold typography with a subtle green background.
>
> Design guidelines: Use Inter font throughout. Typography hierarchy: titles in dark slate (#0F172A) at 24px semibold, card titles in (#334155) at 14px medium, data numbers in (#1E293B) at 30px bold. No neon colors, no extravagant gradients. Keep it corporate, sober, modern, and highly readable. The overall feeling should be like a premium fintech dashboard (think Linear, Vercel, or Stripe) but adapted for industrial compliance. Dribbble quality, 4K resolution, UI design, web application."

---

**Prompt 2 — Tela de Mapa de Processos Interativo:**
> "Design a detailed UI/UX mockup of the 'Process Map' screen for 'Vigen', a B2B SaaS platform for ISO 9001/14001/45001 management. This screen shows an interactive visual map of all company processes organized in swim lanes.
>
> Layout: Same dark teal sidebar (#0F2B34) on the left as described in the main dashboard. Main content area with a canvas-style workspace (like Miro or Figma) on a very light gray background (#F8FAFC). Top bar inside the content area has the page title 'Mapa de Processos' in dark typography, with filter dropdowns ('Por Macroprocesso', 'Com Indicador') and a search bar.
>
> Canvas content: 3 horizontal swim lanes labeled 'Processos de Gestão' (soft purple-teal tint), 'Processos Finalísticos' (soft amber-teal tint), 'Processos de Apoio' (soft neutral tint). Inside each lane, show rectangular process boxes with rounded corners (12px), white background, subtle shadow. Each box shows a process name (e.g., 'Gestão de Contratos', 'Engenharia', 'Produção', 'Logística', 'RH', 'Compras'). Some boxes are grouped inside a dashed border labeled as a 'Macroprocesso'. Between some boxes, show curved directional arrows (in #6E94A9 teal) representing process interactions. One process box is selected with a teal border (#4B798F), and a side panel (split-view, 400px wide) slides in from the right showing process details: Objective, SIPOC data (Suppliers, Inputs, Process, Outputs, Clients), linked procedures/documents with status badges (green 'Vigente', red 'Obsoleto'), and KPI indicators.
>
> Design guidelines: Inter font, clean whitespace, no clutter. The canvas should feel spacious and navigable. Process boxes should look like sticky notes on a digital whiteboard but more refined and corporate. Dribbble quality, 4K resolution, UI design, web application, Bento UI style."

---

**Prompt 3 — Tela de RNC (Não Conformidade) com Kanban de Ações:**
> "Design a detailed UI/UX mockup showing two connected views for 'Vigen', a B2B SaaS platform for ISO compliance management. The screen is split into two panels.
>
> Left side (60% width) is a Kanban Board of Action Plans (5W2H methodology): 3 columns labeled 'Pendente' (with a red dot and count), 'Em Andamento' (yellow dot), 'Concluído' (green dot). Each column contains draggable cards. Each card shows a colored tag indicating origin (e.g., blue tag 'RNC-042', orange tag 'AUD-001'), a brief action description (e.g., 'Trocar mangueira hidráulica'), the responsible person's avatar and name, and a deadline with urgency indicator (e.g., 'Vence Hoje' in red text, 'Feito' in green text). The cards have white backgrounds, 12px rounded corners, and subtle shadows. The overall background is light gray (#F8FAFC).
>
> Right side (40% width) is a RNC Detail Side Panel: A slide-in panel with a white background showing the full detail of 'RNC-042: Vazamento de Óleo'. Sections inside include a Status badge ('Plano em Execução' in teal), a visual Ishikawa/Fishbone diagram (6M: Machine, Method, Manpower, Materials, Environment, Measurement) with filled causes, the linked 5W2H Action Plan items with checkboxes and progress, and an 'Eficácia Verification' section at the bottom. The Ishikawa diagram should be shown as a simplified horizontal fishbone with 6 branches using the teal color palette.
>
> Design guidelines: Dark teal sidebar (#0F2B34) on the left. Inter font. Cards should feel tactile and draggable. Corporate, sober, modern. Dribbble quality, 4K resolution, UI design, web application."

---

**Prompt 4 — Tela de Inspeção de Campo (Checklist Mobile-Friendly):**
> "Design a detailed UI/UX mockup of a field inspection checklist screen for 'Vigen', a B2B SaaS platform for ISO compliance. This screen is designed to be used by safety inspectors on construction sites or factory floors, primarily on tablets and mobile browsers.
>
> Layout is responsive and tablet-first: No sidebar (full-screen mode for field use). A slim top bar with the Vigen logo, inspection title ('Inspeção Diária NR-18 — Unidade Alfa'), progress indicator ('Item 5 de 23'), and a 'Salvar Rascunho' button. The main area shows ONE checklist item at a time in a large card format (card-swipe UX pattern): The question text is large and bold (e.g., 'O extintor de incêndio está desobstruído e sinalizado?'). Below it, two large touch-friendly buttons: a big green button 'Conforme' on the right and a big red button 'Não Conforme' on the left. When 'Não Conforme' is tapped, show an expanded area with a camera capture button (large, with camera icon and text 'Tirar Foto da Evidência'), a text field for 'Descrição do Desvio', and a severity selector (Leve, Grave, Crítico) as large pill buttons. At the bottom, show a horizontal progress bar with dots representing each checklist item, colored green (done-conforme), red (done-não conforme), or gray (pending).
>
> Design guidelines: The color palette uses the same teal system but optimized for outdoor/bright-screen readability: higher contrast, larger touch targets (minimum 48px), chunky buttons. The feeling should be 'industrial tablet app' — robust, fast, zero learning curve. A construction worker wearing gloves should be able to use this. Inter font at larger sizes. Clean, minimal, functional. Dribbble quality, 4K resolution, mobile UI design."

---

**Prompt 5 — Tela de Gestão de Documentos (Lista Mestra + Tramitação):**
> "Design a detailed UI/UX mockup of the 'Document Management' screen for 'Vigen', a B2B SaaS platform for ISO 9001 compliance (clause 7.5 — Documented Information). This is the 'Master List' view where the Quality Manager controls all company procedures, work instructions, and policies.
>
> Layout: Dark teal sidebar (#0F2B34) on the left with navigation. Main content area with a table/list view on light gray background (#F8FAFC). Top section has page title 'Lista Mestra de Documentos', filter bar with dropdowns (Tipo: Procedimento/Instrução/Manual/Formulário, Status: Vigente/Em Revisão/Obsoleto, Área: Qualidade/Segurança/Meio Ambiente), a search bar, and a prominent '+ Novo Documento' button in teal (#4B798F). An alert banner at the top (soft yellow background #FFFBEB with orange icon) says '3 documentos com revisão vencida' with a link to view them.
>
> Table content: Columns are Código (e.g., 'POP-014'), Título, Tipo (with small colored tag), Revisão Atual (e.g., 'Rev. 03'), Status (colored badge: green 'Vigente', yellow 'Em Revisão', red 'Obsoleto'), Próxima Revisão (date), Responsável (avatar + name). One row is expanded/selected, showing a detail panel below it with the document's approval trail (a horizontal stepper showing: Elaboração checked, Revisão checked, Aprovação in progress, Publicação pending), the list of signatories with their status (signed/pending), and a small QR code icon with tooltip 'Verificar cópia impressa'. Another row shows a red dot indicator meaning 'Revisão vencida'.
>
> Design guidelines: Inter font. The table should be clean and scannable with enough whitespace between rows, alternating row backgrounds (white and #F8FAFC). Status badges use the semantic colors defined in the design system. The approval stepper uses teal for completed steps and neutral gray for pending. Corporate, organized, audit-ready feeling. Dribbble quality, 4K resolution, UI design, web application."
