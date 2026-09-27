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
**Implementado (2026-09-27, terceira rodada):**
- **Item 2 (Master-Detail Obra > Processo > Atividade):** link "Ver em árvore" na lista de
  HIRA (`?vista=arvore`) abre `HiraArvore` (`src/paginas/html/hira-arvore.tsx`) — árvore sanfona
  Obra > Processo > Atividade à esquerda, cards de perigo (perigo/risco/nível/hierarquia) à
  direita para a atividade selecionada. **Decisão de design:** não substitui a planilha densa
  (continua sendo a visão padrão) — é uma visão alternativa, com toggle, para reduzir o risco de
  quebrar a tela existente. LAIA ainda não tem o equivalente (mesmo padrão de dados,
  reaproveitável).
**Implementado (2026-09-27, segunda rodada):**
- **Item 4 (Clone Inteligente entre unidades):** botão "Duplicar matriz para nova unidade" na
  lista de HIRA (só aparece com mais de uma obra cadastrada). `clonarHiraParaObra`
  (`src/lib/hira/servico.ts`) reaproveita `incluirHira` linha a linha: copia todas as linhas
  vigentes da obra origem para a obra destino, preservando perigo/risco/P×S/controles, zerando
  o responsável (o time da obra destino costuma ser outro) e recalculando o nível pela escala
  da obra destino. **Decisão de design:** não criamos um status "Em Revisão" novo — cada cópia
  passa pela mesma política de aprovação já configurada para HIRA na empresa (nasce
  `PENDENTE_APROVACAO` se a empresa exigir aprovação, `VIGENTE` senão), em vez de abrir uma
  exceção só para o clone. Isso cobre a intenção do rascunho ("gestor da Unidade B só precisa
  ler e confirmar") sem inventar um enum/fluxo paralelo. LAIA e Riscos e Oportunidades ainda
  não têm o botão equivalente — o padrão está pronto para replicar.

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
