# Riscos e decisões do Vigen

**Criado em:** 01/10/2026 · **Revisão:** a cada relatório de acompanhamento · Plano: [01-plano-mestre.md](01-plano-mestre.md)
Matriz: Alta × Alta = Crítico; Alta × Média ou Média × Alta = Alto; Média × Média, Alta × Baixa ou Baixa × Alta = Médio; demais = Baixo. Todos os riscos estão **Abertos**; revisão da rodada 2 em 01/10/2026 (R-01 atualizado, R-03 rebaixado, R-19 e R-20 novos).

## 1. Registro de riscos
| ID | Risco | Prob. | Impacto | Nível | Resposta | Dono | Itens |
|---|---|---|---|---|---|---|---|
| R-01 | Janela flutuante e conclusão de ações **não verificadas no navegador**; **3 falhas confirmadas em 01/10** (sem evidência, status fora do prazo, download na janela de Documento); base instável para o redesign | Alta | Alta | **Crítico** (atualizado 01/10) | Reduzir: corrigir TR-013, TR-014 e BE-013, depois o Eric reteste e conclui os testes do relatório antes das telas novas; nada é concluído sem eles | Eric (testes), `agente-qa-revisao` | TR-001 a TR-005, TR-013, TR-014, BE-013 |
| R-02 | Arquivos sem armazenamento persistente em produção (Blob não configurado): download "Não encontrado" e **perda de anexos** | Alta | Alta | **Crítico** | Reduzir: configurar Blob e testar download em produção | Eric, `agente-arquitetura-dados` | BE-001 |
| R-03 | Credenciais: senha do banco **já trocada** (D-02, 01/10); resta a senha `vigen123` dos usuários de teste, que o Eric troca no Neon | Baixa | Alta | Médio (rebaixado 01/10; era Crítico) | Reduzir: Eric executa TR-016; PMO só rastreia e confere a variável na Vercel (BE-002) | Eric | TR-016, BE-002 |
| R-04 | Regra de negócio quebrada durante o redesign ("só apresentação" violado, ex.: ao mexer em formulários e confirmações) | Média | Alta | Alto | Reduzir: 230 testes + scripts de fluxo a cada módulo, um commit por módulo, QA antes do Eric, parar e perguntar se o design exigir dado novo | `agente-qa-revisao` | FE-006 a FE-011, TR-012 |
| R-05 | Perda de dados por falta de backup do Postgres e de política de retenção | Média | Alta | Alto | Reduzir: rotina de backup e restauração testada | `agente-arquitetura-dados` | BE-006 |
| R-06 | LGPD: anexos excluídos sem expurgo físico; RNC restrita com dados pessoais; sem criptografia por campo | Média | Alta | Alto | Reduzir: expurgo e política de retenção; decidir criptografia; manter regra de não expor texto restrito em notificações | `agente-integridade-dados` | BE-007, BE-012, teste 3.10 |
| R-07 | Eric como gargalo: único a testar no navegador e decidir; fila de decisões trava os agentes | Alta | Média | Alto | Reduzir: agrupar perguntas, roteiros de teste curtos, limite de trabalho em andamento, pedir ajuda de um segundo testador se possível | PMO, Eric | D-01..D-14 |
| R-08 | Design incompleto: faltam quadros (cabeçalho, avisos, estados, Configurações); telas inconsistentes ou retrabalho | Média | Média | Médio | Reduzir: regra do doc. 07 §6 e mostrar ao Eric antes de aplicar o que for inventado | `agente-ux-ui` | FE-001..FE-004 |
| R-09 | Acessibilidade: tons claros da escala teal (ex.: 400) provavelmente não atingem contraste 4,5:1 para texto sobre branco; sidebar por hover | Média | Média | Médio | Reduzir: validar contraste ao aprovar tokens; clique como comportamento principal | `agente-feedback-acessibilidade` | TR-009, FE-012 |
| R-10 | Limites do plano Hobby da Vercel (cron, tempo de função, tamanho de envio) e do plano gratuito do Neon (armazenamento, retenção, suspensão) afetam alertas, uploads e desempenho | Média | Média | Médio | Reduzir: conferir limites nas páginas oficiais antes de BE-008 e de uploads grandes; plano B é migrar de plano | `agente-arquitetura-dados` | BE-008, BE-010 |
| R-11 | Dívida técnica: 10 erros de eslint em código de outra origem; scripts de integração sem casos novos | Média | Média | Médio | Reduzir: TR-008 e BE-003 em M1 | `agente-qa-revisao` | TR-008, BE-003 |
| R-12 | Incoerência entre agentes (commits misturados, tokens soltos, comentários desatualizados) | Média | Média | Médio | Reduzir: DoD, regras do doc. 07 §7, revisão do QA por módulo | `agente-qa-revisao` | TR-012 |
| R-13 | Desvio do banco local por `migrate dev` (pede reset) e esquecimento de `migrate deploy` em produção | Média | Alta | Alto | Evitar: usar `migrate diff` + `migrate deploy`, nunca resetar; checklist de deploy | PMO, `agente-arquitetura-dados` | BE-011 |
| R-14 | Registros por efeito colateral (import de handlers de aprovação e fontes de reavaliação): esquecer o import mata a funcionalidade em silêncio | Baixa | Alta | Médio | Reduzir: caso de teste de integração que acuse a falta | `agente-integridade-dados` | BE-003 |
| R-15 | Licença dos ícones UIcons (plano gratuito exige crédito) | Média | Baixa | Baixo | Evitar: decidir crédito ou plano pago antes de publicar | Eric | TR-010 |
| R-16 | Cota do Figma e arquivos de design fora do git (55 MB): perda ou desatualização da referência | Baixa | Média | Baixo | Aceitar/reduzir: manter a exportação em local seguro; evitar novas chamadas ao Figma | Eric | PR-1 |
| R-17 | Plano e ClickUp divergem ou ClickUp é criado em área errada | Baixa | Baixa | Baixo | Evitar: criar só depois da aprovação, em área nova; relatório confere ambos | PMO | M0 |
| R-19 | **RESOLVIDO em 01/10/2026 (rodada 4).** O espaço "Vigen" (id 901314639679) ficou visível no workspace 9013448793 depois que o Eric reautorizou o conector. Estrutura criada (06, seção 4.7). Histórico: na rodada 3 o espaço não aparecia e nada foi criado | Alta | Baixa | Baixo (Resolvido) | Encerrado | Eric, PMO | 06 seções 4.7 e 6 |
| R-21 | ClickUp: o conector tem **limite diário de 100 chamadas**; o lote completo (cerca de 100 tarefas, tags e dependências) não cabe em um dia. Risco de a criação ficar parcial e de duplicar tarefas se a retomada não conferir o que existe | Alta | Média | Alto | Reduzir: trabalhar em etapas diárias na ordem do doc. 06; conferir o mapeamento (06, seção 6) antes de criar; usar uma chamada por tarefa (sem retentativas); o Eric pode subir de plano se quiser acelerar | PMO | 06 seção 4.7 |
| R-20 | Função nova junto com visual (fluxo de design por tela) vira escopo escondido e quebra regra de negócio | Média | Alta | Alto | Reduzir: função nova vira subtarefa com solicitação de mudança, teste e QA; "só apresentação" vale até o Eric aprovar a função | PMO, `agente-qa-revisao` | FE-020 a FE-035 |
| R-18 | Escopo cresce (ideias de `docs/ideias/`, mockups sem lastro) durante o redesign | Média | Média | Médio | Reduzir: backlog separado, solicitação de mudança, regra "o que sai?" | PMO, Eric | D-13 |

## 2. Decisões que dependem do Eric
Sugestão do PMO em cada linha. "Bloqueia" indica o que não anda sem a resposta.

| ID | Decisão | Sugestão do PMO | Bloqueia | Prioridade |
|---|---|---|---|---|
| D-01 | Aprovar o plano mestre (escopo, marcos, DoD) | Aprovar com ajustes | M0 | Alta |
| D-02 | Segurança em produção: trocar senha do banco (e atualizar na Vercel) e **o que fazer com usuários de teste e a senha `vigen123`** (trocar, desativar ou manter só em ambiente de teste) | Fazer agora, antes de convidar qualquer pessoa real | BE-002 | **Urgente** |
| D-03 | Estrutura do ClickUp: Opção A (novo espaço "Vigen") ou B (pasta Projetos em Indicadores do SGI)? O que é "Projeto 1" e "Projeto 2"? | Opção A | Criação das tarefas | Alta |
| D-04 | Aprovar tokens novos do `base.css` (alvo de toque, sombra, fundo escuro da janela) | Aprovar | TR-009, FE-002 | Normal |
| D-05 | Ícones Flaticon: assinar plano sem crédito ou criar página/rodapé de créditos | Rodapé de créditos agora (custo zero) | TR-010, publicação | Normal |
| D-06 | Documentos: restaurar o envio antigo ou ligar o novo `UploadAnexo` de verdade | Ligar o novo | BE-004 | Normal |
| D-07 | Confirmar antes de fechar a janela com formulário preenchido (Esc e clique fora hoje descartam) | Sim, só quando há alteração | TR-006 | Normal |
| D-08 | E-mail real: provedor (SMTP ou Resend), remetente e se entra agora ou depois | Depois de M1 | BE-005 | Normal |
| D-09 | Retenção LGPD (prazo de expurgo de anexos), backup do Postgres (onde e quanto tempo) e criptografia por campo (sim/não/quando) | Backup e expurgo em M6; criptografia só se houver dado sensível real | BE-006, BE-007, BE-012 | Normal |
| D-10 | Extras opcionais: busca global (Ctrl+K), sidebar em trilho, abrir por hover | Fora até M5 | FE-013 | Baixa |
| D-11 | **Prioridade:** estabilizar (M1) antes de continuar o redesign (M3 em diante)? | Sim | Início de M3 | Alta |
| D-12 | **Prazos e capacidade:** existe data-alvo para algum marco? Quantas horas por semana o Eric tem para testar e decidir? | Informar para virar cronograma | Datas no ClickUp | Alta |
| D-13 | Itens de mockup sem lastro no código (exportar CSV, filtro "somente atrasadas", saudação no Início, seletor de período etc.) e evoluções do doc. 06: entram no projeto ou ficam no backlog? | Backlog | Escopo do front | Baixa |
| D-14 | Confirmar que P1 a P4 do doc. 07 **estão respondidas** como o §9 do documento registra (teal e Inter, só texto no HIRA, campos de requisito legal ficam, sidebar por clique com as categorias definidas) e que o `README.md` de `ideias_design/` (vazio) não traz regra adicional | Confirmar | Plano 02 | Alta |
| D-15 | O pedido citava "mudança de design ainda não entregue por inteiro": o que mais o Eric vai entregar (quadros do cabeçalho, avisos, Configurações...) e quando? | Informar lista e previsão | Plano 02 | Alta |

### 2.1 Respostas do Eric (rodada 2, 01/10/2026)
| ID | Situação | Resposta registrada |
|---|---|---|
| D-01 | **Respondida** 01/10/2026 | Plano mestre aprovado, com atualização obrigatória: fluxo de design por tela (06, seção 1). |
| D-02 | **Respondida** 01/10/2026 | Senha do banco no Neon já trocada. As senhas `vigen123` dos usuários de teste o Eric troca direto no Neon. Rastreio: TR-016 (Eric). Deixa de ser risco crítico do PMO (R-03 rebaixado). |
| D-03 | **Respondida** 01/10/2026 | Opção A: espaço "Vigen", pasta "Projeto Vigen 2026", listas 01 a 04 e "Decisões do Eric". Execução pendente: Eric cria o espaço (06, seção 5). |
| D-11 | **Respondida** 01/10/2026 | Estabilizar (M1) vem antes do redesign; o Eric executa por tarefa. |
| D-12 | **Respondida** 01/10/2026 | Atividades com bastante folga; datas provisórias; o Eric ajusta e o PMO verifica (06, seção 3). Capacidade em horas não informada (segue pergunta aberta, sem bloquear). |
| D-14 | **Respondida, com sidebar reaberto** 01/10/2026 | P1 a P4 do doc. 07 valem como registradas, **exceto o sidebar**: o Eric não gostou do atual e vai redesenhá-lo; prioridade (FE-014). Abre D-16. |
| D-15 | **Respondida** 01/10/2026 | O que falta (cabeçalho, avisos, Configurações etc.) será tratado junto com todas as telas, na verificação do Eric, que também testa as funcionalidades. |

**Novas decisões abertas:**
| ID | Decisão | Sugestão do PMO | Bloqueia | Prioridade |
|---|---|---|---|---|
| D-16 | Novo desenho do sidebar/navegação (Figma e exportação): quando e com quais categorias | Eric informa quando exportar; até lá FE-014 aguarda | FE-014, FE-001 | **Alta** |
| ~~D-17~~ | **Respondida em 01/10/2026 (rodada 3)**, ver 2.3 | | | |

Abertas das originais: D-04 a D-10 e D-13. Abertas no total: D-04 a D-10, D-13 e D-16.

### 2.3 Respostas do Eric (rodada 3, 01/10/2026)
| ID | Situação | Resposta registrada |
|---|---|---|
| D-17 | **Respondida** 01/10/2026 | "Concluído fora do prazo" **conta como ação concluída**. É uma segunda informação (dentro ou fora do prazo) que mede o **atendimento ao prazo**. Não precisa gerar notificação, mas precisa estar **catalogado** (registrado e consultável/medível). Implementação do agente principal: etiqueta laranja "Concluído fora do prazo"; o status do item continua CONCLUIDO; fora do prazo = data de conclusão maior que o prazo. Efeitos no plano: TR-014 atualizado (critério 4 resolvido, sem notificação) e nova tarefa BE-014 (indicador de atendimento ao prazo). |
| BE-001 | **Priorizada** 01/10/2026 | Armazenamento de arquivos (ARMAZENAMENTO=blob + BLOB_READ_WRITE_TOKEN na Vercel) vira atividade **prioritária (Urgente)**, dono Eric, "Pronto para fazer". O Eric faz quando tiver tempo; **o projeto segue em paralelo**. BE-013 passa a depender de BE-001. Passo a passo na descrição da tarefa (ver 06, seção 4.2). |

Observação do PMO: o Eric será o único a executar BE-001; enquanto não for feito, R-02 continua Crítico e os testes 1.6 e 1.7 e BE-013 (critério 5) não fecham.

## 2.2 Falhas da rodada de testes de 01/10/2026 (informadas pelo Eric)
1. Etiqueta/aviso "concluído sem evidência" não funcionou: TR-013.
2. Justificativa de data funcionou; falta o status "Concluído fora do prazo" em laranja (função nova): TR-014.
3. Janela flutuante de Documento: baixar revisão cai em tela preta com texto do servidor e, ao voltar, retorna ao detalhe: BE-013.
O agente principal está corrigindo; as três tarefas ficam em andamento/revisão e **só fecham após reteste manual do Eric**.

## 3. Perguntas de informação (sem decisão, só dados)
1. **Falhas de 01/10:** quais testes não funcionaram? (TR-001)
2. Há dados reais em produção hoje ou só seed e testes?
3. Quem mais, além do Eric, testará no navegador?
4. O uso da Vercel Hobby é aceito para este sistema (cláusula de uso não comercial)? O plano pago entra no horizonte?

## 4. Histórico de decisões já tomadas (para rastro; fonte: [doc. 07](../07-plano-implantacao-design.md))
Requisitos Legais descontinuado e migração aplicada (30/09/2026) · paleta teal e Inter · HIRA só renomeada no texto · campos "requisito legal" de Perigos e Riscos e LAIA permanecem · sidebar por clique, com categorias por área · Documentos em Gestão · "Auditoria" aparece uma vez · logo principal no login.
