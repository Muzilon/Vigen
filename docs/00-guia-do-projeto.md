# Vigen — Guia completo do projeto

> **Para quem é este documento:** para quem vai **escrever código** no Vigen a partir de agora (o agente Antigravity) e para
> qualquer pessoa que precise entender o sistema de ponta a ponta. Leia inteiro antes da primeira alteração.
>
> **Última atualização:** 2026-09-27. Estado do código descrito aqui = branch `main` + alterações de Treinamentos ainda não
> commitadas (ver §12).

---

## Sumário

1. [O que é o Vigen](#1-o-que-é-o-vigen)
2. [Divisão de trabalho e fonte da verdade](#2-divisão-de-trabalho-e-fonte-da-verdade)
3. [Stack, ambiente e como rodar](#3-stack-ambiente-e-como-rodar)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Arquitetura transversal (regras que valem para tudo)](#5-arquitetura-transversal)
6. [Motores compartilhados](#6-motores-compartilhados)
7. [Receita: como construir/alterar uma funcionalidade](#7-receita-como-construir-uma-funcionalidade)
8. [Os módulos, um a um (o que são e como se preenche)](#8-os-módulos)
9. [Como tudo se integra](#9-como-tudo-se-integra)
10. [UI, design e CSS](#10-ui-design-e-css)
11. [Testes, seed e usuários de teste](#11-testes-seed-e-usuários-de-teste)
12. [Armadilhas conhecidas e pendências](#12-armadilhas-conhecidas-e-pendências)
13. [Mapa de documentos do repositório](#13-mapa-de-documentos)

---

## 1. O que é o Vigen

**Vigen** é um SaaS B2B de **Sistema de Gestão Integrado (SGI)**: um só sistema para as três normas ISO de gestão:

| Norma | Tema | Exemplos no Vigen |
|---|---|---|
| **ISO 9001** | Qualidade | RNC, mapa de processos, riscos e oportunidades, documentos, auditorias, indicadores, treinamentos |
| **ISO 14001** | Meio ambiente | LAIA (aspectos e impactos) |
| **ISO 45001** | Saúde e segurança do trabalho (SSO) | HIRA (perigos e riscos), incidentes/acidentes, inspeções de segurança, NRs |

**Clientes-alvo:** construtoras, indústrias e mineradoras no Brasil. Isso define o produto:
- trabalho distribuído em **obras/unidades** (canteiros, fábricas), com gente de campo usando celular;
- vocabulário e legislação brasileiros (NRs, CONAMA, eSocial, CAT, LGPD);
- auditoria de certificação: **tudo precisa deixar evidência rastreável** (quem, quando, o quê, versão).

**Proposta de valor:** substituir planilhas e papéis por fluxos que (1) se conectam — uma NC encontrada numa inspeção vira RNC,
que vira plano de ação, que é verificado —, (2) avisam sozinhos o que está vencendo e (3) geram evidência pronta para o auditor.

**Modelo comercial:** multiempresa (multi-tenant). Cada empresa contrata **módulos** (`Empresa.modulosAtivos`); RNC e Plano de
Ação são a base e estão sempre ligados.

> Na UI a palavra "Obra" foi trocada por **"Unidade"** (commit d5928d2). No código e no banco o nome continua `obra`/`ObraUnidade`.
> Mantenha assim: **código = obra, texto visível = unidade.**

---

## 2. Divisão de trabalho e fonte da verdade

| Quem | Papel |
|---|---|
| **Eric (dono do produto)** | Decide prioridades e aprova ideias. |
| **Claude** | Estratégia de produto, regras de negócio e design (UX/UI). Escreve ideias e especificações. |
| **Antigravity** | Implementação: schema, serviços, telas, testes, migrações. |

**Fluxo:**
1. Ideias/rascunhos → `docs/ideias/` (**não implementar** sem ordem explícita).
2. Ideia aprovada → vira tarefa técnica em `docs/tarefas/` (ou pedido direto do Eric).
3. Antigravity implementa, roda os testes e registra a entrega em `docs/06-desenho-modulos.md` (seção "Pxx — ... entregue").
4. Rascunho implantado → nota em `docs/ideias-implantadas/README.md` (o que entrou e o que ficou de fora, com justificativa).

**Hierarquia de verdade quando houver conflito:** código + migrações > `docs/06-desenho-modulos.md` (decisões registradas) >
este guia > `docs/tarefas/` > `docs/ideias/`.

**Regras de ouro para quem codifica:**
- Não mude uma **decisão registrada** (marcada como "Decisão" no doc 06) sem perguntar.
- Não quebre o isolamento entre empresas (§5.1) nem a LGPD (§5.9). Nunca.
- Toda funcionalidade nova vem com **teste** e **seed** (§11).
- Next.js aqui é a **versão 16**, com mudanças incompatíveis. Antes de usar uma API do Next, leia o guia em
  `node_modules/next/dist/docs/` (instrução do `AGENTS.md`). Exemplo: `middleware` virou `src/proxy.ts`.

---

## 3. Stack, ambiente e como rodar

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16.3** (App Router, Server Components, Server Actions), React 19.2 |
| Linguagem | TypeScript estrito |
| Banco | **PostgreSQL 16** via **Prisma 6.19** |
| Auth | **Auth.js v5** (next-auth beta), Credentials + JWT |
| Validação | **zod 4** |
| Arquivos | Vercel Blob (produção) / disco local em `storage/` (dev) |
| E-mail | nodemailer (SMTP) / Resend / arquivo `.eml` (dev) / console |
| PDF / QR | pdf-lib, qrcode |
| Testes | vitest (regras puras) + scripts `tsx` de integração contra o banco |
| Deploy alvo | Vercel (crons em `vercel.json`) |

**Rodar localmente (Windows é o ambiente do dono):**
```bash
npm install
npx prisma generate          # npm 11 bloqueia install scripts — sempre gere o client à mão
npx prisma migrate deploy    # aplica as migrações
npm run db:seed              # popula (só cria dados onde está vazio)
npm run dev                  # http://localhost:3000
```
- `.env` a partir de `.env.example`: `DATABASE_URL` (padrão `postgresql://vigen:vigen@localhost:5432/vigen`), `AUTH_SECRET`,
  `APP_URL`, `EMAIL_DRIVER`, `CRON_SECRET` (obrigatório para os crons).
- **Login de teste:** senha `vigen123` para todos (lista em §11).
- Crons: `GET /api/cron/diario` (09:00) e `/api/cron/semanal` (seg 11:00), com o header `Authorization: Bearer <CRON_SECRET>`.

---

## 4. Estrutura de pastas

```
prisma/
  schema.prisma              # ~62 modelos; TODA tabela de negócio tem empresaId
  migrations/<data>_<nome>/  # SQL gerado + "Regras SQL" manuais no fim (CHECKs, triggers)
  seed.ts                    # empresas, usuários, perfis e chamada dos seeds por módulo
  seed-<modulo>.ts           # seed de cada módulo, feito PELO SERVIÇO (não por insert cru)
scripts/
  teste-<modulo>.ts          # testes de integração (npm run test:<modulo>) contra o banco local
  pdf-exemplo.ts, util-teste.ts
tests/
  <modulo>.test.ts           # vitest: funções puras (regras)
src/
  auth.ts, auth.config.ts    # Auth.js (JWT, tokenVersao, bloqueio de login)
  proxy.ts                   # "middleware" do Next 16: exige login (checagem otimista)
  app/
    login/                   # tela de login
    validar-doc/             # validação pública de cópia controlada (QR)
    api/
      anexos/[id]/route.ts   # download autenticado de anexos
      auth/[...nextauth]/
      cron/diario, cron/semanal
      documentos/versoes/[versaoId]/pdf-controlado/
    (app)/                   # área logada (layout com menu)
      layout.tsx             # menu lateral: itens fixos + REGISTRO_ITENS_MENU
      acoes-comuns.ts        # executar(), validadores zod compartilhados
      <modulo>/page.tsx      # CASCAS FINAS: só renderizam o componente de src/paginas/html
      <modulo>/actions.ts    # SERVER ACTIONS ("use server"): validam FormData com zod e chamam o serviço
      <modulo>/[id]/page.tsx, novo/page.tsx, ...
  lib/                       # DOMÍNIO (sem React). Um diretório por módulo:
    <modulo>/regras.ts       #   funções PURAS (cálculos, máquinas de estado) — testadas no vitest
    <modulo>/acesso.ts       #   gating do módulo + checagens de permissão
    <modulo>/servico.ts      #   leitura/escrita no banco via Ator (transações, histórico)
    <modulo>/reavaliacao.ts  #   fonte de alertas do cron (quando o módulo tem vencimentos)
    <modulo>/aprovacao.ts    #   handler do motor de aprovação (quando o módulo usa aprovação)
    ator.ts, ator-servidor.ts, tenant.ts, db-tenant.ts, permissoes.ts, modulos.ts, menu-registro.ts,
    erros.ts, datas.ts, escopo-obras.ts, filtros-url.ts, prisma.ts
    anexos/ aprovacao/ armazenamento/ cron/ email/ escala/ interacoes/ notificacoes/ plano-acao/ reavaliacao/
  paginas/
    html/<pagina>.tsx        # componente da página (server component; client quando precisa)
    html/componentes/        # componentes compartilhados (badge, cartao, form-acao, heatmap, anexos...)
    css/<pagina>.module.css  # CSS Module com o MESMO nome da página
    css/base.css             # tokens de design (cores, fontes, espaços, raios, z-index)
  components/                # sobra histórica (atualizar-contadores.tsx); prefira paginas/html/componentes
  types/next-auth.d.ts
docs/                        # ver §13
storage/                     # arquivos e e-mails locais (dev), fora do git
```

**Camadas (dependência só de cima para baixo):**
```
page.tsx (casca) → paginas/html/<pagina>.tsx → lib/<modulo>/servico.ts → lib/<modulo>/regras.ts
                    └ usa actions.ts (server actions) ┘            └ Prisma via Ator (db-tenant)
```
- **Regras puras** não importam Prisma client nem Next. Só tipos.
- **Serviços** recebem um `Ator` (§5.2): não usam `getContexto()`, `cookies()` etc. Isso permite chamá-los em testes e seeds.
- **Actions** fazem só parsing/validação de formulário, chamam o serviço dentro de `executar()` e revalidam caminhos.

---

## 5. Arquitetura transversal

### 5.1 Multi-tenant (isolamento por empresa) — duas camadas, **inegociável**
1. **Banco:** toda tabela de negócio tem `empresa_id`, e as FKs são **compostas** `(empresa_id, id)`. O Postgres recusa uma
   referência a um registro de outra empresa. Todo modelo novo precisa de `@@unique([empresaId, id])`, e as relações usam
   `fields: [empresaId, xId], references: [empresaId, id]`.
2. **Aplicação:** `criarDbTenant(empresaId)` (`src/lib/db-tenant.ts`) é uma extension do Prisma que **injeta `empresaId`** em
   todo `where`/`create`. Os modelos são detectados automaticamente pelo DMMF (qualquer modelo com `empresaId`).
   - Em `create`, **não** passe `empresa: { connect }`: gera `ErroTenant`. Passe `empresaId` (ou deixe ser injetado).
   - Escritas aninhadas, `include` e SQL cru **não** passam pela extension. As FKs compostas protegem, mas tome cuidado.
   - `prismaAdmin` (sem filtro) é **só** para seed, cron (listar empresas) e testes.

### 5.2 Ator e Contexto
- `Contexto` (`src/lib/tenant.ts`, `getContexto()`): usuário logado, empresa, permissões, `modulosAtivos` e `obrasPermitidas`.
  É relido do banco **a cada requisição**, então revogar um acesso vale na hora (`tokenVersao`).
- `Ator` (`src/lib/ator.ts`): `{ db, empresaId, usuarioId, permissoes, obrasPermitidas }`. É o parâmetro de **todo** serviço.
  Nas actions/páginas: `const a = await getAtor()` (`ator-servidor.ts`). Nos testes e seeds, monta-se à mão (ver `scripts/teste-*.ts`).

### 5.3 Papéis, perfis e permissões
- **Papel** (`PapelUsuario`): `ADMIN` (todas as permissões), `GESTOR_SGI`, `INSPETOR` e `COLABORADOR`, cada um com um conjunto padrão
  (`PERMISSOES_POR_PAPEL` em `src/lib/permissoes.ts`).
- **Perfil** (configurável pelo admin): soma permissões extras. **Efetivas = padrão do papel ∪ perfil** (`permissoesEfetivas`).
- Permissões existentes: `RNC_*`, `PLANO_GERENCIAR`, `PROCESSO_GERENCIAR`, `RISCO_GERENCIAR`/`RISCO_TRATAR`, `SWOT_GERENCIAR`,
  `HIRA_GERENCIAR`, `LAIA_GERENCIAR`, `DOCUMENTO_ELABORAR`/`GERENCIAR`, `INSPECAO_GERENCIAR`/`REALIZAR`,
  `AUDITORIA_GERENCIAR`/`REALIZAR`, `INCIDENTE_GERENCIAR`/`VER_RESTRITOS`, `INDICADOR_GERENCIAR`,
  `TREINAMENTO_GERENCIAR`, `ADMIN_CONFIG`, `VER_TODAS_OBRAS`.
- **Permissão nova** = valor no enum `Permissao` (migração `ALTER TYPE ... ADD VALUE`) + entrada em `TODAS_PERMISSOES`, + (se fizer
  sentido) no perfil do seed.
- Padrão recorrente: **"gerenciar OU ser o responsável"**. O responsável por um registro pode tratá-lo sem ter a permissão ampla.

### 5.4 Escopo por obra/unidade
- `Usuario.escopoObras` = `TODAS` ou `SELECIONADAS` (+ `UsuarioAcessoObra`). `VER_TODAS_OBRAS` equivale a TODAS.
- `filtroObras(obrasPermitidas)` (`src/lib/escopo-obras.ts`) monta o `where`. Registro **sem obra** = da empresa toda, visível a todos.
- Módulos com obra **obrigatória**: HIRA, LAIA, Inspeções, Incidentes. Com obra **opcional**: RNC, Riscos,
  Auditorias. Sem obra (corporativos): Documentos, Indicadores, Processos, SWOT.

### 5.5 Módulos contratados (gating)
- `Empresa.modulosAtivos: Modulo[]`. Na página: `exigirModulo(ctx, "X")` (404 se desligado). No serviço: `exigirModuloX(a)`, que lê a
  empresa, porque o `Ator` não carrega módulos.
- Menu: `src/lib/menu-registro.ts`. O item aparece se `implementado: true` **e** o módulo está ativo **e** a permissão (opcional)
  está presente.
- Configurações → aba **Módulos** liga e desliga os módulos (a Demo tem só RNC e Plano de Ação: isso é usado nos testes de gating).

### 5.6 Integridade e trilha de auditoria
- **Trava otimista:** a coluna `versao Int` é incrementada a cada edição. O form envia a versão lida, e se ela diverge o serviço lança
  `ErroConflito` ("alterado por outra pessoa"). Em código: `updateMany({ where: { id, versao } })` e `count === 0` ⇒ conflito.
- **Histórico append-only:** tabelas `Historico*` (e `VersaoProcesso`, `ResultadoIndicador`, `CienciaDocumento`...) têm **trigger**
  que bloqueia UPDATE/DELETE. Grave o histórico **na mesma transação** da mudança.
- **Exclusão lógica:** `ativo = false` (ou status INATIVA/CANCELADO). `onDelete: Restrict` em quase tudo.
- **CHECKs no banco** para invariantes (faixas numéricas, "ausente não tem validade", "dados pessoais ⇒ restrita" etc.). Eles ficam
  na seção `-- Regras SQL` no fim da migração.
- **Calcular na leitura sempre que possível** (status "atrasado", aptidão, "em dia"). Grave só o que precisa ser filtrado ou
  congelado (ex.: score/faixa de risco, % de conformidade ao concluir).

### 5.7 Numeração e códigos
`ContadorSequencial` com upsert atômico: `proximaSequencia(tx, tipo, ano, subtipo?)`. Formatos: `RNC-001-26`, `INSP-NNN-AA`,
`AUD-NNN-AA`, `INC-NNN-AA`, `R-001`/`O-001`, `H-001`, `A-001`, documentos `SIGLA-NNN` (por tipo). Novo tipo ⇒ valor
em `TipoSequencia`.

### 5.8 Datas e fuso
- Cada empresa tem `fusoHorario` (padrão `America/Sao_Paulo`). "Hoje" = `hojeNoFuso(await fusoDaEmpresa(a))`.
- Datas de negócio são `@db.Date`, trafegando como string `YYYY-MM-DD`. Converta com `dataIso(date)` e `paraDataDb(iso)`. Some dias
  com `somarDias`, e meses/validade com `calcularProximaReavaliacao` (ajusta fim de mês).
- **Nunca** use `new Date().toISOString().slice(0,10)` para "hoje": dá o dia errado à noite no Brasil.

### 5.9 LGPD (dados pessoais e sensíveis)
- RNC e Incidente têm `restrita`/`contemDadosPessoais` + tabela 1:1 `*DadosSensiveis`. Envolver pessoa ⇒ **restrito automaticamente**.
- Sem a permissão `*_VER_RESTRITAS`, o serviço devolve os campos sensíveis como `null`. O usuário não fica sabendo que existem.
- **Notificações e e-mails nunca levam texto livre de registro restrito** ("Acesse o sistema…"). Títulos de plano são neutros.
- Anexos sensíveis usam um tipo próprio (`RNC_DADOS_SENSIVEIS`, `INCIDENTE_DADOS_SENSIVEIS`) com checagem de permissão.
- Futuro: ASO (saúde) no módulo de Treinamentos. Só "Apto/Inapto" pode ser exibido fora do SESMT.

### 5.10 Erros
- `ErroNegocio` (mensagem exibível ao usuário), `ErroConflito` (trava otimista) e `ErroPermissao`.
- `executar()` (`acoes-comuns.ts`) converte esses erros, `P2002` (unicidade → conflito) e `ZodError` em `{ erro }` para o `FormAcao`.
  Qualquer outro erro sobe (500).

---

## 6. Motores compartilhados

Antes de criar algo novo, **reaproveite** estes motores.

### 6.1 Plano de Ação 5W2H (`src/lib/plano-acao/`)
- `PlanoAcao` (origem polimórfica: `OrigemPlanoAcao` = RNC, INSPECAO, AUDITORIA, MANUAL, RISCO_OPORTUNIDADE, HIRA, LAIA,
  INCIDENTE + `origemId`) → `ItemAcao` (o quê, por quê, onde, **quem** (usuário interno), **quando**, como, quanto;
  status PENDENTE/EM_ANDAMENTO/CONCLUIDO/CANCELADO).
- "Atrasado" e o status geral do plano são **calculados**.
- Dentro de outras transações use `criarPlanoNaTransacao` e `adicionarItemNaTransacao`.
- Padrão de negócio repetido: **situação ruim exige plano**. Ao cadastrar sem plano, informa-se a "primeira ação" e o plano nasce
  na mesma transação. Vale para risco MITIGAR/EVITAR Alto/Crítico.
- Telas: `/plano-acao` (visão unificada; "Minhas ações"), `/plano-acao/[id]` (item), `/plano-acao/planos/[id]`, `/plano-acao/novo`
  (plano MANUAL).

### 6.2 Motor de Aprovação multi-assinante (`src/lib/aprovacao/`)
- `FluxoAprovacao` (tipo de entidade, tipo de alteração INCLUSAO/ALTERACAO/EXCLUSAO/PUBLICACAO, `payload` JSON, modo
  SEQUENCIAL/PARALELO) → `EtapaAprovacao` (assinante, status) → `HistoricoAprovacao`.
- Cada módulo registra um **handler** (`registry.ts`): `aoAprovar` (aplica o payload na transação da última assinatura),
  `aoAvancar`, `aoRejeitar`, `aoCancelar`, `podeVer`.
- **Regra obrigatória:** módulo com handler ⇒ import em `src/lib/aprovacao/handlers.ts` + tipo em `TIPOS_COM_HANDLER`. Senão, aprovar
  pela tela `/aprovacoes` conclui o fluxo **sem aplicar** a mudança.
- A configuração por módulo fica em `Empresa.config.aprovacao.<modulo> = { exigir, aprovadorIds, modo, usarTramitacao }` (Configurações
  → Aprovações). O solicitante nunca aprova a si mesmo.
- Handlers conferem a `versao` lida no pedido: se o registro mudou no meio tempo, a aprovação falha com conflito.
- Usado por: Processos (publicação), Riscos (alteração), HIRA e LAIA (inclusão/alteração/exclusão), Documentos (revisão →
  aprovação), cancelamento de RNC.

### 6.3 Anexos (`src/lib/anexos/`, `src/lib/armazenamento/`)
- `Anexo` genérico (`TipoEntidadeAnexo` + `entidadeId`). O arquivo vai para o Blob/disco e **o tipo é validado pelo conteúdo**
  (magic bytes), não pela extensão.
- Download só pela rota autenticada `/api/anexos/[id]`. PDF sempre como attachment. Exclusão lógica.
- `prevalidarArquivos` (quantidade/tamanho/permissão antes de ler em memória) → `enviarAnexos`.
- Tipo novo ⇒ valor no enum + regra de quem pode ver/enviar em `anexos/servico.ts`.
- UI: `GaleriaAnexos`/`EnviarAnexos` (`componentes/anexos.tsx`), `CampoArquivos`.

### 6.4 Interações (comentários/conversas)
`Interacao` por entidade (`TipoEntidadeInteracao`), com menções e leitura. Componente `<Interacoes a tipo entidadeId .../>`. A tela
`/mensagens` é a caixa de conversas. Uma mensagem nova gera a notificação `INTERACAO_NOVA`.

### 6.5 Notificações e e-mail (`src/lib/notificacoes/`, `src/lib/email/`)
- `Notificacao` in-app (sino) + e-mail opcional, com status PENDENTE/ENVIADO/IGNORADO/FALHOU, claim atômico e até 3 tentativas.
- **Idempotência por `chave`**: a mesma chave nunca gera duas notificações. Use chaves determinísticas.
- As preferências por usuário ficam em Configurações → Notificações.
- Tipo novo ⇒ valor em `TipoNotificacao` (e `TipoEntidadeNotificacao`, se for o caso) + rótulo.

### 6.6 Reavaliação periódica + cron (`src/lib/reavaliacao/`)
- Cada módulo com vencimentos registra uma **fonte** (`registrarFonteReavaliacao`) em `lib/<modulo>/reavaliacao.ts`, que é
  **importado por efeito colateral** em `src/lib/notificacoes/cron.ts`.
- Uma fonte define: `modulo`, `tipoNotificacao`, `diasAntecedencia`, `mensagem()` e `listarVencendo()`, que devolve itens com
  `entidadeId`, data, título, link e destinatários.
- A chave de idempotência é `reavaliacao:<modulo>:<entidadeId>:<data>:<usuario>`. Para vários degraus do mesmo módulo (ex.: alertas
  de 60/30/0 dias), registre várias fontes com `chave` diferente e **sufixo no `entidadeId`** (ver `treinamentos/reavaliacao.ts`).
- Fontes atuais: Riscos, HIRA, LAIA, Documentos (revisão), Indicadores (sem lançamento), Treinamentos
  (escalado).
- O cron diário também manda alertas de prazo/atraso de itens de ação. O semanal envia o resumo por e-mail.

### 6.7 Escalas e heatmap (`src/lib/escala/`)
- `ConfiguracaoEscala` por empresa + tipo (RISCO_OPORTUNIDADE, HIRA, ASPECTO_IMPACTO) + **override opcional por obra**. A resolução
  é obra → empresa → padrão do sistema (`escala/padrao.ts`).
- Funções puras: `calcularScore`, `faixaParaScore`, `calcularNivel`, `nivelComCriteriosExtras`, `ehSignificativo`.
- Faixas: BAIXO/MEDIO/ALTO/CRITICO. O score e a faixa são **gravados** no registro (para filtrar e montar o heatmap) e recalculados
  no servidor.
- Componente `componentes/heatmap.tsx`: células clicáveis que filtram a lista.

### 6.8 Dashboard (`/dashboard`)
Painéis por módulo, exibidos só quando o módulo está ativo e respeitando o que o usuário pode ver: RNCs (abertas, eficácia na 1ª
verificação, por obra/tipo/gravidade), plano (atrasos), riscos/HIRA/LAIA por nível, documentos, inspeções, auditorias, incidentes (taxa de frequência simples), indicadores (% atingidas) e treinamentos (% em dia). Para agregar, reaproveite
os `resumo*()` dos serviços.

---

## 7. Receita: como construir uma funcionalidade

Siga nesta ordem. Os módulos de Treinamentos e Indicadores são bons exemplos recentes para copiar.

1. **Schema** (`prisma/schema.prisma`): `empresaId`, `@@unique([empresaId, id])`, FKs compostas, `@@map("snake_case")`,
   `@map` nas colunas. Acrescente as relações inversas em `Empresa`/`Usuario`. Enums novos ou valores novos em
   `Permissao`/`TipoEntidadeAnexo`/`TipoNotificacao`, conforme o caso.
2. **Migração** (§12 explica por que não usar `migrate dev` direto aqui):
   ```bash
   npx prisma format
   mkdir prisma/migrations/<AAAAMMDDhhmmss>_<nome>
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<...>/migration.sql
   # acrescente no fim: -- Regras SQL (CHECKs, triggers append-only)
   npx prisma migrate deploy && npx prisma generate
   ```
3. **Regras puras** em `lib/<modulo>/regras.ts`: rótulos (`ROTULO_*`), listas (`TIPOS_*`), cálculos e máquinas de estado. Escreva o
   **teste vitest** junto (`tests/<modulo>.test.ts`).
4. **Acesso** em `acesso.ts`: `moduloXAtivo`, `exigirModuloX`, `podeGerenciarX`, `linkX(id)`.
5. **Serviço** em `servico.ts`: toda função recebe `a: Ator`. Na ordem:
   - exija módulo e permissão;
   - valide a entrada de novo (o serviço não confia na action) com mensagens em português;
   - use `$transaction` quando houver mais de uma escrita, e grave o histórico na mesma transação;
   - converta `P2002` em mensagem amigável (ex.: "Já existe ... com este nome").
6. **Actions** em `app/(app)/<modulo>/actions.ts`: `"use server"`, esquema zod sobre `obj(fd)`, `executar(fn, caminhos)` com a lista
   de caminhos a revalidar, retorno `{ ok }`/`{ erro }`. Não coloque regra de negócio na action.
7. **Página**: a casca em `app/(app)/<modulo>/.../page.tsx` só importa o componente de `src/paginas/html/<pagina>.tsx`. No componente:
   `getContexto()` → `exigirModulo` → `getAtor()` → serviço → JSX. Formulários com `<FormAcao acao={...} botao="...">`.
8. **CSS**: `src/paginas/css/<pagina>.module.css` com o mesmo nome, seções numeradas e **só tokens** de `base.css` (nunca cor solta).
   Leia `docs/05-guia-paginas-css.md`.
9. **Menu**: entrada em `REGISTRO_ITENS_MENU` (com `permissao` se for restrito).
10. **Integrações**, conforme o caso: origem de plano, tipo de anexo/interação/notificação, fonte de reavaliação, handler de
    aprovação (+ `handlers.ts`), painel no dashboard, cartão no detalhe do processo.
11. **Seed** `prisma/seed-<modulo>.ts`, **via serviço**, com datas **relativas a hoje**, cobrindo todos os estados (vencido, a
    vencer, em dia...). Chame-o em `prisma/seed.ts`. Ele é idempotente: só cria se estiver vazio.
12. **Teste de integração** `scripts/teste-<modulo>.ts` + script no `package.json`. Cubra: gating (Demo sem módulo), permissão,
    regras, isolamento (Demo não enxerga nada), triggers e o seed/dashboard.
13. **Verificação:** `npx tsc --noEmit -p .`, `npx eslint <arquivos>`, `npx vitest run`, `npm run test:<modulo>`, e abra a tela no
    navegador.
14. **Documente** a entrega em `docs/06-desenho-modulos.md`: schema, decisões, regras, acesso, telas, seed e testes.

---

## 8. Os módulos

Formato de cada módulo: **objetivo** · **o que se cadastra** · **como se preenche (fluxo do usuário)** · **regras** · **quem pode** ·
**integrações** · **telas**.

### 8.1 Início, Dashboard, Notificações, Mensagens (base)
- **Início (`/`)**: saudação, indicadores rápidos do usuário e mensagens não lidas.
- **Dashboard (`/dashboard`)**: ver §6.8.
- **Notificações (`/notificacoes`)** e sino no cabeçalho; **Mensagens (`/mensagens`)**; **Aprovações (`/aprovacoes`)**: fila do que
  aguarda a minha assinatura (§6.2).

### 8.2 RNC — Relatório de Não Conformidade (ISO 9001 10.2) · base, sempre ativo
- **Objetivo:** registrar um desvio, achar a causa raiz, corrigir e **provar que a correção funcionou**.
- **Cadastro:** título, descrição, tipo (`QUALIDADE`/`MEIO_AMBIENTE`/`SSO`), origem (`AUDITORIA_INTERNA`, `INSPECAO`,
  `RECLAMACAO_CLIENTE`, `AUTO_IDENTIFICADA`, `AUDITORIA_EXTERNA`), gravidade (BAIXA→CRITICA), obra (opcional), setor, processo,
  responsável pelo tratamento, fotos/anexos e, se houver pessoas envolvidas, dados sensíveis (RNC fica restrita).
- **Fluxo de preenchimento:**
  1. **Abrir** (`/rncs/nova`, qualquer um com `RNC_ABRIR`) → ABERTO, código `RNC-001-26`.
  2. **Analisar** (responsável com `RNC_TRATAR`) → EM_ANALISE: causa raiz por **5 Porquês**, **Ishikawa (6M)** ou texto livre.
  3. **Plano 5W2H** → PLANO_EM_EXECUCAO. "Iniciar execução" só aparece com ao menos 1 item ativo. Os responsáveis executam os itens
     e anexam evidência.
  4. **Enviar para verificação** → EM_VERIFICACAO. Quem tem `RNC_VERIFICAR_EFICACIA` registra EFICAZ (→ ENCERRADO) ou INEFICAZ
     (→ REABERTO → EM_ANALISE, novo **ciclo** no mesmo plano).
  5. **Cancelar** só por solicitação (`RNC_SOLICITAR_CANCELAMENTO`) aprovada por outra pessoa (`RNC_APROVAR_CANCELAMENTO`).
- **Regras:** máquina de estados pura (`lib/rnc/estados.ts`); histórico de status append-only; anexos de RNC encerrada não podem
  ser excluídos; o responsável precisa estar ativo, ter `RNC_TRATAR` e acesso à obra.
- **Integrações:** nasce de Inspeção (NC), Auditoria (constatação NC) ou manualmente; gera Plano de Ação (origem RNC); alimenta o
  dashboard e o indicador automático "% eficazes na 1ª verificação".
- **Telas:** `/rncs` (filtros), `/rncs/nova`, `/rncs/[id]` (Resumo, Causa raiz, Plano, Verificação, Histórico, Cancelamento, anexos,
  conversa).

### 8.3 Plano de Ação · base, sempre ativo
Ver §6.1. **Preenchimento:** cada linha 5W2H exige **o quê**, **quem** e **quando**. O responsável ("quem") inicia e conclui o item
(com evidência). Um plano MANUAL (`/plano-acao/novo`) serve para ações que não vêm de nenhum módulo. Quem gerencia é
`PLANO_GERENCIAR`; o "quem" vê as próprias ações.

### 8.4 Mapa de Processos (ISO 9001 4.4) · `MAPA_PROCESSOS`
- **Cadastro:** código, nome, tipo (raia GESTAO/FINALISTICO/APOIO), ordem na raia, objetivo, dono, **SIPOC** (fornecedores,
  entradas, saídas, clientes, recursos), indicadores do processo (texto) e interações (setas origem → destino).
- **Preenchimento:** aba **Planilha** (`/processos`): editar linha a linha, "+ Adicionar linha", ↑↓ para ordenar, mudar o tipo move
  de raia. Aba **Mapa**: SVG gerado automaticamente em 3 raias, com caixas clicáveis. No detalhe: SIPOC, indicadores, interações.
- **Publicação:** congela um snapshot (`VersaoProcesso`), seja direto ou via motor de aprovação.
- **Integrações:** o detalhe do processo é um **hub**, com cartões de riscos, HIRA, LAIA, documentos e
  indicadores vinculados a ele.
- **Quem:** leitura com o módulo; escrita com `PROCESSO_GERENCIAR`.

### 8.5 Riscos e Oportunidades (ISO 9001 6.1) · `RISCOS_OPORTUNIDADES`
- **Cadastro:** tipo RISCO/OPORTUNIDADE (código R-/O-), processo e obra opcionais, causa, consequência, **P × I** pela escala (score e
  faixa calculados), tratamento (ACEITAR/MITIGAR/TRANSFERIR/EVITAR para risco; EXPLORAR para oportunidade), avaliação residual,
  responsável, periodicidade de reavaliação.
- **Preenchimento:** `/riscos/novo` mostra o nível ao vivo. Se o tratamento for MITIGAR/EVITAR com faixa ALTO/CRÍTICO, é
  **obrigatório** informar a primeira ação (o plano nasce junto). Depois, no detalhe: reavaliar, definir residual, mudar status
  (IDENTIFICADO → EM_TRATAMENTO → MONITORADO → ENCERRADO). "Revisão geral" reavalia um lote.
- **Quem:** cadastro com `RISCO_GERENCIAR`; tratamento com `RISCO_TRATAR`, GERENCIAR ou o responsável. A alteração via aprovação é
  opcional.
- **Telas:** `/riscos` (heatmaps inicial e residual clicáveis), `/riscos/[id]`, `/riscos/revisao-geral`.

### 8.6 SWOT e Partes Interessadas (ISO 9001 4.1/4.2) · `SWOT`
- **Cadastro:** ciclo por ano; itens por quadrante (força/fraqueza/oportunidade/ameaça) com relevância 1–5; partes interessadas com
  necessidade e **influência × interesse** (heatmap com estratégia sugerida).
- **Preenchimento:** criar o ciclo (pode copiar o anterior) → lançar os itens → "Gerar risco/oportunidade" a partir de um item
  (fraqueza/ameaça → risco; força/oportunidade → oportunidade, com vínculo). Ciclo encerrado fica somente leitura.
- **Quem:** `SWOT_GERENCIAR`.

### 8.7 HIRA — Perigos e Riscos ocupacionais (ISO 45001 6.1.2) · `HIRA`
- **Cadastro (linha):** obra (**obrigatória**), setor, processo, atividade (rotineira ou não), perigo, risco/dano, condição
  (NORMAL/ANORMAL/EMERGENCIA), controles existentes, **hierarquia de controle** (eliminação → substituição → engenharia →
  administrativo → EPI, escolhida num funil que avisa quando o risco é Alto/Crítico e o controle é só EPI), P × S inicial e residual,
  requisito legal, responsável, reavaliação.
- **Preenchimento:** `/hira/novo` (nível ao vivo). Com aprovação exigida pela empresa, a inclusão fica PENDENTE_APROVACAO até a
  última assinatura, e alteração/exclusão também passam pelo fluxo. Existem a vista em **árvore** (Obra > Processo > Atividade) e a
  **clonagem** da matriz de uma unidade para outra.
- **Quem:** `HIRA_GERENCIAR`. **Integrações:** plano (origem HIRA), aprovação/tramitação (a planilha pode virar um documento
  versionado `HIRA:<obra>`), reavaliação, dashboard, processo.

### 8.8 LAIA — Aspectos e Impactos ambientais (ISO 14001 6.1.2) · `LAIA`
Igual ao HIRA na mecânica (obra obrigatória, aprovação, árvore, clonagem, revisão geral). Troca-se perigo/risco por
**aspecto/impacto**, e o score vem de **severidade × frequência × abrangência**. Critérios extras (requisito legal, partes
interessadas) **elevam** a faixa. **Significativo = ALTO/CRÍTICO** (filtro "somente significativos"). Quem: `LAIA_GERENCIAR`.

### 8.9 Documentos — tramitação e controle (ISO 9001 7.5) · `DOCUMENTOS`
- **Cadastro:** tipo (PR, IT, FO, POL, MAN..., configurável em Configurações → Tipos de documento), título, processo, obra, setor,
  responsável, periodicidade de revisão. Código `SIGLA-NNN`.
- **Fluxo de preenchimento:**
  1. **Elaborar** a revisão (Rev. 00, 01...): arquivo + motivo (`DOCUMENTO_ELABORAR`).
  2. **Enviar**: escolher revisores e aprovadores, sequencial ou paralelo → EM_REVISAO → EM_APROVACAO → APROVADO.
  3. **Publicar** (`DOCUMENTO_GERENCIAR`): escolher o **público** (todos ou setores/obras/perfis/usuários), se notifica e se **exige
     ciência** (opcionalmente com um **micro-quiz** de até 3 perguntas). A revisão anterior vira OBSOLETA na mesma transação.
  4. O público faz a leitura em `/documentos/meus` e clica em "Li e estou ciente".
- **Extras:** PDF de **cópia controlada** com QR (`/validar-doc` confere se a cópia impressa ainda é a vigente); alerta de revisão
  periódica; obsolescência.
- **Integrações:** HIRA/LAIA ("usar tramitação"), processo (documentos vinculados) e **Treinamentos** (a ciência conta como
  conscientização, §8.15).

### 8.10 Inspeções / Checklists · `INSPECOES`
- **Cadastro:** **modelos** de checklist (`/inspecoes/modelos`) com perguntas ordenadas, tipo de resposta (C/NC/NA, SIM/NÃO, nota 1–5,
  texto), "foto obrigatória na NC" e nota mínima.
- **Preenchimento (em campo, celular):** `/inspecoes/nova` (modelo + obra) → responder cada pergunta (botões grandes de toque),
  comentário e foto → **concluir** (exige todas respondidas e foto nas NCs obrigatórias; grava o % de conformidade = C ÷ (C+NC)).
- **Valor central:** cada resposta NC pode **"Abrir RNC"** (origem INSPECAO, com as fotos) ou **"Criar apenas item de ação"**. A
  pergunta é congelada em snapshot, então editar o modelo não muda inspeções já iniciadas.
- **Quem:** `INSPECAO_GERENCIAR` (modelos, qualquer inspeção) e `INSPECAO_REALIZAR` (padrão do INSPETOR).

### 8.11 Auditorias internas · `AUDITORIAS`
- **Cadastro:** programa anual; auditoria (`AUD-NNN-AA`: tipo interna/externa, norma, escopo, processo/obra, auditor líder, equipe,
  período); itens do plano (requisito + pergunta).
- **Preenchimento:** planejar → iniciar (EM_EXECUCAO) → registrar **constatações** (NC, Observação, Oportunidade de melhoria, Ponto
  forte) com evidência → para cada NC, **abrir RNC** (origem AUDITORIA_*; o tipo é sugerido pela norma) → concluir.
- **Quem:** `AUDITORIA_GERENCIAR` planeja; o auditor líder (`AUDITORIA_REALIZAR`) executa.

### 8.12 Requisitos Legais · **DESCONTINUADO** (2026-09-30)
O módulo foi **retirado do produto** por decisão do Eric (complexidade): telas, serviço, seed, testes e as ligações com Processos,
Dashboard, Plano de Ação, Anexos, Interações, Notificações e cron foram removidos. A migração `20260930100000_remove_requisitos_legais`
apaga as tabelas e os tipos próprios. Os valores `REQUISITOS_LEGAIS` / `REQUISITO_LEGAL*` **continuam nos enums compartilhados do
banco** (não dá para apagar valor de enum com dados antigos) e são tratados como "sem acesso" no código. **Não reimplementar sem ordem.**
Os campos de texto "requisito legal" do HIRA e do LAIA (e o critério que eleva a faixa da LAIA) **continuam**: são dados da própria
linha, não o módulo.

### 8.13 Incidentes e Acidentes (ISO 45001 10.2) · `INCIDENTES`
- **Cadastro:** `INC-NNN-AA`: tipo (típico, trajeto, quase-acidente, doença ocupacional), gravidade (sem afastamento / com
  afastamento / fatalidade), data/hora, obra, local, descrição, envolvido (usuário **ou** terceiro), testemunhas, dias perdidos,
  CAT (apenas o número).
- **Preenchimento:** **qualquer pessoa** com o módulo registra (participação dos trabalhadores, ISO 45001 5.4). O formulário é pensado
  para celular. Depois, `INCIDENTE_GERENCIAR` ou o responsável investiga: causa raiz (mesmo componente da RNC) → plano → **concluir**
  (exige causa raiz; concluído é imutável).
- **LGPD:** com pessoa envolvida o incidente fica **restrito**. Os dados sensíveis só aparecem com `INCIDENTE_VER_RESTRITOS`.

### 8.14 Indicadores · `INDICADORES`
- **Cadastro:** nome, processo, unidade, direção (maior/menor melhor), meta, periodicidade (mensal/trimestral/semestral/anual),
  fonte (MANUAL ou automática: "% RNC eficaz na 1ª verificação", "% itens de ação atrasados") e responsável.
- **Preenchimento:** lançar o resultado por período (`2026-03`, `2026-T1`...). Período futuro é negado. Uma correção é um **novo
  lançamento** com observação (os resultados são append-only e guardam uma cópia da meta vigente). Os automáticos têm o botão
  "Registrar valor calculado".
- **Alerta:** indicador sem lançamento no último período fechado. **Quem:** `INDICADOR_GERENCIAR` ou o responsável.

### 8.15 Treinamentos e Competências (ISO 9001 7.2/7.3, ISO 45001 7.2) · `TREINAMENTOS`
- **Cadastro do treinamento:** nome, tipo (Integração, NR, Reciclagem, Técnico, **Conscientização**, Outro), carga horária, validade
  em meses (vazio = não vence), **obrigatório para** (todos / setores / **funções** — a união), **crítico para aptidão**, **dias para
  avaliar a eficácia** e **documento para conscientização** (opcional).
- **Fluxo de preenchimento:**
  1. **Registrar a sessão realizada** (data, instrutor, unidade, carga, **modalidade**, **conteúdo programático**, **qualificação do
     instrutor**). Para NR/Reciclagem o sistema mostra "Conforme NR-1" ou as pendências.
  2. **Lançar a presença em lote** (Presente/Ausente, aproveitamento, certificado PDF por pessoa). A validade é calculada: data +
     meses.
  3. **Avaliar a eficácia** por participante (Eficaz / Não eficaz + ação) a partir do prazo configurado.
  4. **Gatilhos de reciclagem**: registrar um evento por pessoa (mudança de função, retorno de afastamento, acidente, mudança de
     procedimento). A pessoa fica em "Reciclagem pendente" até participar de uma sessão com data ≥ a do evento.
- **Status por pessoa × treinamento (calculado):** Em dia / A vencer (≤ 30 dias) / Vencido / Não realizado / Reciclagem pendente.
  **Aptidão:** Inapto se algum treinamento **crítico e obrigatório** estiver pendente.
- **Conscientização (7.3):** num treinamento vinculado a um documento, a **ciência da revisão vigente** conta como realização. Uma
  nova revisão publicada deixa quem deu ciência da antiga em "Reciclagem pendente".
- **Alertas escalados:** 60 dias → colaborador; 30 dias → gestores (quem cadastrou + `TREINAMENTO_GERENCIAR`); vencido → os dois
  ("INAPTA" se crítico).
- **Telas:** `/treinamentos` (catálogo), `/treinamentos/[id]` (sessões, presença, eficácia, gatilhos), `/treinamentos/matriz` (pessoa ×
  treinamento + coluna Aptidão), `/treinamentos/meus`, `/treinamentos/auditoria` (evidências para o auditor, pronto para imprimir/PDF).
- **Não feito ainda:** ASO/LGPD, bloqueio de alocação de inapto em escalas, crachá digital (QR de aptidão), matriz ILUO,
  eSocial S-2220.

### 8.16 Configurações (`/configuracoes`, `ADMIN_CONFIG`)
Abas: **Usuários** (papel, perfil, setor, **função**, escopo de unidades, ativar, senha), **Perfis** (permissões por checkbox),
**Unidades**, **Setores**, **Funções**, **Módulos**, **Escalas** (JSON por tipo/obra), **Aprovações** (por módulo: exigir,
aprovadores, modo, usar tramitação), **Tipos de documento**, **Notificações**. Toda mudança de acesso incrementa `tokenVersao`, o que
derruba as sessões abertas. O admin não pode remover o próprio acesso.

---

## 9. Como tudo se integra

```
              ┌────────────── Mapa de Processos (hub) ──────────────┐
              │ riscos · HIRA · LAIA · documentos · indicadores · KPIs│
              └──────────────────────────────────────────────────────┘
 SWOT ──gera──▶ Riscos/Oportunidades ─┐
 Inspeção (NC) ──abre──▶ RNC ─────────┤
 Auditoria (constatação NC) ─▶ RNC ───┤
 HIRA / LAIA ─────────────────────────┼──▶ PLANO DE AÇÃO 5W2H ──▶ itens com evidência ──▶ (RNC) verificação de eficácia
 Incidente (investigação) ────────────┘
 HIRA/LAIA ──alteração──▶ Motor de Aprovação ──(opcional)──▶ Documento-planilha versionado
 Documento publicado ──ciência──▶ Treinamento de conscientização (ISO 7.3)
 Treinamento vencido/gatilho ──▶ aptidão (Inapto) ──▶ alertas escalados
 Todos ──▶ Anexos · Interações · Notificações · Dashboard · Cron (reavaliação/vencimentos)
```

**Integrações transversais que todo módulo pode usar:** anexos (evidência), comentários, notificações, plano de ação, aprovação,
reavaliação periódica, painel no dashboard e cartão no detalhe do processo.

---

## 10. UI, design e CSS

- **Hoje no código:** o **Design System Vigen** (Figma "Vigen — Sistema (SGI)", implantação em fases: `docs/07-plano-implantacao-design.md`):
  paleta **teal** (`--cor-primaria-*`, sidebar #0F2B34, acento #4B798F), neutros frios, fonte **Inter**, botões/campos com raio 10px,
  cartões com raio 16px e sombra suave. Os tokens ficam em `src/paginas/css/base.css`. (A antiga Direção A "Campo", âmbar + IBM Plex,
  está em `docs/04-propostas-design.md` só como histórico.)
- **Regras de CSS** (detalhes em `docs/05-guia-paginas-css.md`): um `.module.css` por página, seções numeradas com índice, **só
  tokens** (cores, espaços, raios, fontes, z-index) e nada de Tailwind novo. Reaproveite os componentes de
  `paginas/html/componentes/` antes de criar novos.
- **Badges de status:** `componentes/badge.tsx` mapeia cada status do domínio para as cores semânticas (`BadgeStatusRnc`,
  `BadgeFaixa`, `BadgeStatusCompetencia`, `BadgeAptidao`, `BadgeEficacia`...). Status novo ⇒ novo mapeamento ali.
- **Campo/celular:** alvos de toque ≥ 44px, formulários curtos (Inspeções e Incidentes são a referência).
- **Migração em andamento:** a paleta teal/Inter foi **aprovada** (2026-09-30). Fase 1 (tokens, fonte, logos) feita; casca, componentes
  e módulos seguem o plano do doc 07. A migração é feita **trocando os tokens do `base.css`**, não página por página.

---

## 11. Testes, seed e usuários de teste

**Empresas do seed:** **Monto** (todos os módulos ativos, dados ricos) e **Demo** (só RNC e Plano; usada para testar gating e
isolamento).

| E-mail (senha `vigen123`) | Papel / perfil | Uso típico |
|---|---|---|
| admin@monto.com.br | ADMIN | tudo, aprovações, configurações |
| qualidade@monto.com.br | GESTOR_SGI + perfil Qualidade | processos, riscos, documentos, indicadores, treinamentos |
| seguranca@monto.com.br | perfil Segurança | HIRA, incidentes (restritos), treinamentos |
| meioambiente@monto.com.br | perfil Meio Ambiente | LAIA |
| inspetor@monto.com.br | INSPETOR | inspeções em campo, RNC |
| colaborador@monto.com.br | COLABORADOR | abrir RNC, "minhas ações", ciência, meus treinamentos |
| admin@demo.com.br | ADMIN da Demo | isolamento/gating |

**Comandos:**
```bash
npx tsc --noEmit -p .          # tipos
npm run lint                   # eslint
npm test                       # vitest (regras puras)
npm run test:<modulo>          # integração: rnc→test:fluxo-rnc, anexos, notificacoes, admin, isolamento,
                               # processos, riscos, swot, hira, laia, documentos, inspecoes, auditorias,
                               # incidentes, indicadores, treinamentos, aprovacao, plano-manual
```
- Os testes de integração **gravam no banco local** e os registros append-only não podem ser apagados. Escreva testes que
  **aguentam rodar de novo**: nomes com sufixo aleatório, "cria se não existir", asserções que não dependam de o banco estar limpo.
- **Estado atual:** 3 testes vitest falham desde o rename Obra→Unidade (`hira`, `laia` e `plano-manual` esperam o texto "obra" nas
  mensagens). Basta atualizar as regex.

---

## 12. Armadilhas conhecidas e pendências

**Ambiente/Windows**
- `npx prisma migrate dev` pede **reset** do banco local por drift (triggers/SQL manual). **Não resete** (apaga os dados do dono).
  Gere o SQL com `migrate diff` e aplique com `migrate deploy` (§7, passo 2).
- Com o `npm run dev` rodando, o `prisma generate` falha ao trocar a DLL do engine (EPERM). Os tipos são gerados mesmo assim, mas
  **reinicie o dev server** para ele carregar o client novo.
- Os arquivos têm **CRLF**. Scripts de substituição de texto precisam normalizar `\r\n`.
- O seed só cria dados quando a tabela do módulo está vazia. Para ver dados novos num banco já populado, aplique manualmente ou
  recrie o banco (com autorização do dono).

**Código**
- Registros por **efeito colateral** (import): handlers de aprovação (`aprovacao/handlers.ts`) e fontes de reavaliação
  (`notificacoes/cron.ts`). Esquecer o import = funcionalidade silenciosamente morta.
- O `Ator` não tem `modulosAtivos`: o serviço lê a empresa para aplicar o gating.
- `revalidatePath`: inclua na lista de `executar()` todas as telas afetadas (lista, detalhe, matriz, dashboard).

**Não commitado no momento desta escrita** (commitar antes de começar coisa nova): Treinamentos MVP (migrações
`20260927700000_treinamentos_mvp` e `20260927800000_treinamentos_funcao_conscientizacao`, telas, testes, auditoria, funções).

**Backlog conhecido**
- Treinamentos: ASO + LGPD, bloqueio de alocação de inapto, crachá digital, ILUO, eSocial S-2220/S-2210.
- Segurança/infra: expurgo físico de anexos (retenção LGPD), rate limit por IP confiável, e-mail real em produção, deploy Vercel
  (Blob, `CRON_SECRET`, banco em nuvem), backup do Postgres, criptografia em nível de campo, agregações do dashboard no banco.
- Ideias de produto em `docs/ideias/` (fornecedores, calibração, gestão de mudanças, alta direção), **aguardando aprovação**.
- Evoluções de UX já desenhadas em `docs/06` ("Evolução Arquitetural de UX/UI"): vínculo Processo↔Documento (`ProcessoDocumento`),
  macroprocessos, RNC rápida em campo, `isCorrecaoImediata`, Ishikawa tipado, Kanban do plano, evidência obrigatória ao concluir
  item. Confirmar com o Eric antes de implementar.

---

## 13. Mapa de documentos

| Arquivo | Conteúdo |
|---|---|
| `docs/00-guia-do-projeto.md` | **Este guia** (visão geral e padrões) |
| `docs/00-status.md` | Status consolidado dos marcos iniciais (1–9) |
| `docs/01-schema-proposta.md` | Proposta original do schema e decisões dos marcos 1–4 |
| `docs/02-revisao-seguranca.md` / `03-revisao-final.md` | Revisões de segurança e correções aplicadas |
| `docs/04-propostas-design.md` | Direções de design A/B (A adotada) |
| `docs/05-guia-paginas-css.md` | **Obrigatório para UI:** estrutura de páginas, tokens, componentes, checklist |
| `docs/06-desenho-modulos.md` | **Registro oficial** de cada pacote entregue (schema, decisões, regras, telas, testes) |
| `docs/07-plano-implantacao-design.md` | **Plano do novo design** (sidebar, logos, fases por módulo, regras de execução) |
| `docs/tarefas/` | Tarefas técnicas aprovadas |
| `docs/ideias/` | Rascunhos — **não implementar sem ordem** |
| `docs/ideias/ideias_design/` | Design system proposto (teal) e prompts de mockup |
| `docs/ideias-implantadas/README.md` | O que dos rascunhos já foi implantado e o que ficou de fora |
| `AGENTS.md` / `CLAUDE.md` | Aviso sobre o Next 16 (ler os docs locais antes de usar APIs) |
