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
| 8 | Rápido | **[Proposta]** 95% das páginas em até 1,5 s e gravações em até 1 s, em conexão comum | [Em aberto] os números |
| 9 | Seguro | Padrão OWASP ASVS como checklist (seção 5) | [Proposta] |

**Premissas que faltavam [Proposta]:** integração com o que a empresa já usa (a Monto usa MS Lists e SharePoint); LGPD, retenção e backup; uso em campo pelo celular; pacote comercial por módulo contratado; importação dos dados que hoje estão em planilhas.

## 3. Escopo da primeira versão

**[Decidido]** Módulos essenciais:
1. **Gestão de Documentos:** Lista Mestra, Tramitação de Documentos, Repositório de Documentos publicados.
2. **RNC** (Relatório de Não Conformidade).
3. **Plano de Ação Geral do SGI.**

**Fora da primeira versão [Proposta]:** Mapa de Processos (o fluxo validado em 03/10/2026 fica guardado em `docs/tarefas/04` e `05` e no artefato «Fluxos do Vigen»), Riscos, Perigos e Riscos, LAIA, Inspeções, Auditorias, Incidentes, Indicadores, Treinamentos, Gestão de Mudanças.

**Base comum que os três módulos precisam [Proposta]:** empresa, unidade e área; usuários, papéis e permissões; classificação de confidencialidade; atividades (assumir, devolver, prazo em dias úteis, vencimento); notificações; anexos; log de auditoria só de inclusão; glossário por empresa; visão em tabela.

**Ordem de construção dentro da primeira versão [Proposta]:** base comum, depois Plano de Ação (é o destino das ações de todos os outros módulos), depois RNC, depois Documentos (o de fluxo mais pesado: revisões, aprovação, publicação, cópia controlada).

## 4. Decisões registradas

| Data | Decisão |
|---|---|
| 05/10/2026 | Módulos da primeira versão: Documentos, RNC e Plano de Ação |
| 05/10/2026 | Login por e-mail da empresa com MFA próprio; SSO Microsoft é recomendado, não obrigatório |
| 05/10/2026 | O projeto começa pelo backend; o design vem depois, do Figma |
| 05/10/2026 | O Eric aprende TypeScript construindo, com Claude como guia (fases em «plano de aprendizado») |

## 5. Segurança: princípios desde o início

Segurança não é uma etapa no fim; molda as tabelas. **[Proposta]** princípios, a validar na etapa de arquitetura de segurança:
- **Isolamento entre empresas** na aplicação e também no banco (segurança por linha do PostgreSQL como segunda barreira).
- **Login por e-mail da empresa com MFA próprio** (aplicativo autenticador e códigos de recuperação). **[Em aberto]** se o MFA é obrigatório para todos ou só para administrador e qualidade, configurável por empresa. SSO Microsoft em uma fase seguinte.
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

## 9. Perguntas em aberto

1. Números definitivos de desempenho (premissa 8).
2. MFA obrigatório para quem? Configurável por empresa?
3. Nível do OWASP ASVS a seguir.
4. Prioridade dentro da primeira versão: confirmar a ordem Plano de Ação, RNC, Documentos.
5. Quais campos e listas de Documentos, RNC e Plano de Ação a empresa pode configurar já na primeira versão (depende das conversas do apêndice A).
6. Ponto de partida dos indicadores da seção 1.

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
