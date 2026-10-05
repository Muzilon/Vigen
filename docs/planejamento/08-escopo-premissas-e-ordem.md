# Escopo, premissas e ordem do projeto Vigen (versão nova)

**Estado:** rascunho vivo, 05/10/2026. Escrito por Claude a partir das respostas do Eric; o Eric decide e corrige.
**Marcas:** **[Decidido]** o Eric confirmou. **[Proposta]** sugestão minha, ainda sem resposta. **[Em aberto]** falta decidir.
Nada aqui é código. O projeto atual (`muzilon/vigen`) fica como referência e fonte de regras já validadas.

## 1. Objetivos e como medir

Objetivos **[Decidido]**: (1) ser reconhecido como o sistema que ajuda a gestão a entender e atender as normas ISO, com visão das informações, integração entre áreas e segurança da informação; (2) não só receber informação, mas ajudar a preencher e a analisar; (3) apoiar a comunicação e a cultura da gestão integrada.

Sem medida, objetivo vira slogan. **[Proposta]** indicadores, com o ponto de partida a levantar na Monto antes de ter sistema:

| Indicador | Ponto de partida |
|---|---|
| Planilhas usadas hoje para documentos, RNC e plano de ação | [a medir] |
| Tempo entre abrir e fechar uma RNC | [a medir] |
| Ações do plano concluídas dentro do prazo | [a medir] |
| Documentos com revisão vencida | [a medir] |
| Pessoas que entram no sistema pelo menos uma vez por semana | [a medir] |

## 2. Premissas do sistema

| # | Premissa do Eric | Como virar requisito | Estado |
|---|---|---|---|
| 1 | Fácil de entender e usar | Tarefa comum em poucos cliques; teste com 3 usuários reais antes de fechar cada tela | [Proposta] |
| 2 | Design moderno e compreensível | Design system próprio, definido antes das telas finais | [Decidido] a premissa |
| 3 | Lógicas bem pensadas para o usuário | Fluxo desenhado e validado por módulo antes de codar | [Decidido] |
| 4 | Confidencialidade definida por nós e pelo cliente | Classificação de informação (público, interno, restrito, confidencial), por registro e por campo; parte configurável pelo cliente | [Proposta] |
| 5 | Facilmente modificável para o cliente | Três níveis de configuração (seção 6) | [Proposta] |
| 6 | Termos configuráveis por empresa | Glossário por empresa (ex.: HIRA vira «Perigos e Riscos» na Monto) | [Decidido] |
| 7 | Reduzir planilhas; visão em tabela como Excel | Visão em tabela como recurso único da plataforma: filtros, ordenação, colunas escolhidas, visões salvas, exportação | [Decidido] a premissa |
| 8 | Rápido | 95% das páginas em até 1,5 s e gravações em até 1 s, em conexão comum. Medir desde o primeiro dia e ter um painel de desempenho (tempo de resposta, erros, disponibilidade) | [Decidido] as metas; painel a desenhar |
| 9 | Seguro | Padrão OWASP ASVS como checklist (seção 5) | [Proposta] |

**Premissas que faltavam [Proposta]:** integração com o que a empresa já usa (a Monto usa MS Lists e SharePoint); LGPD, retenção e backup; uso em campo pelo celular; pacote comercial por módulo contratado; importação dos dados que hoje estão em planilhas.

## 3. Escopo da primeira versão

**[Decidido]** Módulos essenciais:
1. **Gestão de Documentos:** Lista Mestra, Tramitação de Documentos, Repositório de Documentos publicados.
2. **RNC** (Relatório de Não Conformidade).
3. **Plano de Ação Geral do SGI.**

**Fora da primeira versão [Proposta]:** Mapa de Processos (o fluxo validado em 03/10/2026 fica guardado em `docs/tarefas/04` e `05` e no artefato «Fluxos do Vigen»), Riscos, Perigos e Riscos, LAIA, Inspeções, Auditorias, Incidentes, Indicadores, Treinamentos, Gestão de Mudanças.

**Base comum que os três módulos precisam [Proposta]:** empresa, unidade e área; usuários, papéis e permissões; classificação de confidencialidade; atividades (assumir, devolver, prazo em dias úteis, vencimento); notificações; anexos; log de auditoria só de inclusão; glossário por empresa; visão em tabela.

**Ordem de construção dentro da primeira versão [Decidido em 05/10/2026]:** base comum, depois Plano de Ação (é o destino das ações de todos os outros módulos), depois RNC, depois Documentos (o de fluxo mais pesado: revisões, aprovação, publicação, cópia controlada). **Atenção:** a maior dor da Monto é a tramitação de documentos, que fica por último. **[Proposta]** ao fim do Plano de Ação reavaliar se antecipamos a tramitação, e mostrar cedo um protótipo de baixa fidelidade dela (Figma) para manter o patrocinador engajado.

## 4. Decisões registradas

| Data | Decisão |
|---|---|
| 05/10/2026 | Módulos da primeira versão: Documentos, RNC e Plano de Ação |
| 05/10/2026 | Login por e-mail da empresa; SSO Microsoft é recomendado, não obrigatório |
| 05/10/2026 | MFA obrigatório para todos, por **código enviado por e-mail** (não por aplicativo). Riscos e proteções na seção 5 |
| 05/10/2026 | Ordem da primeira versão: base comum, Plano de Ação, RNC e depois Documentos |
| 05/10/2026 | Modelo comercial pretendido: contrato de uso (assinatura) para empresas que atendem ISO 9001, 14001 e 45001. A confirmar: assinatura ou licença; preço a pesquisar |
| 05/10/2026 | Metas de desempenho da premissa 8 aceitas; será preciso um painel de desempenho do sistema |
| 05/10/2026 | O pacote Documentos, RNC e Plano de Ação chama-se **Fase 1**; será mostrado ao cliente quando estiver completo. Meta: fevereiro de 2027, com revisão após as 6 primeiras semanas |
| 05/10/2026 | Método **híbrido**: agentes escrevem a maior parte do código; o Eric revisa, entende e escreve as partes centrais, guiado; toda entrega vem com explicação |
| 05/10/2026 | Segurança mais forte para Qualidade e administrador: aplicativo autenticador (TOTP) na Fase 1; chave de acesso (passkey) depois |
| 05/10/2026 | Dois painéis: técnico (só nós) e de adoção (o administrador do cliente também vê) |
| 05/10/2026 | OWASP ASVS: meta no nível 2; nível 1 como mínimo antes do primeiro uso real |
| 05/10/2026 | Configurável na Fase 1: listas (tipos de documento, origens e classes de RNC, unidades, áreas) e glossário de termos. Fluxos e aprovadores ficam fixos |
| 05/10/2026 | O projeto começa pelo backend; o design vem depois, do Figma |
| 05/10/2026 | O Eric aprende TypeScript construindo, com Claude como guia (fases em «plano de aprendizado») |
| 05/10/2026 | Aprovador da reprogramação de prazo: papel «Gestor da Qualidade», atribuído pelo administrador (é permissão, não fluxo configurável). Pedido sempre passa por aprovação, inclusive o do próprio gestor |
| 05/10/2026 | Público-alvo: gestão do SGI (corporativo), não controle operacional de campo; o campo entra só se a empresa configurar. Regras dos três módulos no doc 10 |
| 05/10/2026 | **Ideia, fora da Fase 1:** acesso de «Cliente» (parte externa) com visão básica e restrita, opcional por empresa e não recomendado por padrão. Motivo: evitar que a empresa empreste o login de um funcionário. Pré-requisitos: confidencialidade por registro, isolamento por parte externa, termo de uso e revisão de segurança |

## 5. Segurança: princípios desde o início

Segurança não é uma etapa no fim; molda as tabelas. **[Proposta]** princípios, a validar na etapa de arquitetura de segurança:
- **Isolamento entre empresas** na aplicação e também no banco (segurança por linha do PostgreSQL como segunda barreira).
- **Login por e-mail da empresa e MFA obrigatório para todos [Decidido]**, com código enviado por e-mail. SSO Microsoft em uma fase seguinte.
  - **Limite conhecido:** se o código vai para o mesmo e-mail que é o login, quem tomar a caixa de e-mail (phishing, por exemplo) recebe o link de recuperação e o código. Na prática é um fator só. Diretrizes de autenticação (NIST SP 800-63B) desaconselham e-mail como segundo fator. A segurança real depende de a caixa de e-mail da empresa ter a própria proteção (por exemplo MFA do Microsoft 365).
  - **Proteções mínimas [Proposta]:** código de 6 a 8 dígitos, validade curta (10 minutos), uso único, no máximo 5 tentativas, limite de reenvios, ligado à tentativa de login; aviso por e-mail ao entrar de um dispositivo novo; recuperação de conta de administrador e Qualidade só com confirmação adicional; recusar e-mails genéricos ou compartilhados; fallback quando o e-mail atrasar ou falhar.
  - **Desenho [Proposta]:** o segundo fator é um componente trocável (e-mail hoje; aplicativo autenticador, chave de acesso e SSO depois), sem reescrever o login.
- **Autorização** por papel, unidade, área e classificação da informação.
- **Dados:** criptografia em trânsito e em repouso; campos sensíveis protegidos; backup testado.
- **Log de auditoria** só de inclusão: quem fez o quê e quando.
- **Aplicação:** validação de toda entrada, limite de tentativas, segredos fora do código, varredura de dependências, teste de invasão antes de vender.
- **Checklist:** OWASP ASVS (nível a escolher).

## 6. Configurabilidade em três níveis

1. **Textos:** glossário por empresa. Barato; entra desde a primeira versão **[Proposta]**.
2. **Campos e listas:** obrigatório ou opcional, listas de valores (tipos de documento, classes de RNC). Custo médio **[Proposta]** para a primeira versão, apenas onde as conversas com outras empresas mostrarem necessidade.
3. **Fluxos e aprovadores:** quem aprova, quantos níveis, prazos. O mais caro; começamos com padrões fixos por módulo e abrimos configuração depois **[Proposta]**.

## 7. Ordem do projeto

| # | Etapa | Observação |
|---|---|---|
| 0 | Escopo, premissas com número, métricas; conversas com pessoas de qualidade de outras empresas | Este documento. Conversas sem data (apêndice A) |
| 1 | Princípios transversais: segurança, confidencialidade, configuração, desempenho | Seções 2, 5 e 6 |
| 2 | Fluxos dos 3 módulos, com wireframes de baixa fidelidade | Fluxos por Figma (Eric); Claude estrutura |
| 3 | Catálogo de regras de integração e regras comuns | Evento, condição, ação; atividade; log; notificação; visão em tabela |
| 4 | Papéis, permissões e confidencialidade | Antes das tabelas |
| 5 | Modelo de dados: base comum primeiro, depois cada módulo | O schema atual é referência |
| 6 | Tecnologia, por critérios | Hoje a sugestão é TypeScript, Node, PostgreSQL e Prisma |
| 7 | Arquitetura de segurança detalhada | Começa na etapa 1 |
| 8 | Design system e telas finais | Depois dos fluxos e wireframes |
| 9 | Migração de dados, testes, ambientes, backup, monitoramento | |
| 10 | Roadmap e versões seguintes | |

**Regra:** cada etapa tem um tempo máximo combinado, para não virar análise sem fim. **Cache** só entra depois de medir onde está lento (primeiro índices e consultas bem escritas).

## 8. Lógicas de integração (catálogo inicial)

Padrão único **[Proposta]**: **evento → condição → ação para papéis**, com uma notificação só quando a mesma pessoa tem vários papéis.

Exemplo do Eric (Gestão de Mudanças, fora da primeira versão, mas o padrão vale para tudo): mudança criada; se estrutural, o sistema sugere ações no plano e avisa Meio Ambiente e Segurança do Trabalho; Qualidade, Segurança e Meio Ambiente recebem a mudança (às vezes é a mesma pessoa).

Dentro da primeira versão **[Proposta]**:
- RNC aprovada gera itens no Plano de Ação.
- Ação do plano concluída fecha o ciclo de eficácia da RNC.
- Documento publicado notifica o público definido e pede ciência.
- Documento com revisão vencendo gera atividade para o responsável.
- Atividade vencida avisa a Qualidade e sobe de urgência.

Para as etapas seguintes: auditoria, inspeção ou incidente grave abre RNC; indicador fora da meta sugere ação; treinamento vencido altera a aptidão; calibração vencida bloqueia o uso do equipamento; fornecedor reprovado abre RNC; mudança pede reavaliação de riscos, treinamentos e documentos ligados.

## 9. Perguntas

**Respondidas em 05/10/2026:** painéis de desempenho (dois), fator forte para Qualidade e administrador (TOTP, passkey depois), nível do ASVS (meta 2, mínimo 1), tramitação (ponto de reavaliação ao fim do Plano de Ação), o que é configurável na Fase 1 (listas e glossário).

**Em aberto:**
1. **Ponto de partida dos indicadores** (seção 1): o Eric levanta na Monto os cinco números (planilhas usadas; RNC por mês; tempo médio para fechar uma RNC; percentual de ações no prazo nos últimos 6 meses; documentos vigentes e quantos com revisão vencida).
2. **Data exata de fevereiro** (início, meio ou fim do mês).
3. Campos extras configuráveis: dependem das conversas do apêndice A.

## 10. Fase 1: meta e plano das primeiras 6 semanas

**Meta:** Documentos, RNC e Plano de Ação em fevereiro de 2027, mostrados ao cliente quando estiverem completos.
**Aritmética [Proposta]:** a estimativa híbrida é de 260 a 350 horas de trabalho do Eric. Entre 5/10/2026 e fevereiro há de 17 a 21 semanas corridas, menos as festas de fim de ano. Cabe em fevereiro com cerca de 12 a 21 horas por semana. Com 10 horas por semana, não cabe.
**Revisão em 15/11/2026:** com as horas reais medidas nas 6 primeiras semanas, refazemos a conta e decidimos o que entra em fevereiro: o essencial de cada módulo, ou o completo de alguns.

**Plano das 6 primeiras semanas [Proposta]:**
| Semana | O que o Eric aprende | O que fica funcionando |
|---|---|---|
| 1 | Terminal, git, VS Code, primeiro programa | Repositório novo; programa que imprime a data de hoje |
| 2 | JavaScript: funções, listas, objetos, módulos | Cálculo de dias úteis com feriados, em JavaScript |
| 3 | TypeScript: tipos e testes (vitest) | O mesmo cálculo em TypeScript, com testes verdes |
| 4 | Banco de dados: PostgreSQL local e Prisma | Tabelas de empresa, unidade e área; consultas |
| 5 | API: rotas, validação, erros | Cadastro de áreas e feriados pela API, com testes |
| 6 | Usuários e permissões; login com código por e-mail | Primeiro login; medição das horas e revisão da meta |

**Como cada entrega vem explicada:** (1) o que foi feito e para quê, em linguagem simples; (2) cada termo novo no glossário do projeto; (3) como rodar e como testar; (4) um exercício curto de verificação que o Eric faz sozinho antes de seguir.

## 11. Propriedade, exclusividade e confidencialidade (a esclarecer por escrito)

**Contexto [Decidido pelo Eric em 05/10/2026]:** o produto será vendido a outras empresas; a Monto será o primeiro cliente de teste e receberá o sistema com outro nome. O Eric apresentará a ideia à Monto em 05/10/2026 para formalizar o acordo.
**Isto não é parecer jurídico.** É a lista de perguntas a levar à diretoria da Monto e, se o Eric achar necessário, a um advogado trabalhista e de propriedade intelectual.

| # | Pergunta | Estado |
|---|---|---|
| 1 | Quem é dono do código e do produto, considerando uso de equipamento e horário da Monto? | Intenção do Eric (05/10/2026): o produto é dele e a Monto não paga. **A formalizar por escrito com a Monto** |
| 2 | Em que condições a Monto usa o sistema como cliente (licença, prazo, continuidade)? | [Decidido] a Monto será cliente; condições a formalizar |
| 3 | O contrato do Eric tem exclusividade ou não concorrência que impeça vender software de gestão da qualidade? | O Eric acredita que não; **confirmar lendo o contrato** |
| 4 | Procedimentos, fluxogramas e documentos internos da Monto podem inspirar o produto? Até onde? | [Decidido] usar conteúdo genérico |
| 5 | LGPD: com dados reais de funcionários da Monto, qual contrato de tratamento de dados vale? | Entendido; contrato a fazer antes de dados reais |

**Regra de transparência [Proposta]:** o que usar horário, equipamento ou qualquer recurso da Monto é declarado e combinado por escrito; o que for feito no tempo e no equipamento do Eric não depende de autorização. Não há trabalho escondido.

**Regras de trabalho até a resposta [Proposta]:** código novo no computador pessoal, ou no da empresa com ciência de quem decide; repositório privado na conta pessoal do Eric; nenhum dado, documento, nome ou logotipo reais da Monto no projeto novo; dados de exemplo gerados; fluxos modelados a partir das regras gerais da ISO e das ideias do Eric, sem copiar procedimentos internos da Monto passo a passo.

**Atualização de 05/10/2026 (após a apresentação à Monto):** o slide «O que precisamos combinar» **não foi apresentado**. O Eric comentou, em conversa, com a sua gerente sobre usar o notebook da empresa e adiantar parte do trabalho; ela respondeu que não há problema, **sem nada por escrito**, e que a conversa continuará. Ela sugeriu que, se for vender, o Eric avalie um valor com base no mercado. **Pendências:** (1) formalizar por escrito; (2) esclarecer quem seria o comprador e o que seria vendido (licença, assinatura, propriedade) antes de precificar; (3) o Plano de Ação atual da Monto foi criado pelo Eric e pela gerente quando trabalhavam juntos em outra empresa: confirmar de quem é o modelo antes de reutilizá-lo; o método 5W2H em si é público.

## Apêndice A. Roteiro de conversa com pessoas de qualidade de outras empresas (30 min)

Pedir só **processo e opinião**; nunca pedir documentos, dados de pessoas ou registros reais da empresa.
1. Hoje, como a empresa controla documentos, RNC e plano de ação (sistema, planilha, papel)?
2. Quantas pessoas usam, e quem aprova documentos? Quantos níveis de aprovação?
3. Como os documentos são codificados e versionados?
4. Quais etapas tem a RNC (abertura, análise de causa, ações, eficácia)? Quem participa de cada uma?
5. Como é o plano de ação (formato, prazo, quem cobra)?
6. O que mais dói ou mais consome tempo hoje?
7. Que nomes diferentes a empresa usa para as mesmas coisas?
8. Que regras de acesso e confidencialidade existem?
9. Que integrações seriam necessárias (e-mail, Teams, SharePoint, ERP)?
10. O que seria decisivo para trocar o que usam hoje?
