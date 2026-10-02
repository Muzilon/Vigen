# Conversa contexto 01.10.2026

> **Como usar:** cole este arquivo inteiro no início da nova conversa (a fixa, na nuvem). Ele resume tudo o que foi feito, decidido e combinado na conversa de 01/10/2026 (e o que ficou pendente), para o Claude seguir de onde paramos sem perguntar de novo. **Não há segredos aqui** (nem senha, nem URL de banco, nem token); nunca os cole em conversa.
> Escrito para: um Claude novo, sem memória desta conversa, ajudando o Eric a continuar o projeto Vigen.

## 1. Quem é o Eric e como trabalhar com ele

- Dono do projeto e **patrocinador**: decide escopo, prioridade e design. Fala português; **responda sempre em português**, claro e sem jargão.
- Prefere **instruções passo a passo com os comandos exatos** (PowerShell no Windows). Responde decisões em frases curtas.
- Quer **honestidade sobre o que foi verificado**: separe "passou no tsc/build/testes" de "testado no navegador". Nada é "concluído" se depende do teste manual dele.
- Só faça o que foi pedido; **pergunte antes de ações com efeito externo** (push, deploy, criar coisas no ClickUp fora do combinado, apagar).
- Quer que os **agentes do projeto** (`.claude/agents/`) sejam usados conforme `docs/07-plano-implantacao-design.md` §7, e que **commits** sejam feitos por ele pedir ("pode fazer o commit"), um por assunto/módulo.
- Ambiente: Windows 11, **PowerShell 5.1** (sem `&&`; scripts bloqueados → use `npx.cmd`), VS Code, **GitHub Desktop** (o `git` não está no PATH; o do GitHub Desktop fica em `%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`). Mensagens de commit com aspas quebram o PowerShell: grave a mensagem em arquivo e use `git commit -F`.
- Repositório: `C:\Users\eric.machado\OneDrive - GRUPO MONTO\Documentos\GitHub\Vigen`. **Está dentro do OneDrive**, que já corrompeu a pasta `.next` (erros de TypeScript em `.next/dev/types`). Conserto: apagar `.next`, rodar `npx.cmd next typegen`. Recomendação: mover o projeto para fora do OneDrive.

## 2. O projeto

**Vigen**: sistema de gestão integrada (qualidade, meio ambiente e segurança, ISO 9001/14001/45001) para a empresa Monto. Multi-tenant (isolamento por empresa).

- Stack: **Next.js 16.3.6** (diferente do que você conhece: leia `node_modules/next/dist/docs/` antes de codar; `AGENTS.md` manda isso), React 19, Prisma 6.19, Postgres, Auth.js v5 beta (Credentials + JWT), vitest, CSS Modules com tokens em `src/paginas/css/base.css`.
- Estrutura: páginas finas em `src/app/(app)/...` chamam componentes de `src/paginas/html/`; regras em `src/lib/<modulo>/`; `getAtor()`/`getDb()` dão o cliente do tenant (nunca use `prismaAdmin` fora de seed, cron e login).
- Módulos: RNC, Plano de Ação, Mapa de Processos, Riscos e Oportunidades, SWOT, HIRA (Perigos e Riscos), LAIA, Inspeções, Auditorias, Documentos, Incidentes, Indicadores, Treinamentos, Aprovações, Notificações, Mensagens, Dashboard, Configurações. (Requisitos Legais foi removido numa migration.)
- Documentos-chave: `docs/00-guia-do-projeto.md` (guia e usuários de teste, §11), `docs/06-desenho-modulos.md`, `docs/07-plano-implantacao-design.md` (plano do design, regras §7), `docs/05-guia-paginas-css.md`, `docs/planejamento/` (PMO), `docs/relatorios/`.

### Produção
- Site: **vigen.vercel.app** (projeto Vercel `vigen`, plano Hobby), funções em **São Paulo** (`regions: ["gru1"]` no `vercel.json`).
- Banco: **Postgres no Neon** (sa-east-1). Duas variáveis: `DATABASE_URL` (com pooler, usada pelo site) e `DIRECT_URL` (conexão direta, sem `-pooler`, usada só em migrations).
- Variáveis na Vercel: `AUTH_SECRET`, `DATABASE_URL`, `APP_URL`, `CRON_SECRET`, `EMAIL_*`, e (**pendente**) `ARMAZENAMENTO=blob` + `BLOB_READ_WRITE_TOKEN`.
- **Migrations não rodam no build da Vercel.** Para aplicar: no PowerShell da pasta do projeto, defina `$env:DATABASE_URL` e `$env:DIRECT_URL` (URL direta, entre aspas, sem `&channel_binding=require`), rode `npx.cmd prisma migrate deploy`, depois `Remove-Item Env:DATABASE_URL` e `Env:DIRECT_URL`. O schema exige as duas variáveis.
- Usuários de teste (do seed, `prisma/seed.ts`): `admin@monto.com.br` e outros, todos com a senha pública do guia §11. **O Eric troca essas senhas direto no Neon** (tarefa TR-016).
- A senha do banco do Neon já foi colada em conversa duas vezes e **já foi trocada**; mantenha atualizada na Vercel. Nunca peça nem repita a URL do banco.
- O conector da Vercel desta conta deu 403 (escopo `eric-4ff7`): não deu para ler logs/deploys pelo Claude; peça ao Eric o texto do log do painel.

## 3. O que foi feito em 01/10/2026

1. **Login quebrado → resolvido.** Causa: `AUTH_SECRET` ausente na Vercel (Auth.js `MissingSecret`). Depois, builds falhavam por erros de tipo: corrigidos (rótulo `EDICAO`, `prisma` → `prismaAdmin`, campo `versao` inexistente no histórico, specs `*.a11y.spec.ts` fora do `tsconfig` porque dependem de Playwright/axe não instalados). Migration `20260930000000_documentos_acao_edicao`. Banco Neon criado e populado com o seed.
2. **Desempenho:** funções em gru1, `loading.tsx` (esqueleto) na área logada, `carregarDadosSessao` com `cache()` (1 leitura de sessão por requisição), fuso horário da empresa vindo da sessão (`ator.fuso`), sem consulta extra por página.
3. **Janela flutuante** (`<dialog>` + rotas interceptadas `@modal/(.)[id]`) em **16 telas de detalhe** (aprovações, auditorias, documentos, HIRA, incidentes, indicadores, inspeções e modelos, LAIA, processos, riscos, RNCs, SWOT, treinamentos, plano de ação item e plano avulso). Peças: `janela-flutuante.tsx`, `janela-rota.tsx`, `janela-erro.tsx` + CSS. Comportamento: fecha por X/Esc/clique fora voltando à lista; links `/api/...` e `.../conteudo` abrem em nova aba; troca de aba usa `replace`; erro e "não encontrado" aparecem dentro da janela; tela cheia no celular; telas de detalhe usam `@container detalhe`.
4. **Conclusão de ações:** concluem o responsável **e** quem tem `PLANO_GERENCIAR` (qualidade/administração); evidência = anexo, descrição e/ou link de pasta (todas opcionais); sem nenhuma, o item fica **"Sem evidência"** (etiqueta + notificação `ITEM_CONCLUIDO_SEM_EVIDENCIA` para a qualidade com acesso, exceto quem concluiu); etiqueta **recalculada** quando anexos entram/saem ou o envio falha; **justificativa de data** obrigatória se a data é futura, ou anterior a hoje e quem conclui não é o responsável; link só `http(s)` sem usuário/senha; guarda `concluidoPorId`. Item de RNC só conclui com a RNC em "Plano em execução" e no ciclo atual. Migrations: `20260930100000_item_acao_conclusao_sem_evidencia`, `20260930200000_item_acao_justificativa_data` (**ambas aplicadas no Neon**; atenção: existe outra migration com o prefixo `20260930100000`, a `remove_requisitos_legais`; não renomeie, já aplicada).
5. **"Concluído fora do prazo"** (laranja, cores de gravidade alta): só exibição; o status continua CONCLUIDO (indicadores e filtros inalterados). **Decisão D-17:** conta como ação concluída, com a segunda informação "dentro/fora do prazo" para medir o atendimento ao prazo; **sem notificação**; precisa estar catalogada (a data de conclusão já fica gravada). O indicador automático "Itens atrasados" (complemento = atendimento ao prazo) tinha um erro de fuso que contava conclusão com 1 dia de atraso como no prazo: **corrigido** (`src/lib/indicadores/automaticos.ts`).
6. **Download:** links de baixar têm `target="_blank"`; rotas `/api/anexos/...` e `/api/documentos/versoes/.../pdf-controlado` devolvem página HTML legível no 404 (antes, texto cru que aparecia como tela preta).
7. **Agentes e PMO:** revisões somente leitura dos agentes `agente-qa-revisao` e `agente-responsivo`; CSS responsivo pelo `agente-ux-ui`; criado o **`agente-pmo`** (`.claude/agents/agente-pmo.md`), que montou `docs/planejamento/` e a estrutura no ClickUp.
8. Verificação: `tsc`, `next build`, eslint nos arquivos novos e **231 testes vitest** passam. eslint global tem 10 erros e 3 avisos **antigos**, em código de outra origem (`anexarArquivoAction*`, `FormularioEdicaoDocumento.tsx`, `tests/anexar-arquivo-webhook.test.ts`, import sem uso em `documento-detalhe.tsx`).

## 4. Falhas relatadas pelo Eric (rodada de teste de 01/10) e situação

| # | Falha | Situação |
|---|---|---|
| 1 | Etiqueta/aviso de "concluído sem evidência" falhou | Lacuna encontrada e corrigida (etiqueta não aparecia na aba Resumo da RNC nem nas listas de ações de HIRA, LAIA, risco e incidente; as consultas não traziam o campo). **Causa raiz não confirmada.** Perguntar ao Eric: onde esperava ver (etiqueta ao lado do status ou sino de notificações?). Lembrar: o aviso não vai para quem concluiu. Tarefa TR-013. |
| 2 | Quer status "Concluído fora do prazo" laranja | Feito (item 5 acima). TR-014. |
| 3 | Na janela de Documento, baixar leva à tela preta e o Voltar cai no detalhe | Correções de código feitas (item 6). **Causa de fundo:** o arquivo da revisão não é encontrado no armazenamento; sem `ARMAZENAMENTO=blob` + token do Blob na Vercel os arquivos vão para disco local, que não persiste (ou o documento de exemplo do seed não tem arquivo). **BE-001 (Eric)** destrava. BE-013 depende dela. |

Nada disso está confirmado no navegador. A lista oficial de testes está em `docs/relatorios/2026-10-01-testes-nao-verificados.md` (seção 4 vazia: o Eric ainda deve anotar o que falhou além dos 3 acima).

## 5. Decisões do Eric (registradas em `docs/planejamento/04-riscos-e-decisoes.md`)

- **D-01** plano mestre **aprovado** (v0.2), com o fluxo de design abaixo. **D-02** senhas: o Eric cuida direto no Neon. **D-03** ClickUp: **Opção A** (espaço próprio "Vigen"). **D-11** concorda: estabilizar (M1) antes do redesign. **D-12** prazos **com muita folga**; o Eric ajusta as datas e o PMO acompanha. **D-14** o **sidebar atual não agrada: será redesenhado e é a prioridade** (P1 a P4 do doc. 07 seguem respondidas: teal/Inter, HIRA só no texto, campos de requisito legal ficam). **D-15** o que falta do design será tratado junto com todas as telas, numa verificação do Eric que também testa funcionalidades. **D-17** ver item 5.
- **Fluxo de design (importante):** o Eric revisa o design **no sistema, tela por tela**, anota tudo; se precisar, altera no **Figma**, exporta e pede para implantar. Pode haver **funções novas** junto. Regra: **uma tarefa por tela, agrupada por módulo** (58 telas em 16 módulos), com ciclo de 4 etapas: (1) revisão do Eric, (2) Figma/exportação, (3) implantação, (4) verificação do Eric (visual + funcionalidades + 390/768/1440 px).
- **BE-001 (armazenamento Blob) é prioritária e do Eric**: ele faz quando tiver tempo; o projeto segue em paralelo.
- Abertas: D-04 a D-10, D-13 e **D-16** (quando o Eric exporta o desenho do sidebar do Figma; destrava FE-014). Informações que faltam: horas por semana do Eric, quem mais testa, se há dados reais em produção.

## 6. Agentes (`.claude/agents/`)

Use-os conforme o doc. 07 §7: `agente-ux-ui` (implementa telas), `agente-responsivo`, `agente-feedback-acessibilidade`, `agente-visao-minimalista`, `agente-qa-revisao` (revisa antes do Eric; não implementa), `agente-arquitetura-dados` e `agente-integridade-dados` (só se algo exigir dado novo), agentes de módulo (`documentos`, `nao-conformidades`, `auditorias-processos`, `riscos-hira-laia`, `indicadores-sgi`, `treinamentos`, `inspecoes-incidentes`, `notificacoes`, `minha-fila`, `autenticacao-acesso`, `busca-global`), `agente-pesquisa`, `agente-painel-auditoria` (futuro, só com ordem do Eric) e **`agente-pmo`**.
- Regras do design (doc. 07 §7): só apresentação, **só tokens do `base.css`** (sem cor/medida solta; tokens novos dependem do Eric), comentários em português (reescreva ao mudar o trecho), reaproveitar componentes, **um commit por módulo** com mensagem `design(<modulo>): …`, verificação por módulo (`npx.cmd tsc --noEmit`, eslint, `npm test`, `npm run test:<modulo>`, abrir a tela).
- Na prática, subagentes às vezes **não têm Bash** (relatam que não rodam `tsc`/testes): rode você mesmo a verificação. O `agente-pmo` só grava em `docs/planejamento/` e `docs/relatorios/`.

## 7. Planejamento (PMO) e ClickUp

- Documentos em `docs/planejamento/`: `00-base-de-conhecimento-pmo.md`, `01-plano-mestre.md` (marcos M0 a M6, IDs `FE-`/`BE-`/`TR-`), `04-riscos-e-decisoes.md` (21 riscos, decisões), `06-inventario-telas-e-lote-clickup.md` (58 telas e o lote do ClickUp, com **tabela ID → tarefa**). Os planos detalhados `02-plano-frontend.md` e `03-plano-backend.md` **ainda não foram escritos** (próxima rodada do PMO). A recomendação do PMO: **estabilizar a produção e testar no navegador (M1) antes de seguir o redesign**.
- **ClickUp:** workspace `9013448793` (o Eric reautorizou o conector; agora ele só enxerga esse workspace, não mais o dos espaços "Indicadores do SGI"/"Sharepoint SGI"). Espaço **Vigen** (id `901314639679`), pasta "Projeto Vigen 2026" (`901319555693`), listas: 01 Front-end (novo design) `901329199268`, 02 Back-end e produção `901329199269`, 03 Transversal e testes `901329199270`, 04 Backlog de ideias `901329199271` (vazia), "Decisões do Eric" `901329199272`. **Não toque** no "Team Space"/"Projeto Recipe" (não é do Vigen). Nunca apagar nada.
- Status do espaço não são personalizáveis; mapeamento: Backlog = *planning*, Pronto para fazer = *to do*, Em andamento = *in progress*, Em revisão = *update required*, Bloqueado = *on hold*, Concluído = *complete*. Nenhuma tarefa nasce concluída; TR-013, TR-014, BE-013 e BE-002 estão "Em revisão".
- **Já criado:** estrutura; 9 decisões; TR-001 a 006, 008 a 010, 013, 014, 016; BE-001 (urgente, Eric), BE-002 a 004, BE-013, BE-014 e uma tarefa agregada BE-005 a BE-012; FE-014 (sidebar, primeira, prioridade alta, 31/01/2027 provisória), FE-001 a 005, 012, 013; mães de design FE-020 a FE-023; 10 dependências.
- **Falta criar:** mães FE-024 a FE-035 (12); as 58 subtarefas de tela (sem data, checklist de 4 etapas); dependência FE-001 → FE-014; atribuir TR-016 ao Eric; tags `bloqueado`, `m3`, `m4`. Perguntar ao Eric: entram **TR-007 e TR-011**, que estão no plano mestre mas não no lote?
- **Limite do conector do ClickUp: 100 chamadas por dia** (risco R-21). O lote completo precisa de pelo menos mais um dia ou de um plano maior. Antes de criar, o PMO deve conferir o mapeamento (seção 6 do doc. 06) para **não duplicar**.
- Datas são **provisórias e folgadas**: M1 em 31/12/2026, sidebar em 31/01/2027, casca em 28/02/2027, módulos de 30/04/2027 a 30/11/2027, fechamento em 31/12/2027. O Eric ajusta; o PMO confere.

## 8. Estado do git (conferir)

Foram feitos vários commits locais hoje (janela flutuante, conclusão de ações, correções, planejamento, indicador). **Conferir no GitHub Desktop se o "Push origin" foi feito**: o deploy da Vercel só tem o que foi enviado. Sem push, o Eric vê comportamento antigo (foi o que pareceu acontecer com o download na janela).

## 9. Próximos passos (ordem sugerida)

1. **Push** (se pendente) e esperar o deploy ficar **Ready**; retestar no navegador: etiqueta "Sem evidência", "Concluído fora do prazo", download na janela de Documento, fechar a janela voltando à lista. Preencher a seção 4 de `docs/relatorios/2026-10-01-testes-nao-verificados.md`.
2. **Eric: BE-001** (Blob na Vercel: criar o Blob store, ligar ao projeto, definir `ARMAZENAMENTO=blob` e `BLOB_READ_WRITE_TOKEN`, redeploy, testar baixar uma revisão).
3. **PMO:** concluir o lote do ClickUp quando o limite diário zerar; escrever os planos 02 (front) e 03 (back); acompanhar semanalmente.
4. **Sidebar (FE-014):** aguardar o Eric exportar o desenho do Figma (D-16) e implantar com `agente-ux-ui` (+ responsivo, QA).
5. Scripts de integração (precisam de banco) sem casos para as regras novas: `teste-fluxo-rnc`, `teste-plano-manual`, `teste-notificacoes`, `teste-anexos`, `test:isolamento`.
6. Pendências menores: `UploadAnexo` de exemplo em Documentos (ação simulada, não grava; envio antigo comentado em `documento-detalhe.tsx`) → decidir restaurar ou ligar o novo; confirmação ao fechar a janela com formulário preenchido; tokens novos no `base.css` (precisam de aprovação); contraste de tons claros da paleta (R-09); e-mail real (`EMAIL_DRIVER`), backup do Postgres, expurgo de anexos; mover o projeto para fora do OneDrive.
