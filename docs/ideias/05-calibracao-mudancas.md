# 💡 Rascunho de UX e Negócio: Calibração, Gestão de Mudanças e Cultura

**Objetivo:** Proteger a empresa contra falhas de maquinário, documentar mudanças de estrutura sem perder rastreabilidade e criar um ambiente onde os funcionários queiram prevenir acidentes.

---

### 1. O "Almoxarifado Inteligente" (Calibração ISO 9001 7.1.5)
*Usar um torquímetro ou balança descalibrada condena um lote inteiro de produção e gera Não Conformidade grave.*

* **A nossa ideia:** Toda ferramenta de medição da empresa recebe uma etiqueta de QR Code.
* O Almoxarife do canteiro bipa o equipamento antes de entregá-lo ao funcionário. Se o certificado de calibração no sistema Vigen estiver vencido, a tela pisca vermelho: **"Bloqueado para Uso"**. 
* **Rastreabilidade (Recall):** Se uma máquina for reprovada na calibração, o Vigen abre uma janela perguntando: *"Deseja ver a lista de todos os projetos onde esta ferramenta foi usada no último mês para recall preventivo?"*

---

### 2. O "Efeito Borboleta" (Gestão de Mudanças - MOC)
*Quando a empresa decide trocar uma máquina de lugar na fábrica, ninguém avisa a área de Qualidade e Segurança, tornando as Matrizes de Riscos obsoletas instantaneamente.*

* **A nossa ideia:** Quando alguém abre uma "Solicitação de Mudança" (MOC) no Vigen, o formulário tem o checklist do Efeito Borboleta obrigatório:
  - Afeta a Matriz HIRA (Segurança)? [ Sim / Não ]
  - Afeta a Matriz LAIA (Ambiental)? [ Sim / Não ]
  - Precisa treinar a equipe novamente? [ Sim / Não ]
* Se o usuário marcar "Sim", o sistema imediatamente congela a Matriz de Riscos daquele setor colocando a tag amarela `[ Reavaliação Pendente devido a MOC ]`. Nenhuma mudança de operação passa batida pelo SGI.

---

### 3. Leaderboard de Prevenção (Cultura de Segurança / ESG)
*Operários de campo morrem de medo de reportar "Quase-Acidentes" (Near Miss), porque acham que vão levar bronca da chefia.*

* **A nossa ideia (Gamificação):** Um link público via celular (sem precisar de senha) onde o peão pode enviar uma foto e relatar um "Quase-Acidente" (ex: "Andaime balançando") até de forma anônima.
* O pulo do gato: O Vigen gera o **"Ranking da Prevenção"** no Dashboard principal. *"O Setor de Montagem foi o que mais relatou desvios este mês!"*. A empresa passa a dar prêmios para os setores que mais relatam problemas ANTES deles virarem acidentes. Você transforma uma cultura punitiva em uma cultura engajada e preventiva, o que é o "Santo Graal" das diretorias de ESG.
