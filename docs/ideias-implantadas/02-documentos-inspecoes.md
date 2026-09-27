# 💡 Rascunho de UX e Negócio: Documentos e Inspeções

**Objetivo:** Transformar a burocracia de ler documentos e preencher checklists de prancheta em uma experiência digital à prova de falhas, focada em mobilidade e controle absoluto para passar em auditorias sem suar a camisa.

---

### 1. "QR Code da Verdade" (Gestão de Documentos)
*Auditorias adoram dar Não Conformidade porque acham um procedimento impresso colado na parede que está obsoleto.*

* **A nossa ideia (Cópia Controlada Dinâmica):** O Vigen não deixa ninguém baixar o PDF "limpo". Sempre que alguém baixa/imprime um POP pelo sistema, o Vigen insere automaticamente uma tarja no cabeçalho com um grande QR Code e os dizeres "CÓPIA CONTROLADA - Impressa por João em 10/10". 
* **O truque:** Se o auditor ou supervisor passar na fábrica, ele aponta o celular para o QR Code do papel na parede. O sistema abre uma página verde dizendo "✅ Este documento é a versão vigente (Rev. 03)" ou vermelha "🔴 CUIDADO: Versão Obsoleta! A Rev. 04 já foi publicada".

---

### 2. Ciência de Leitura com "Micro-Quiz" (Gestão de Documentos)
*A ISO exige evidências de que os funcionários foram treinados nas mudanças dos procedimentos.*

* **A nossa ideia:** Quando o Gestor publica um POP novo, cai uma notificação para a equipe: *"Você tem 1 documento pendente de leitura"*. 
* O pulo do gato não é só o funcionário clicar em "Li e aceito". O Vigen pode gerar (usando IA futuramente) **3 perguntinhas rápidas de múltipla escolha** baseadas no texto. O funcionário só consegue assinar que leu se acertar as 3. Isso garante que a equipe *realmente* entendeu a mudança, e gera um painel para o RH: "80% da equipe já foi capacitada no novo POP".

---

### 3. O "Tinder" dos Checklists (Inspeções de Campo)
*Preencher formulários com dezenas de caixinhas pequenas no celular debaixo de sol (ou com luvas) é péssimo para o inspetor.*

* **A nossa ideia (Interface de Cards/Swipe):** O inspetor abre a Inspeção Diária de Segurança. Em vez de uma lista infinita, aparece um card grande na tela: *"O extintor está desobstruído?"*. 
* Ele arrasta o dedo para a Direita (🟢 Conforme) e o próximo card aparece. 
* Ele arrasta para a Esquerda (🔴 Não Conforme) e o sistema imediatamente abre a câmera: *"Tire uma foto do problema"*. A UX fica rápida, gamificada e impossível de preencher errado.

---

### 4. Relatório de Auditoria em 1-Clique (Auditorias Internas)
*Auditores perdem 3 dias após a auditoria apenas formatando o Word do relatório final.*

* **A nossa ideia:** Como o checklist do auditor já estará vinculado aos itens da ISO (ex: cláusula 7.1.2), quando ele clica em "Encerrar Auditoria", o Vigen compila tudo magicamente em um PDF lindíssimo:
  1. Gráfico Radar de Conformidade por área.
  2. Tabela de todas as Não Conformidades (já integrando para abrir RNCs automaticamente).
  3. Evidências fotográficas organizadas no anexo.

---
**Status:** Aguardando validação do usuário. Se aprovado, desdobraremos em tarefas técnicas pro Claude.
