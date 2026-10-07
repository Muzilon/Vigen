# Checklist de engenharia do Vigen novo

**Estado:** 07/10/2026. Avaliação, pelo Claude, de uma lista de 20 regras recebida pelo Eric (origem: vídeo de @dudumontenegro_). Base: doc 08 §5 (segurança, OWASP ASVS nível 2) e docs 10 a 12.
**Legenda:** **Adota** = entra como regra; **Adapta** = entra com ajuste; **Depois** = vale, mas não agora.

| # | Regra recebida | Decisão | Como fica no Vigen |
|---|---|---|---|
| 1 | Hash de senha (bcrypt, Argon2id) | Adapta | Se houver senha, Argon2id. O código de acesso por e-mail também é guardado só como hash, expira em minutos e tem limite de tentativas |
| 2 | Chave privada nunca no front-end | Adota | Toda chamada a serviço externo passa pelo backend |
| 3 | `.env` no `.gitignore` desde o 1º commit; scanner de segredos | Adota, **já** | Fazer agora no repositório novo, antes do primeiro segredo existir |
| 4 | Autenticação obrigatória por padrão | Adota | Rota nasce protegida; pública só com exceção explícita e listada |
| 5 | CORS restrito | Adota | Só os domínios do Vigen |
| 6 | Evitar `SELECT *` | Adota | Prisma com `select` explícito nas listas |
| 7 | Índice em toda coluna de WHERE/JOIN/ORDER BY | Adapta | Índice para as consultas reais, medido; índice demais deixa a gravação lenta. Toda tabela começa com índice em `empresaId` |
| 8 | Sem consulta ao banco dentro de laço (N+1) | Adota | Revisão de código procura isso |
| 9 | Front-end nunca acessa o banco direto | Adota | Todo acesso passa pela API |
| 10 | Funções pequenas e coesas | Adota | |
| 11 | Regra de negócio fora da rota | Adota | Camada de serviços; a rota só valida e chama |
| 12 | Nada de `utils.js` lixeira | Adota | Utilitários por assunto: datas, validação, formatação |
| 13 | Dependências mantidas; `npm audit` | Adota | `npm audit` no CI; poucas dependências |
| 14 | Sem código que «ninguém sabe como funciona» | Adota | Testes + explicação em cada entrega (método híbrido) |
| 15 | Sem `try/catch` vazio | Adota | |
| 16 | Logs estruturados (Pino) | Adapta | Pino, em JSON. Datadog e similares só quando houver cliente pagando; o painel técnico (doc 08) começa simples |
| 17 | Status HTTP certos (400/401/403/404) | Adota | 404 também quando o registro é de outra empresa, para não revelar que ele existe |
| 18 | Monitoramento de erros (Sentry) | Depois | Plano gratuito antes do primeiro usuário real |
| 19 | Deploy só por CI, nunca manual | Adota | Migração de banco também pelo pipeline, nunca `migrate dev` ou `reset` em produção |
| 20 | Testar a restauração do backup | Adota | Restauração testada antes do primeiro usuário real e depois a cada trimestre |

## O que a lista não cobre e é o maior risco do Vigen

1. **Isolamento entre empresas:** toda consulta filtrada por `empresaId`, chaves estrangeiras compostas e teste automático que tenta ler dado de outra empresa e precisa falhar. Um vazamento entre clientes encerra o produto.
2. **Confidencialidade por registro** (doc 11): o filtro vale em listas, busca, contadores, avisos e exportação.
3. **Histórico só de inclusão:** nada é apagado nem editado no histórico; é a evidência de auditoria.
4. **Limite de tentativas** no login, no código por e-mail e nas rotas públicas.
5. **LGPD:** dado pessoal mínimo, anonimização em vez de exclusão (doc 11), e-mail sem conteúdo (doc 12).
6. **Datas e fuso:** prazos calculados no fuso da empresa, datas civis em texto `AAAA-MM-DD`.
