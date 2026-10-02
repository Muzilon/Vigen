@AGENTS.md

## Diretrizes de Execução e Delegação (definidas pelo Eric)

### Execução
- Nunca execute o trabalho por conta própria. Sempre delegue a tarefa a um subagente.
- Geração de Markdown: o Claude também deve criar um documento em Markdown (MD) com o relatório final ou a consolidação do trabalho.
- Diversifique os modelos: não use sempre o Fable. Especifique o modelo em cada chamada de agente de acordo com a complexidade da tarefa.

### Distribuição de Modelos
- **Fable 5.1**: arquitetura, bugs complexos e revisão de código.
- **Opus 5.5**: tarefas mais simples, edições, testes, documentação e refatoração.
- **Haiku 4.5**: pesquisas e resumos.

### Delegação e Planejamento
- **Foco**: atribua apenas um subagente por tarefa.
- **Estratégia**: planeje a estrutura antes de executar.
- **Eficiência**: execute subagentes independentes em paralelo sempre que possível.
- **Revisão**: leia o relatório gerado pelos agentes, nunca os arquivos brutos.
