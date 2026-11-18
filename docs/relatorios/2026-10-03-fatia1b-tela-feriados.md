# Fatia 1b: tela de feriados em Configurações

## O que foi feito
Nova aba «Feriados» em Configurações (`?aba=feriados`), só para ADMIN_CONFIG (a página já dá 404 sem a permissão; se o serviço recusar, a aba mostra `Alerta` de erro).
- Aviso (`Alerta` amarelo) quando `faltaFeriadoNoAnoCorrente` é verdadeiro: o prazo em dias úteis fica mais curto que o real.
- Formulário «Novo feriado» (data + descrição), lista ordenada por data (dd/mm/aaaa, descrição, etiqueta «Ativo»/«Inativo» com texto), «Editar» (details com o mesmo formulário), «Inativar» (com confirmação) e «Reativar» (inativos).
- Estado vazio com instrução de como cadastrar o primeiro. Carregando: vale o `loading.tsx` do grupo `(app)`.
- Server actions finas (`criarFeriadoAcao`, `editarFeriadoAcao`, `inativarFeriadoAcao`, `reativarFeriadoAcao`) via o wrapper `admin()` existente: só chamam o serviço, devolvem `{ ok }`/`{ erro }` e fazem `revalidatePath`.

## Arquivos
- `src/paginas/html/configuracoes.tsx` (aba `AbaFeriados`)
- `src/paginas/html/feriados-formulario.tsx` (novo, client: campos controlados, erro com `role=alert` e `aria-describedby`, «Salvando…»)
- `src/paginas/css/configuracoes.module.css` (seção 12, só tokens)
- `src/app/(app)/configuracoes/actions.ts`
- `src/paginas/html/componentes/form-acao.tsx` (única mudança em componente compartilhado: prop opcional `textoPendente`, padrão «Aguarde...», sem efeito nos usos atuais)

Serviço, schema e migrações não foram tocados.

## Decisões de design
- Reativar usa `criarFeriado` com a mesma data/descrição (o serviço já reativa data inativa), sem mudar o serviço.
- Lista em vez de tabela (um formulário por linha, melhor no celular); não há rolagem horizontal.
- Digitado preservado em erro (campos controlados); cadastro com sucesso limpa os campos.
- O `base.css` não tem foco global; criei `:focus-visible` nas classes da aba (inclui as abas e botões da página).
- Alvos de 44px por `min-height` na aba.

## Verificação (resultado real)
- `npx tsc --noEmit -p .`: sem erros.
- `npx eslint` nos 4 arquivos TS/TSX alterados: sem avisos.
- `npx vitest run`: 30 arquivos, 247 testes passando.
- Navegador: `next dev` (porta 3111) subiu, login com admin@monto.com.br OK, Chromium via Playwright. Fluxos exercitados: estado vazio com aviso, cadastro, data duplicada (erro e valores mantidos), editar, inativar com confirmação, reativar. Capturas de tela tiradas em 1440, 768 e 390 px; `scrollWidth - clientWidth` = 0 nas três (sem rolagem horizontal). Capturas conferidas: 1440 (vazio e edição) e 390; a de 768 só foi medida (overflow), não foi aberta visualmente.
- Servidor encerrado; tabela `feriado_empresa` do banco local descartável deixada vazia.

## Não verificado / pendências
- Conflito de versão («alterado por outra pessoa») não foi simulado no navegador (depende do serviço, já testado por ele).
- Contraste não medido com ferramenta; só visual e uso dos tokens existentes. O texto do botão primário desabilitado usa opacidade 0,6 do componente Botao.
- Após «Inativar»/«Reativar» a linha muda de tipo e o formulário que mostraria a mensagem de sucesso é desmontado; o feedback é a mudança da etiqueta (Ativo/Inativo) e dos botões. Se quiser mensagem persistente, seria preciso um aviso no nível da aba.
- O campo de data usa `type=date`; o formato exibido segue o idioma do navegador (dd/mm/aaaa em pt-BR). Na lista a data é sempre dd/mm/aaaa.
- O projeto não tem teste de componente; nada novo no vitest para a tela.
