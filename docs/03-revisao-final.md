# Vigen — Revisão final (anexos, dashboard, notificações) — 2026-09-26

Nenhuma falha Crítica ou Alta. Isolamento preservado (cron usa prismaAdmin só para listar empresas). Upload/download robustos; segredo do cron comparado em tempo constante.

## Média
- M1 Cron diário: consulta acumula itens já tratados (sem orderBy, take 5000) → itens novos podem ficar sem alerta (`src/lib/notificacoes/cron.ts`).
- M2 LGPD: motivo/comentário de cancelamento e texto do item vão no e-mail, inclusive em RNC restrita (`gatilhos.ts`, `cron.ts`).
- M3 Upload após a transação: falha no armazenamento deixa RNC/verificação gravada e anexos perdidos ou erro confuso (`rncs/actions.ts`).
- M4 Reenvio de e-mails pode travar em notificações que nunca serão enviadas, reenviar backlog antigo e duplicar envio (`notificacoes/servico.ts`).

## Baixa
- B1 Upload sensível aceita RNC sem `contemDadosPessoais`.
- B2 `alterarResponsavel` não valida permissão/obra do novo responsável (pode abrir RNC restrita).
- B3 Arquivos lidos em memória antes de checar tamanho/permissão (até 52 MB).
- B4 Soft delete não expurga arquivo físico (retenção LGPD).
- B5 PDF inline pode ser bloqueado pelo CSP sandbox.
- B6 Rate limit por IP depende de proxy confiável.
- B7 Resumo semanal usa hora real, não o `agora` do cron.
- B8 Dashboard agrega em memória (escala).

## Correções aplicadas (2026-09-26)

### Revisão
- **M1** `cron.ts`: o filtro vai para o banco — `OR` entre atraso (`quando < hoje` e `atrasoNotificadoEm` nulo) e prazo (`hoje ≤ quando ≤ limite` e `alertaEnviadoEm` nulo), com `orderBy quando, id`. Itens já tratados não ocupam o lote.
- **M2** Nenhum texto livre em notificação/e-mail de RNC restrita **ou** com dados pessoais (`rncSensivel`, `rotuloRnc`, `descricaoItem` em `gatilhos.ts`; também no cron e em interações). Motivo e comentário de cancelamento nunca vão para notificação/e-mail ("Acesse o sistema…").
- **M3** `rncs/actions.ts`: falha de upload após criar RNC, verificação ou conclusão de item vira aviso não fatal (`anexarSemFalhar`), com orientação para anexar de novo pela seção de anexos (sem repetir a operação). Na criação, redireciona com `?aviso=anexos`, e a página mostra o aviso.
- **M4** `Notificacao.emailStatus` (PENDENTE/ENVIADO/IGNORADO/FALHOU) + `emailTentativas` + `emailTentativaEm`. IGNORADO quando o e-mail está desativado na empresa ou o usuário não tem endereço/está inativo. Antes de enviar, há um claim atômico (compare-and-swap em `emailTentativas`; claims de menos de 10 min não são retomados). O reenvio ordena por `criadoEm` e para após 3 tentativas. Migração `20260926055220_email_status_notificacao`: histórico com `email_enviado_em` → ENVIADO; o restante → IGNORADO (o backlog antigo não é reenviado).
- **B1** Anexo `RNC_DADOS_SENSIVEIS` só é aceito em RNC com `contemDadosPessoais`.
- **B2** `validarNovoResponsavel`: o responsável (na troca e na criação) precisa estar ativo, ter RNC_TRATAR e acesso à obra; se a RNC for restrita, também RNC_VER_RESTRITAS. A UI lista só os elegíveis.
- **B3** `prevalidarArquivos`: quantidade, tamanho declarado e permissão de envio são checados antes de `arrayBuffer()`. `enviarAnexos` checa a permissão antes de validar o conteúdo.
- **B5** PDF deixou de ser exibido inline e é sempre servido como attachment. A CSP `sandbox` continua para as imagens.
- **B7** O resumo semanal calcula os indicadores com o `agora` do cron (`carregarIndicadores(..., agora)`).

### Teste E2E
1. Seed: o colaborador ganha acesso à Obra Alfa (upsert idempotente). Os testes usam usuários próprios sem obra (`scripts/util-teste.ts`).
2. `CRON_SECRET` foi gerado no `.env` local (não versionado); o `.env.example` explica que é obrigatório e como gerar.
3. Quem solicitou o cancelamento não pode aprová-lo (serviço + UI; ainda pode rejeitá-lo).
4. Anexos de RNC ENCERRADA/CANCELADA não podem ser excluídos (serviço + `podeExcluir` na listagem). Isso também vale para anexos de item, plano e verificação da RNC.
5. Driver de e-mail: o padrão em produção continua sendo `console` (não envia); o aviso está no `.env.example`.
6. UX: Nova RNC e login mantêm os campos após erro (a action devolve os valores, usados como `defaultValue`). "Iniciar execução" só aparece com ≥1 item não cancelado no ciclo atual. O campo "Quem" lista só usuários ativos com acesso à obra da RNC. A coluna "Quanto" ficou mais larga.
7. Dashboard: os números estavam corretos. A "Eficácia na 1ª verificação" dava 0% porque todas as 8 RNCs encerradas foram reprovadas na 1ª verificação e aprovadas só na 2ª. "RNCs em aberto" é o estoque atual (qualquer data), enquanto os gráficos por obra/tipo/gravidade contam as RNCs registradas no período em qualquer status (inclusive encerradas/canceladas). Os rótulos foram deixados explícitos.

### Administração (`/configuracoes`, ADMIN_CONFIG)
Abas: Usuários (criar, editar papel/perfil/setor/escopo e obras, ativar/desativar, redefinir senha), Perfis (permissões por checkbox; perfis de sistema não são excluíveis), Obras/unidades, Setores (CRUD com ativo/inativo) e Notificações. Serviço em `src/lib/admin/servico.ts`, com validação zod. Toda mudança de acesso (papel, perfil, escopo, obras, e-mail, ativo, senha, permissões do perfil) incrementa `tokenVersao`. O admin não pode remover o próprio ADMIN/ADMIN_CONFIG nem desativar a si mesmo. O e-mail é único globalmente.

### Testes
`npm test` (+ `tests/revisao.test.ts`), `test:fluxo-rnc` (B2, autoaprovação), `test:anexos` (B1, B3, exclusão em RNC finalizada), `test:notificacoes` (claim M4, FALHOU/limite, IGNORADO, backlog), `test:admin` (novo), `test:isolamento`, `lint`, `build`.

## Pendências
- **B4** O soft delete de anexo não expurga o arquivo físico. Falta uma rotina de expurgo/retenção LGPD, com prazo configurável.
- **B6** O rate limit por IP depende de `x-forwarded-for` confiável. Falta configurar um proxy confiável ou limitar no edge.
- **B8** O dashboard agrega em memória. Com volume maior, migrar para agregações SQL (`groupBy`/views).
- Driver `console` em produção: e-mails não são enviados até configurar `EMAIL_DRIVER=smtp|resend`.
