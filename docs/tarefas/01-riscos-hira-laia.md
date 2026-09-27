# 📝 Tarefa de Desenvolvimento (Aprovada): Riscos, HIRA e LAIA

**Para:** Claude Code (ou Agente Desenvolvedor)
**Objetivo:** Implementar melhorias estratégicas de UX e de regras de negócio validadas para os módulos ISO 9001 (Riscos), 14001 (LAIA) e 45001 (HIRA).

---

## 1. Refatoração de Terminologia (Banco e UI)
- O termo "Obra" limita o SaaS. Onde a UI apresentar "Obra", passe a apresentar "Unidade" (filiais, fábricas, lojas).
- Garantir que o modelo `ObraUnidade` do Prisma reflita visualmente esse escopo universal no frontend.

## 2. Requisitos de Interface e Lógica (Frontend & Backend)

### A. Heatmap Vivo (Riscos)
- **Filtro Clicável:** O componente Heatmap já existente deve emitir eventos. Ao clicar em uma célula (ex: quadrante Crítico, valor 9), a listagem de riscos da página deve ser filtrada para exibir apenas os itens daquele quadrante.
- **Toggle (Inerente vs Residual):** Criar um componente de Toggle na UI. Ao alternar, o Heatmap recalcula as posições baseadas no Risco Residual, e a lista atualiza.

### B. Master-Detail UX (Planilhas HIRA e LAIA)
- Abandonar a exibição de tabela infinita clássica.
- Implementar layout de 2 colunas (*Split-View*):
  - **Lado Esquerdo (Navegação):** Uma árvore collapsível `Unidade > Processo > Atividade`.
  - **Lado Direito (Conteúdo):** Ao selecionar a atividade na esquerda, renderizar apenas os Cards de Perigos (HIRA) ou Aspectos (LAIA) pertencentes àquela atividade.

### C. Funil de Controles (ISO 45001)
- Na tela de criação/edição de linha HIRA, o formulário de `HierarquiaControle` não deve ser um simples dropdown.
- Deve ser uma interface hierárquica (steps ou funil): Eliminação -> Substituição -> Engenharia -> Administrativo -> EPI. O design deve encorajar visualmente a seleção dos itens de cima antes dos de baixo.

### D. Clone Inteligente de Unidades
- Criar uma Server Action `clonarMatrizUnidade(unidadeOrigemId, unidadeDestinoId)`.
- **Regra de Negócio:** Copiar todos os registros vigentes de HIRA e LAIA da Unidade Origem para a Unidade Destino, setando o status das novas linhas para revisão/pendente.
- Isso permite a adoção em escala por clientes com dezenas de filiais.
