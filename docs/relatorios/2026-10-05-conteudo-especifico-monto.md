# Conteúdo específico da Monto no repositório atual (05/10/2026)

**Para quê:** saber o que **não** pode ser levado ao projeto novo e o que já é genérico, conforme a decisão do Eric de usar conteúdo genérico (seção 11 de `docs/planejamento/08-escopo-premissas-e-ordem.md`).
**Como foi feito:** busca de texto (nome da empresa, domínios de e-mail, termos de sistemas internos, caminhos de arquivo, códigos de documento, imagens) em todo o repositório, sem `node_modules`, `.next` e `.git`. Não foi feita leitura linha a linha: onde diz «a conferir», falta olhar o conteúdo.
**Não é parecer jurídico.**

## Resumo

| Onde | Quantidade | O que é | Risco | Sugestão |
|---|---|---|---|---|
| `scripts/` (20 arquivos) | 169 ocorrências | «Monto» como nome da empresa de teste e usuários `@monto.com.br` | Baixo: dados fictícios, mas usam o nome real do empregador | No projeto novo, usar empresa genérica («Empresa Exemplo») e domínio reservado para exemplos |
| `prisma/seed*.ts` (7 arquivos) | 57 ocorrências | Mesma empresa de teste e seus usuários de exemplo (ex.: `admin@monto.com.br`, `qualidade@monto.com.br`) | Baixo | Mesma sugestão |
| `docs/` (10 arquivos) | 39 ocorrências | Monto como empresa real, contexto do projeto, decisões e fluxos | **Médio**: mistura planejamento do produto com informação da empresa | Não copiar; reescrever o que for útil de forma genérica |
| `public/marca/` | 4 arquivos | Logotipos do **Vigen** (não da Monto) | Nenhum | Pode ser reaproveitado se o nome Vigen for mantido |
| `storage/` | 0 arquivos rastreados | Arquivos gerados pelos testes locais (PDFs, e-mails de teste) | Nenhum: a pasta está no `.gitignore` | Nada a fazer |

## Itens que merecem atenção

1. **Caminhos pessoais em documentos:** `docs/conversa-contexto-01.10.2026.md` e `docs/relatorios/2026-09-30-F6-F7-integracao.md` contêm caminhos de pastas do computador do Eric, com nome de usuário e o nome da empresa na pasta do OneDrive. É dado pessoal e identifica o empregador. **Sugestão:** remover esses trechos antes de qualquer compartilhamento do repositório. Como o Git guarda o histórico, isso só limpa as versões novas.
2. **Nome da empresa como dado de teste:** o seed cria a empresa «Monto» com todos os módulos e usuários com o domínio dela. Não há dado real, mas o nome é real.
3. **Fluxograma de não conformidade da Monto:** a transcrição está **no artefato «Fluxos do Vigen» (aba RNC), não no repositório**. É procedimento interno da Monto. **Sugestão:** não levar ao produto como está; usar apenas as ideias gerais de ISO (reportar, análise prévia, causa raiz, plano, eficácia, fechamento). O artefato é privado; evite compartilhá-lo.
4. **Sistemas internos citados:** as menções a MS Lists e SharePoint em `docs/` vêm do fluxograma da Monto e como exemplo de integração. Como exemplo genérico de integração é aceitável.
5. **Código de documento:** apareceu um código no padrão de documentos de segurança (`PO-SEG-014`). A conferir se é inventado ou da Monto.
6. **Histórico do Git:** apagar um arquivo não apaga o que foi gravado antes. **Sugestão:** o projeto novo começa em um repositório limpo, copiando só conteúdo revisado como genérico, e não clonando o histórico deste.

## O que já está genérico

Estrutura de módulos e regras de ISO, tabelas e permissões, os testes que não dependem do nome da empresa, os logotipos do Vigen, as especificações de `docs/tarefas/04` e `05` (o fluxo do Mapa de Processos foi ditado pelo Eric a partir da necessidade, sem copiar procedimento interno).

## A conferir (precisa de leitura, não só de busca)

- `docs/00-guia-do-projeto.md` e `docs/06-desenho-modulos.md`: trechos que descrevam a operação real da Monto.
- Imagens ou textos de procedimentos dentro dos seeds de documentos, treinamentos e inspeções (`prisma/seed-documentos.ts`, `seed-treinamentos.ts`, `seed-inspecoes.ts`): conferir se os títulos e conteúdos são inventados ou copiados.
