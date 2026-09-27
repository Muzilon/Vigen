# 💡 Rascunho de UX e Negócio: Riscos, HIRA e LAIA

**Objetivo:** Eliminar a dependência de planilhas gigantescas de Excel (planilhas de perigos/riscos e aspectos/impactos) que travam o navegador e são impossíveis de ler, transformando-as em uma experiência fluida, visual e fácil de auditar.

---

### 1. O Paradigma do "Heatmap Vivo" (Riscos ISO 9001)
*O mercado (SoftExpert, Qualyteam) usa o Heatmap apenas como um desenho estático no relatório.*

* **A nossa ideia (Filtro Interativo):** O Heatmap (Matriz 3x3 ou 5x5) fica no topo da tela. Ele não é só uma imagem, é o filtro da página. Se a célula vermelha (Crítico) tem o número "12", ao clicar nela, a lista embaixo filtra na hora para mostrar apenas esses 12 riscos.
* **Toggle Antes / Depois (Inerente vs Residual):** Um botão no estilo "interruptor" em cima do mapa: `[ Risco Inicial ] / [ Risco Residual ]`. Quando o usuário clica, as bolinhas dos riscos "caem" das áreas vermelhas para as áreas verdes (mostrando visualmente para o auditor que os controles da empresa estão funcionando).

---

### 2. A Morte da "Planilha Infinita" (HIRA e LAIA)
*A ISO 45001 e 14001 exigem o mapeamento de tudo. Em construtoras e indústrias, isso gera planilhas com 5.000 linhas, onde o inspetor se perde.*

* **A nossa ideia (Master-Detail UX):** 
  * **Lado Esquerdo da Tela (A Árvore):** Uma lista sanfona estruturada: `Obra 🏗️ > Processo ⚙️ > Atividade 🛠️`. 
  * **Lado Direito da Tela (Os Cards):** Quando ele clica na atividade "Solda de Tubulação", aparecem apenas os Perigos (HIRA) e Aspectos (LAIA) daquela atividade em formato de Cards interativos.
  * *Por que é inovador?* O usuário foca apenas no que está analisando, sem sofrer com scroll horizontal infinito.

---

### 3. Hierarquia de Controles Guiada (Ouro da ISO 45001)
*A norma exige que você tente eliminar o perigo antes de dar um EPI para o funcionário.*

* **A nossa ideia (Funil Visual de Mitigação):** Na hora de cadastrar como a empresa vai tratar um Perigo (HIRA), mostramos um funil clicável:
  1. `[ ] Eliminação` (Consegue remover o perigo?)
  2. `[ ] Substituição` (Consegue trocar o produto químico por um à base de água?)
  3. `[ ] Engenharia` (Consegue colocar um exaustor?)
  4. `[ ] Administrativo` (Vai treinar a equipe?)
  5. `[ ] EPI` (Vai dar máscara?)
* Se o usuário pular direto para "EPI" em um risco Crítico, o sistema pode emitir um *warning* dizendo: "Atenção: A ISO 45001 recomenda buscar controles superiores antes do uso de EPI". **(Auditores piram com isso)**.

---

### 4. "Clone Inteligente" (O diferencial matador para Vendas)
*Empresas com múltiplas unidades, filiais ou fábricas perdem meses refazendo LAIA e HIRA.*

* **A nossa ideia:** Um botão mágico `[ Duplicar Matriz para Nova Unidade ]`. O sistema copia 100% dos Perigos e Aspectos da "Unidade A" para a "Unidade B", colocando tudo com o status "Em Revisão". O gestor da Unidade B só precisa ler e confirmar o que se aplica à realidade dele, reduzindo meses de trabalho para 1 semana.

---
**Status:** Aguardando validação do usuário. Se aprovado, desdobraremos em tarefas técnicas pro Claude.
