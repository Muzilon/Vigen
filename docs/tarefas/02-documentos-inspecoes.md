# 📝 Tarefa de Desenvolvimento (Aprovada): Documentos e Inspeções

**Para:** Claude Code
**Objetivo:** Implementar UX de alta conversão e validações à prova de falhas na gestão documental e checklists de campo.

---

## 1. Módulo de Documentos (Cópia Controlada e Ciência)
- **Cópia Controlada Dinâmica (QR Code):**
  - Ao gerar ou visualizar a versão em PDF de um documento publicado, injetar programaticamente um cabeçalho/tarja com um QR Code dinâmico.
  - O QR Code deve apontar para uma rota pública/autenticada rápida (`/validar-doc/[id]`) que retorne uma tela semafórica (Verde = VIGENTE, Vermelho = OBSOLETO).
- **Micro-Quiz para Ciência de Leitura:**
  - Na entidade `CienciaDocumento`, adicionar campos para registrar a aprovação.
  - O fluxo de "Li e Aceito" da tela "Meus Documentos" deve ser bloqueado por um formulário de 3 perguntas de validação (cadastradas no ato da publicação do documento).

## 2. Módulo de Inspeções (UX de Campo)
- **UX Swipe/Cards (Mobile):**
  - A tela de execução de Checklist deve abandonar a tabela/grade tradicional em telas `< 768px`.
  - Renderizar uma interface de Cards (um item de checklist por vez em foco).
  - Adicionar botões grandes e suporte a arrastar: Direita = Conforme (Avança), Esquerda = Não Conforme.
- **Captura Instantânea de Evidência:**
  - Se o item for marcado como "Não Conforme", acionar imediatamente um modal para captura de foto via câmera do celular (`<input type="file" capture="environment">`) e descrição do desvio.
