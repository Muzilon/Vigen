# Relatório de Correção: Webhook Google Drive (F7)

**Data:** 2026-09-30  
**Responsável:** agente-arquitetura-dados  
**Arquivo Modificado:** `src/components/anexos/upload/anexarArquivoAction.ts`

## 1. Contexto e Motivação
O Webhook implementado em Google Apps Script para o Google Drive espera receber os parâmetros via codificação de formulário (`application/x-www-form-urlencoded`), acessíveis diretamente via `e.parameter`. A implementação anterior enviava o corpo em `application/json` e token via cabeçalho `Authorization`, o que impedia o processamento correto pelo Apps Script.
Além disso, na eventualidade de erro retornado pelo webhook (`{ error: ... }`), a action realizava um fallback silencioso gerando um `mock-id`, reportando falso sucesso.

## 2. Alterações Realizadas
1. **Cabeçalho Content-Type**:
   - Alterado de `'application/json'` para `'application/x-www-form-urlencoded'`.
2. **Corpo da Requisição**:
   - Alterado para `new URLSearchParams({ token: webhookToken, fileName: fileName, mimeType: 'application/pdf', fileData: base64Data }).toString()`.
3. **Tratamento de Erros e Eliminação de Mock-ID Silencioso**:
   - Tratamento explícito para `data.error`: retorna imediatamente `{ success: false, error: ... }`.
   - Validação de presença do `data.fileId`: falha explicitamente se ausente, impedindo a geração de `mock-id` e garantindo integridade de dados (Regra não negociável: nunca sobrescrever ou criar estado em silêncio).
4. **Sincronização**:
   - Atualizado também o arquivo de trabalho em `scratch/F7-anexarArquivoAction.ts` e suas respectivas suítes de teste.

## 3. Validação e Testes
* Suíte de testes criada em `tests/anexar-arquivo-webhook.test.ts` e atualizada em `src/components/anexos/upload/anexarArquivoAction.spec.ts`.
* Casos cobertos:
  - Envio correto dos parâmetros urlencoded e headers via `URLSearchParams`.
  - Interrupção e retorno com erro quando webhook devolve `{ error: ... }`, sem criação de mock-id.
  - Interrupção com erro quando webhook não retorna `fileId`.
* Execução dos testes via Vitest concluída com sucesso: `3 passed (3)`.
