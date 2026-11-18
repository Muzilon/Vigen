# Como o Vigen foi desenhado: guia para quem vai montar um sistema de RH

**Para quem é:** um colega que está criando, com a ajuda do Claude, um sistema de RH para a empresa onde trabalha, e que não é programador.
**Autor:** Eric, com o Claude. Data: 18/11/2026.
**Como ler:**
- Cada seção traz primeiro **o que fizemos no Vigen** e depois **o que isso significa para o sistema de RH**.
- No fim há uma lista de pedidos prontos para colar no Claude.
- Marcas de confiança: **[Certo]** = testado no Vigen; **[Provável]** = inferência sólida; **[Chutando]** = precisa confirmar.

---

## 0. Três verdades antes de começar

1. **Dados de RH são os mais sensíveis que uma empresa guarda.** [Certo] A LGPD trata como *dado pessoal sensível* informações de saúde (atestados, ASO, CID), biometria, filiação sindical, origem racial e religião. Salário, CPF, conta bancária e endereço não entram nessa categoria, mas são dados pessoais e exigem cuidado. Um vazamento disso é incidente que precisa ser comunicado à ANPD e aos titulares. O Vigen guarda dados menos sensíveis e mesmo assim mais da metade do esforço foi em segurança.
2. **A infraestrutura deve ser da empresa, não sua.** [Provável] Se o sistema vai guardar dados de funcionários, as contas de hospedagem, banco de dados, e-mail e repositório de código devem estar no nome da empresa, aprovadas pela TI e pelo encarregado de dados (DPO). Contas pessoais criam três problemas: a empresa não controla quem acessa; se você sair, o sistema vai junto; e um incidente vira responsabilidade sua. Aprovação do projeto não é aprovação para guardar dados de RH em contas pessoais: confirme isso por escrito.
3. **"Funciona na tela" não quer dizer "está seguro".** [Certo] No Vigen, toda etapa passou por uma revisão de segurança separada antes de ser dada como pronta. Nessas revisões apareceram erros que a tela não mostrava, como mensagens de erro vazando detalhes internos e uma corrida em que dois cliques ao mesmo tempo burlavam um limite. Peça essa revisão ao Claude em toda etapa (ver seção 9).

---

## 1. A estrutura geral (o "esqueleto")

| Peça | No Vigen | Para que serve | Custo hoje |
|---|---|---|---|
| Linguagem | TypeScript | JavaScript com verificação de tipos: o computador avisa erros antes de rodar | grátis |
| Framework | Next.js 16 | Telas e servidor no mesmo projeto | grátis |
| Banco de dados | PostgreSQL (no Neon) | Onde os dados moram | plano grátis |
| Acesso ao banco | Prisma | Tradutor entre o código e o banco; guarda a estrutura das tabelas em um arquivo | grátis |
| Hospedagem | Vercel | Onde o sistema fica no ar | plano grátis (não comercial) |
| E-mail | Resend | Envia o código de login | pago por uso |
| Código | GitHub | Guarda o código e o histórico de cada mudança | grátis |
| Testes automáticos | Vitest + GitHub Actions | A cada mudança, roda os testes sozinho e avisa se algo quebrou | grátis |

**Para o sistema de RH:**
- [Provável] A mesma estrutura serve. Se a empresa já usa Microsoft 365 ou Google Workspace, a TI pode preferir Azure ou Google Cloud. Pergunte à TI antes de escolher.
- [Certo] **Use um banco relacional (PostgreSQL) e não planilhas ou bancos "sem estrutura".** Dados de RH têm regras: um funcionário pertence a um cargo e o cargo a uma área. O banco precisa garantir essas regras sozinho, sem depender do código lembrar.

---

## 2. Uma empresa ou várias? (decisão que muda tudo)

**No Vigen:**
- O sistema é *multiempresa*: várias empresas clientes usam o mesmo sistema e uma nunca pode ver os dados da outra.
- Cada tabela tem a coluna "empresa".
- O banco recusa ligar o dado de uma empresa ao de outra.
- Há testes que tentam acessar dados de outra empresa e precisam falhar.

**Para o sistema de RH:**
- [Provável] Se é só para a sua empresa, **não precisa ser multiempresa**. Isso simplifica bastante.
- Mas se houver várias unidades, filiais ou CNPJs, e quem é de uma não puder ver os dados da outra, o problema é o mesmo. Nesse caso use a mesma técnica: uma coluna de unidade em todo registro, e o filtro aplicado em um único lugar do código.
- Decida isso **antes** de começar. Mudar depois é refazer o banco.

---

## 3. Login (quem é você)

**No Vigen:** [Certo]
- **Sem senha.** A pessoa digita o e-mail e recebe um código de 6 dígitos que vale poucos minutos.
- O código não é guardado como está: o banco guarda só uma "impressão digital" dele (hash com chave secreta). Quem roubar o banco não consegue usar os códigos.
- **Limite de tentativas**, gasto de forma que dois envios ao mesmo tempo não burlem o limite.
- **Cada código vale uma vez só.**
- A mesma mensagem aparece para e-mail que existe e para e-mail que não existe. Assim, ninguém descobre quem trabalha na empresa testando e-mails.
- **Sessão:** depois do login, o navegador recebe um cookie aleatório, inacessível a scripts da página (httpOnly). O banco guarda só o hash desse cookie.

**Para o sistema de RH:**
- [Provável] **Se a empresa tem Microsoft 365 ou Google Workspace, use o login deles** (SSO, "Entrar com Microsoft"). É mais seguro que qualquer coisa feita do zero: já tem verificação em duas etapas, e quando alguém é desligado e a TI bloqueia a conta, o acesso ao seu sistema cai junto. Isso resolve sozinho o problema do ex-funcionário que continua acessando.
- Se não houver SSO, o login por código no e-mail, como no Vigen, é uma boa opção.
- **Nunca** crie login com senha guardada em texto, nem senha padrão igual para todos.

---

## 4. Permissões (o que você pode ver e fazer)

**No Vigen:**
- Há papéis fixos: Administrador, Diretoria, Gestor do SGI, Qualidade, Gestor de área e Usuário. Antes de qualquer código, escrevemos uma **tabela de permissões** que diz, ação por ação, quem pode.
- Há também níveis de sigilo por registro: Interno, Restrito e Confidencial.
- [Certo] Regras que aprendemos:
  1. **A tela esconde, o servidor proíbe.** Esconder um botão não é segurança. O servidor confere a permissão de novo em toda ação, porque qualquer pessoa consegue enviar um pedido sem passar pela tela.
  2. **Quem é você vem do login, nunca do formulário.** Se o formulário manda "sou o usuário 15", basta editar esse número no navegador para virar outra pessoa.
  3. **Registro que a pessoa não pode ver responde "não encontrado"**, igual a um que não existe. Assim ninguém descobre que existe um registro confidencial.
  4. **O administrador do sistema não vê conteúdo confidencial só por ser administrador.** Quem configura o sistema (TI) não precisa ler denúncias.

**Para o sistema de RH**, isso é ainda mais crítico:
- Faça a tabela de permissões **antes** de pedir código ao Claude. Por exemplo:

| Ação | Funcionário | Gestor | Analista de RH | Gerente de RH | TI/Admin |
|---|---|---|---|---|---|
| Ver os próprios dados | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ver dados da equipe (sem salário) | — | ✓ (só a equipe) | ✓ | ✓ | — |
| Ver salário | o próprio | ? decidir | ✓ | ✓ | — |
| Ver atestado ou dado de saúde | o próprio | — | ? decidir | ✓ | — |
| Configurar o sistema | — | — | — | — | ✓ |

- [Provável] **O gestor ver o atestado com CID do liderado é o erro mais comum** em sistemas de RH. O gestor precisa saber que houve afastamento e por quantos dias, não o motivo médico.
- Separe os dados de saúde e os dados bancários em telas e permissões próprias.

---

## 5. Histórico (quem fez o quê)

**No Vigen:** [Certo]
- Toda mudança grava uma linha de histórico: quem, quando, o quê.
- O histórico é **só de inclusão**: o banco recusa alterar ou apagar uma linha, inclusive se alguém tentar direto no banco.
- Usuário nunca é apagado, só inativado. Apagar quebraria o histórico.

**Para o sistema de RH:**
- Isso é essencial. Em uma reclamação trabalhista, saber quem alterou o salário ou a jornada e quando é prova.
- [Provável] Registre também **quem visualizou** dados sensíveis (salário, saúde), não só quem alterou. A LGPD pede que você consiga demonstrar quem teve acesso.
- **Pedido de exclusão pela LGPD:** a lei garante esse direito, mas a empresa pode manter dados que a lei trabalhista ou previdenciária manda guardar. Combine com o jurídico o que é apagado, o que é só escondido (anonimizado) e por quanto tempo cada documento é guardado.

---

## 6. Segredos (senhas do sistema)

**No Vigen:** [Certo]
- As chaves (endereço do banco, chave do e-mail, chave do login) ficam em um arquivo `.env`, que **nunca** vai para o GitHub. Um arquivo `.gitignore` garante isso.
- O repositório tem só um `.env.example`, com os nomes das variáveis e sem os valores.
- Na hospedagem, as chaves são cadastradas no painel ("Environment Variables").
- **Nunca colamos chave no chat do Claude.** Se uma chave aparecer em conversa, print ou e-mail, ela é trocada.

**Para o sistema de RH:**
- Faça igual.
- Dê a cada ambiente (teste e produção) chaves diferentes e um banco diferente. **Nunca teste com dados reais de funcionários.** Use dados inventados.

---

## 7. O banco de dados se protege sozinho

**No Vigen:** [Certo] Além do código, o próprio banco tem regras:
- campos obrigatórios;
- valores permitidos (um status só pode ser "Pendente", "Em andamento" e similares);
- ligações que impedem dado órfão;
- impedimento de apagar histórico;
- **trava de edição simultânea**: se duas pessoas abrem o mesmo registro e salvam, a segunda recebe "alguém alterou, recarregue" em vez de apagar o trabalho da primeira.

**Para o sistema de RH:**
- [Provável] Isso evita as falhas mais caras: um funcionário sem área, duas versões do mesmo contrato, ou o salário sobrescrito sem ninguém perceber.
- **Mudanças no banco só por "migração".** Cada alteração na estrutura vira um arquivo versionado. Em produção, use só o comando que aplica migrações prontas (`prisma migrate deploy`). Nunca use comandos que recriam ou zeram o banco (`migrate dev`, `reset`): eles apagam tudo.

---

## 8. Atualizações de segurança

**No Vigen:** [Certo]
- Em novembro de 2026, a versão do Next.js que usávamos tinha uma falha **crítica**: alguém sem login conseguia rodar código no servidor.
- Detectamos com o comando `npm audit` e corrigimos atualizando para a versão 16.4.5.

**Para o sistema de RH:**
- Peça ao Claude para rodar `npm audit` periodicamente, por exemplo uma vez por mês, e antes de cada publicação.
- Ative o **Dependabot** no GitHub. Ele avisa sozinho quando uma biblioteca tem falha.
- Faça **backup** do banco e teste a restauração. Backup que nunca foi restaurado não conta. O Neon e outros serviços têm backup automático, mas confirme por quanto tempo eles guardam.

---

## 9. Como trabalhamos com o Claude

[Certo] O que funcionou para o Vigen:
1. **Primeiro documento, depois código.** Escrevemos as regras em Markdown (papéis, permissões, estados, avisos) e só depois pedimos código. O Claude não pode inventar regra de negócio: o que não estiver escrito, ele pergunta.
2. **Fatias pequenas.** Cada etapa é pequena e vai do banco à tela. Por exemplo: "login", depois "cadastro de áreas", depois "plano de ação".
3. **Testes automáticos em toda fatia**, incluindo testes que **tentam burlar** as permissões e precisam falhar.
4. **Uma revisão separada antes de dar como pronto.** Pedimos a um segundo agente do Claude que revise só segurança, isolamento e LGPD, sem escrever código. Ele achou problemas reais em quase toda rodada.
5. **Quem decide é a pessoa, não o Claude.** Quando o revisor sugeriu tirar uma permissão que contradizia uma decisão já tomada, mantivemos a decisão.
6. **Arquivo `CLAUDE.md` na raiz do projeto**, com as regras fixas: nunca usar dados reais, nunca colocar chave no código, sempre rodar os testes antes de publicar. O Claude lê esse arquivo toda vez.

---

## 10. Pedidos prontos para colar no Claude

Use um de cada vez:

1. *"Antes de escrever código, me ajude a montar a tabela de papéis e permissões do sistema de RH. Para cada tela e ação, quem pode ver e quem pode alterar. Trate dados de saúde, salário e dados bancários como categorias separadas."*
2. *"Revise o projeto e me diga, em linguagem simples, se existe alguma chave, senha ou endereço de banco escrito no código ou enviado ao GitHub."*
3. *"Confira se toda ação do servidor pega a identidade do usuário da sessão de login e nunca de um campo do formulário. Liste as que não fazem isso."*
4. *"Escreva testes automáticos que tentem: um funcionário ver o salário de outro; um gestor ver dados de saúde da equipe; um usuário desligado acessar o sistema. Todos precisam falhar."*
5. *"Crie um histórico só de inclusão (o banco recusa alterar ou apagar) para mudanças e também para visualizações de dados sensíveis."*
6. *"Rode `npm audit` e me explique, em português simples, cada falha encontrada e se ela afeta o sistema no ar."*
7. *"Faça uma revisão de segurança do que mudou desde a última revisão, sem alterar código. Classifique cada achado em bloqueante, importante ou menor."*
8. *"Liste os dados pessoais que o sistema guarda, a finalidade de cada um e por quanto tempo devem ser mantidos, para eu validar com o jurídico e o DPO."*

---

## 11. Lista de conferência antes de colocar no ar com dados reais

- [ ] Contas (hospedagem, banco, GitHub, e-mail) em nome da empresa, aprovadas pela TI.
- [ ] DPO ou jurídico validou quais dados são coletados, para quê e por quanto tempo.
- [ ] Login pelo SSO da empresa ou por código no e-mail, nunca por senha padrão.
- [ ] Tabela de permissões escrita e testes que tentam burlá-la.
- [ ] Dados de saúde e bancários com permissão separada.
- [ ] Histórico só de inclusão, com registro de quem visualizou dados sensíveis.
- [ ] Nenhuma chave no código; `.env` fora do GitHub.
- [ ] Ambientes de teste e de produção separados; nenhum dado real em teste.
- [ ] `npm audit` sem falha crítica ou alta; Dependabot ativo.
- [ ] Backup automático ligado e uma restauração testada.
- [ ] Procedimento para desligamento: quando alguém sai, o acesso cai no mesmo dia.
- [ ] Plano para incidente: quem avisar se houver vazamento (TI, DPO e, se for o caso, ANPD).

---

*Este guia descreve as escolhas de um projeto (o Vigen), feitas para um contexto específico. Ele não substitui a validação da TI, do jurídico e do DPO da sua empresa, que conhecem as regras internas e as obrigações legais do seu caso.*
