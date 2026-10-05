# Código do documento: pesquisa e proposta

**Estado:** pesquisa e proposta do Claude em 05/10/2026, para o Eric validar. **[Certo]** tem fonte; **[Provável]** é inferência; **[Proposta]** é decisão a confirmar.
**Limite da pesquisa:** a rede desta sessão bloqueou a leitura das páginas; as conclusões vêm dos resumos dos resultados de busca. As fontes estão no fim.

## 1. O que a pesquisa mostrou

1. **A norma não impõe formato [Certo].** A ISO 9001 (7.5.2) pede identificação e descrição, por exemplo título, data, autor ou número de referência. O código é escolha da empresa.
2. **Padrão comum no Brasil [Certo]:** sigla do tipo + sigla da área ou processo + sequencial de 3 dígitos, com a revisão como sufixo. Exemplos públicos: `PG.SGQ.001-00`, `IT.QUALID.002`, `PT.SGQ.002-04`. Siglas de tipo frequentes: PG (procedimento gerencial), PO (procedimento operacional), IT (instrução de trabalho), PT ou POL (política), MN (manual), FP ou FOR (formulário).
3. **Concorrentes [Certo para Qualyteam; Provável para SoftExpert]:**
   - Qualyteam: «padrão de código» configurável por categoria, com sigla da categoria, sequencial, sigla da unidade organizacional e sigla do processo, separador escolhido e unidade e processo opcionais.
   - SoftExpert: máscara de identificador por categoria; em alguns casos o identificador é digitado pelo usuário.
4. **Boa prática [Certo]:**
   - O número nunca muda; o que muda é a revisão, guardada à parte.
   - Evitar código «inteligente» demais, em que cada dígito é um segredo.
   - Se o código tem a área e a empresa se reorganiza, **não se renumera**: atualiza-se o dono nos dados do documento. Renumerar quebra o histórico, os treinamentos e as referências de auditoria.
5. **Documentos externos [Certo]:** listas mestras de documentos externos usam a identificação da própria origem (por exemplo, a sigla da norma), a data de publicação ou validade e a periodicidade de verificação.

## 2. Proposta para o Vigen

| # | Regra [Proposta] |
|---|---|
| 1 | **Máscara por empresa**, montada com blocos: TIPO, ÁREA, UNIDADE (opcional), SEQUENCIAL (dígitos configuráveis, padrão 3) e separador (`-`, `.` ou nenhum) |
| 2 | **Padrão de fábrica:** `TIPO-ÁREA-SEQ` → `PG-QUA-001`. A revisão fica em campo próprio e aparece ao lado: `PG-QUA-001 Rev. 02` |
| 3 | **Tipos sem área:** o tipo pode ser marcado «da empresa toda» (manual, política); aí o bloco ÁREA some: `POL-001` |
| 4 | **Sequencial por prefixo:** conta separado para cada combinação (por exemplo, PG-QUA e PG-SST); nunca reaproveita número, nem de documento cancelado |
| 5 | **Código imutável:** gerado uma vez e nunca muda, mesmo se a área mudar de sigla ou o documento mudar de área. A sigla é copiada no momento da criação |
| 6 | **Mudar a máscara** vale só para documentos novos; os existentes mantêm o código |
| 7 | **Importação:** ao trazer documentos que a empresa já tem, o código antigo pode ser digitado. O sistema confere que não repete e continua o sequencial depois do maior número importado daquele prefixo |
| 8 | **Documento externo:** campo obrigatório «identificação de origem» (por exemplo, `ABNT NBR ISO 9001:2015`, `NR-12`), que é o que aparece na lista mestra; código interno opcional, com o tipo DE |
| 9 | **Tipos pré-cadastrados** (termos gerais; a empresa edita e acrescenta): MSG Manual do sistema de gestão, POL Política, PG Procedimento gerencial, PO Procedimento operacional, IT Instrução de trabalho, FOR Formulário, PL Plano ou programa, DE Documento externo |
| 10 | **Nota técnica para o código:** código único por empresa garantido no banco; o sequencial é gerado dentro da mesma transação, com trava na linha do contador, para dois documentos criados ao mesmo tempo não pegarem o mesmo número |

## 3. Respostas do Eric (05/10/2026) [Decidido]

1. **Quem codifica é a Qualidade.** O solicitante não sabe codificar: no cadastro dele o campo de código não aparece. O sistema olha as categorias cadastradas (tipo, área e, se a máscara usar, unidade) e **recomenda** um código, desde que todas as partes estejam preenchidas.
2. **Revisão:** configurável; padrão de fábrica com sublinhado: `PG-QUA-001_02`.
3. **Unidade:** configurável; fora do padrão de fábrica.

**Como isso funciona [Proposta do Claude]:**
- O código é definido quando a Qualidade aceita a solicitação e cadastra o documento. Solicitação recusada não gasta número.
- A recomendação é só uma prévia. O número é reservado no momento em que a Qualidade confirma, dentro da transação; se outra pessoa pegou o mesmo número nesse meio tempo, o sistema usa o seguinte e avisa.
- A Qualidade pode aceitar a recomendação ou digitar outro código (por exemplo, para seguir um padrão antigo). O sistema confere que não repete, registra no histórico «código definido manualmente» e continua o sequencial depois do maior número.
- Depois de confirmado, o código não muda (regra 5). Documento cancelado depois da confirmação mantém o número queimado.
- A primeira revisão é `_00`, como no padrão de mercado encontrado (`PG.SGQ.001-00`).
- No e-mail de aviso, o código fica fora do texto do link: o sublinhado do link esconde o `_` e `PG-QUA-001_02` parece `PG-QUA-001 02`.

## 4. Perguntas ao Eric

1. Quem pode solicitar documento novo ou revisão: todos ou só o gestor de área? (Ver doc 11, §3.3.)
2. A Qualidade pode digitar um código diferente do recomendado?

## Fontes

- [INTS, PG.SGQ.001 Gestão da informação documentada](https://ints.org.br/wp-content/uploads/2022/08/PG.SGQ_.001-12-Gestao-da-informacao-documentada.pdf)
- [INTS, PT.SGQ.002 Gestão de documentos](https://ints.org.br/wp-content/uploads/2024/12/PT.SGQ_.002-04-Gestao-de-Documentos.pdf)
- [Inova Capixaba, IT.QUALID.002](https://inovacapixaba.es.gov.br/Media/InovaCapixaba/Transpar%C3%AAncia/Normas%20de%20Procedimentos/Qualidade/IT.QUALID.002%20-%20Padroniza%C3%A7%C3%A3o%20de%20Norma%20de%20Procedimento-1.pdf)
- [Blog da Qualidade, requisito 7.5](https://blogdaqualidade.com.br/requisito-7-5-iso-9001-informacao-documentada/)
- [Portal ISO, 7.5.2 Criando e atualizando](https://iso9001.portaliso.com/iso-9001-guia-completo/criando-e-atualizando/)
- [Qualyteam, Editar categoria de documento](https://suporte.qualyteam.com.br/pt-BR/support/solutions/articles/35000199034-editar-categoria-de-documento)
- [SoftExpert, notas de versão do Document](https://documentation.softexpert.com/pt-br/releasenotes/document_2108.html)
- [Technical Writer HQ, Document control numbering](https://technicalwriterhq.com/documentation/document-control/document-control-numbering/)
- [FileHold, Numbering and versioning](https://filehold.com/resources/whitepapers/numbering-versioning/)
- [Smithers, ISO 9001 documentation best practices](https://www.smithers.com/resources/2025/september/iso-9001-documentation-best-practices)
- [TJAL, Lista mestra de documentos externos](https://apmp.tjal.jus.br/arquivosQualidade/2a3231608220c7330d0ba4a0398c573e).pdf)
- [Docnix, Lista mestra de documentos](https://docnix.com.br/documentos-registros/lista-mestra-de-documentos-estrutura-erros-comuns-e-modelo-operacional/)
