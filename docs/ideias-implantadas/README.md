# Ideias implantadas

Rascunhos de `docs/ideias/` que já passaram por implantação (parcial ou total) no código.
Cada arquivo aqui é o rascunho original; este README registra o que foi de fato codificado
e o que ficou pendente.

## 01-riscos-hira-laia.md (2026-09-27)

Contexto importante descoberto na implantação: os módulos de Riscos e Oportunidades, HIRA
e LAIA **já existiam completos** (schema, serviços, páginas, testes) antes deste rascunho —
as ideias aqui eram melhorias de UX sobre módulos prontos, não módulos novos.

**Implementado:**
- **Item 3 (Hierarquia de Controles Guiada):** o formulário de HIRA
  (`src/paginas/html/hira-formulario.tsx`) trocou o `<select>` de hierarquia de controle por
  um funil clicável (`ELIMINAÇÃO → SUBSTITUIÇÃO → ENGENHARIA → ADMINISTRATIVO → EPI`, via
  `HIERARQUIAS` de `src/lib/hira/regras.ts`). Quando o risco inicial é Alto/Crítico e o
  controle escolhido é EPI, aparece um aviso citando a ISO 45001.

**Considerado e não implementado (com justificativa):**
- **Item 1 (Heatmap Vivo / toggle inicial-residual):** a tela de HIRA já mostra os dois
  heatmaps (inicial e residual) lado a lado, com clique em célula filtrando a planilha
  (`src/paginas/html/hira-lista.tsx`). Um toggle animado ("bolinhas caindo") foi avaliado
  como redundante frente a isso — mesmo ganho de comparação, mais complexidade e risco.
  Riscos e Oportunidades (`riscos-lista.tsx`) segue o mesmo padrão.
- **Item 2 (Master-Detail Obra > Processo > Atividade):** não implementado. Hoje HIRA/LAIA
  usam planilha densa filtrável (obra/setor/processo/faixa/status), não árvore sanfona. É uma
  mudança de layout maior (navegação em duas colunas) que merece sua própria rodada, com
  validação de UX antes de mexer nas telas de lista existentes.
- **Item 4 (Clone Inteligente entre unidades):** não implementado. Precisa de uma ação de
  servidor nova (duplicar em lote todas as linhas de uma obra para outra, com status
  "Em Revisão") e uma decisão de UX sobre onde entra o botão. Fica para uma próxima entrega.

## 02-documentos-inspecoes.md (2026-09-27)

**Não implementado nesta rodada** — ficou de fora por escopo/tempo, não por bloqueio técnico.
Nenhum destes quatro itens tem trabalho começado no código:

- **Item 1 (QR Code da Verdade):** precisa de biblioteca de geração de QR (não há
  dependência de QR code instalada no projeto ainda), marca d'água no PDF impresso e uma
  rota pública `/documentos/[id]/verificar` para o QR apontar.
- **Item 2 (Micro-Quiz de leitura):** precisa de schema novo (perguntas por versão de
  documento, respostas do usuário) — mudança de banco, não só de tela.
- **Item 3 (Swipe de inspeções):** precisa de componente de cards com gesto de arrastar e
  integração de câmera; UI substancialmente diferente da planilha atual de
  `src/lib/inspecoes`.
- **Item 4 (Relatório de auditoria em 1-clique):** precisa de geração de PDF (gráfico radar +
  tabela de NCs + anexos) — nenhuma geração de PDF existe hoje no projeto.

## Pendências gerais para a próxima rodada

- docs 03 (RH/Incidentes) e 04 (Alta Direção/Fornecedores) continuam em `docs/ideias/`,
  ainda não abordados.
- Antes de implementar o item 2 de `02-documentos-inspecoes.md`, decidir a fonte das
  perguntas do quiz (manual pelo gestor vs. geração por IA, citada no rascunho como "futuramente").
