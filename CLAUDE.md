@AGENTS.md

## Diretrizes de Execução e Delegação (definidas pelo Eric)

### Execução
- Delegue a um subagente o trabalho pesado: ler muitos arquivos, revisar código, implementar tela ou módulo. Cada subagente começa do zero e custa dezenas de milhares de tokens só para carregar o contexto.
- Faça direto, sem subagente, o trabalho pequeno: commit, push, conferir `git status`, editar poucas linhas.
- Geração de Markdown: o Claude também deve criar um documento em Markdown (MD) com o relatório final ou a consolidação do trabalho.
- Modelo: todos os subagentes rodam em Sonnet 5.5 (decisão do Eric, para economizar tokens). Nas chamadas ao Agent, passe `model: sonnet`.

### Modelos
- Os 21 agentes de `.claude/agents/` têm `model: sonnet` no frontmatter. Não há distribuição por tipo de tarefa.
- Em arquitetura de dados, autenticação e revisão de isolamento entre empresas, peça ao `agente-qa-revisao` uma revisão antes de dar a entrega por pronta: é onde um erro silencioso custa mais.

### Delegação e Planejamento
- **Foco**: atribua apenas um subagente por tarefa.
- **Estratégia**: planeje a estrutura antes de executar.
- **Eficiência**: execute subagentes independentes em paralelo sempre que possível.
- **Revisão**: leia o relatório gerado pelos agentes, nunca os arquivos brutos.
