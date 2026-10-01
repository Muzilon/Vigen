# Testes ainda não verificados: janela flutuante e conclusão de ações

**Data:** 01/10/2026
**Origem:** revisão do `agente-qa-revisao` e do `agente-responsivo` (somente leitura) + rodada de testes do Eric no site da Vercel
**Situação geral:** `tsc`, `next build` e `npm test` (230 testes) passam. **Nenhum item abaixo foi confirmado no navegador** — e o Eric relatou que **algumas coisas não funcionaram** nesta rodada (quais ainda precisam ser anotadas, ver seção 4).

Legenda: ⬜ não verificado · ✅ verificado, ok · ❌ verificado, falhou (descrever)

## 1. Janela flutuante (rotas interceptadas)
| # | Teste | Resultado |
|---|---|---|
| 1.1 | Em `/rncs`, abrir uma RNC, trocar de aba (`?aba=plano`) e fechar por X, Esc e clique fora: deve voltar **direto à lista** | ⬜ |
| 1.2 | Abrir `/documentos/novo` e `/treinamentos/matriz` (rotas fixas): **não** pode aparecer janela vazia | ⬜ |
| 1.3 | Recarregar a página com a janela aberta: abre a página inteira do detalhe | ⬜ |
| 1.4 | Digitar na URL um UUID inexistente: aparece "Item não encontrado" **dentro da janela** | ⬜ |
| 1.5 | Provocar erro de servidor no detalhe: aparece "Não foi possível abrir este item" dentro da janela, com a lista intacta | ⬜ |
| 1.6 | Documento aberto da lista mestra → clicar em **Baixar revisão**: abre em **nova aba** e a janela continua; se o servidor responder "Não encontrado", só a nova aba mostra isso | ⬜ |
| 1.7 | Mesmo teste de nova aba para anexos (`/api/anexos/...`) em RNC, Treinamentos e Documentos "Meus" | ⬜ |
| 1.8 | Teclado: foco vai para o X ao abrir, fica preso na janela e volta ao item da lista ao fechar | ⬜ |
| 1.9 | Botão Voltar do navegador com a janela aberta: fecha a janela e mostra a lista | ⬜ |
| 1.10 | As 16 telas abrem em janela: aprovações, auditorias, documentos, HIRA, incidentes, indicadores, inspeções (+ modelos), LAIA, processos, riscos, RNCs, SWOT, treinamentos, plano de ação (item e plano avulso) | ⬜ |
| 1.11 | Trilhas "← Voltar" escondidas na janela em todas as telas (conferir uma a uma, em 390 px) | ⬜ |

## 2. Responsividade (390 / 768 / 1440 px, sem rolagem horizontal da página)
| # | Teste | Resultado |
|---|---|---|
| 2.1 | Documento, HIRA e LAIA dentro da janela: grade vira uma coluna em janela estreita (`@container detalhe`) | ⬜ |
| 2.2 | RNC na janela: `.corpo` em uma coluna e tabela do plano 5W2H em cartões abaixo de 700 px de largura da janela | ⬜ |
| 2.3 | Celular (≤ 640 px): janela ocupa a tela inteira, botão de fechar fixo no topo ao rolar, sem sobreposição com o título | ⬜ |
| 2.4 | iPhone: área segura (`safe-area-inset`) respeitada e sem zoom ao focar campos do painel Concluir (fonte 16 px) | ⬜ |
| 2.5 | Painel Concluir em 390 px: alvos de toque de 44 px; etiqueta "Sem evidência" quebra linha sem estourar a coluna de status | ⬜ |

## 3. Conclusão de ações (qualidade/administração, evidência e justificativa)
Usar os usuários de teste do guia (`docs/00-guia-do-projeto.md`, §11).

| # | Teste | Resultado |
|---|---|---|
| 3.1 | Responsável conclui com cada evidência: só arquivo, só descrição, só link, nenhuma. **Só "nenhuma"** gera a etiqueta e a notificação | ⬜ |
| 3.2 | Qualidade e administração concluem ação de **outra pessoa**; a página do item mostra "concluída por …" | ⬜ |
| 3.3 | Usuário sem `PLANO_GERENCIAR` que não é o responsável tenta concluir (inclusive por URL/ação): negado | ⬜ |
| 3.4 | RNC fora de "Plano em execução" e item de ciclo antigo: não aparece "Concluir" e o serviço nega | ⬜ |
| 3.5 | Data **futura** sem justificativa: erro pedindo justificativa; com justificativa: conclui e mostra "Justificativa da data" | ⬜ |
| 3.6 | Data **anterior a hoje** registrada pela qualidade em item de outra pessoa: exige justificativa; registrada pelo responsável: não exige | ⬜ |
| 3.7 | Excluir o único anexo de uma ação concluída: etiqueta "Sem evidência" volta e a qualidade é avisada | ⬜ |
| 3.8 | Anexar arquivo a uma ação concluída "Sem evidência": a etiqueta some | ⬜ |
| 3.9 | Simular falha no envio dos arquivos ao concluir: o item fica "Sem evidência" e a mensagem avisa a qualidade | ⬜ |
| 3.10 | Em RNC **restrita** ou com dados pessoais, a notificação mostra "Item de ação da RNC …", sem o texto da ação | ⬜ |
| 3.11 | Link de evidência: `javascript:alert(1)`, `ftp://x` e `https://usuario:senha@host` são rejeitados; `https://` válido abre em nova aba | ⬜ |
| 3.12 | Duas conclusões simultâneas na mesma RNC: a segunda recebe o aviso de conflito (sem sobrescrever) | ⬜ |

## 4. Itens que o Eric relatou como "não funcionaram" (preencher)
Anotar aqui, com o número do teste acima ou uma descrição curta, o que falhou na rodada de 01/10/2026:

- _a preencher_

## 5. Outras pendências
- ⬜ **Armazenamento de arquivos na Vercel:** conferir `ARMAZENAMENTO=blob` e `BLOB_READ_WRITE_TOKEN`. Sem isso os arquivos vão para o disco local, que não persiste; foi a hipótese para o "Não encontrado" ao baixar a revisão 0. Também pode ser documento de exemplo do seed sem arquivo.
- ⬜ **Scripts de integração (precisam de banco):** `scripts/teste-fluxo-rnc.ts`, `teste-plano-manual.ts`, `teste-notificacoes.ts`, `teste-anexos.ts` e `npm run test:isolamento`. Ainda não há casos novos para a conclusão pela qualidade, `semEvidencia`, notificação e justificativa de data.
- ⬜ **Documentos:** `documentos/[id]/page.tsx` usa `<UploadAnexo documentoId="id-exemplo" />` com ação simulada (não grava nada) e o envio antigo está comentado em `documento-detalhe.tsx`. Decidir: restaurar o envio antigo ou ligar o novo de verdade.
- ⬜ **Tokens novos no `base.css`** (alvo de toque, sombra e fundo escuro da janela): dependem de aprovação do Eric; hoje as medidas ficaram literais.
- ⬜ **Confirmação ao fechar** a janela com formulário preenchido (Esc e clique fora descartam sem perguntar).
- ⬜ **eslint:** 10 erros e 3 avisos em código de outra origem (`anexarArquivoAction*`, `FormularioEdicaoDocumento.tsx`, `tests/anexar-arquivo-webhook.test.ts`, import sem uso em `documento-detalhe.tsx`).
- ⬜ **Segurança operacional:** a senha do banco do Neon foi colada em conversa mais de uma vez; manter trocada e atualizada na Vercel. Trocar a senha de `vigen123` dos usuários de teste.
