# Avaliação da proposta do Gemini (arquitetura, UX e SQL)

**Data:** 14/10/2026. **Material:** dois Markdown e um SQL enviados pelo Eric. **Base de comparação:** docs 08 a 16 (regras já decididas) e o schema da fatia 1a do Vigen-novo.

## Adotar (boas ideias, compatíveis)
| Ideia | Onde entra |
|---|---|
| Alerta não bloqueante quando a causa raiz é «erro humano», «falta de atenção», «descuido» | TNC, fatia 4 |
| Arquivo PDF para leitura + arquivo editável visível só para quem elabora/Qualidade | Documentos, fatia 5 |
| Publicação manual depois da aprovação («aguardando publicação») | Já decidido (Qualidade publica); confirma |
| Ishikawa com 5 Porquês ligado à hipótese marcada como causa provável | TNC, fatia 4 |
| «Minha fila» como tela inicial, abrindo o item em gaveta lateral | Telas, a partir da fatia 3 |
| Paleta de cores | Design (depois das telas funcionando) |

## Não adotar (conflita com decisão tomada ou com a norma)
| Proposta | Por quê |
|---|---|
| **Modo Auditoria que esconde atrasos, devoluções e histórico de reprovação** | Esconder evidência do auditor numa auditoria de certificação é enganar o auditor; risco de perda de certificação e de reputação do produto. Alternativa: «Modo apresentação» que só simplifica a tela, sem ocultar dados |
| Leitura global de tudo por padrão | Decidido: confidencialidade em 3 níveis, «Minhas ações» como padrão, herança da origem (docs 10 e 11) |
| 3 perfis (Colaborador, Gestor, SGI_ADMIN) | Decidido: 6 papéis, incluindo Diretoria e Administrador sem acesso a confidencial (doc 11) |
| Concluir ação só com evidência anexada | Decidido: pode concluir sem evidência, com confirmação explícita e etiqueta de alerta (doc 10) |
| Triagem liga/desliga por empresa | Fluxos fixos na Fase 1 (doc 08); a análise crítica com 3 saídas já cumpre o papel |
| Treinamentos (LMS) e Mural de comunicados | Fora da Fase 1; ameaçam fevereiro |

## O SQL proposto: não usar como base
| Problema | Consequência |
|---|---|
| Ligações sem empresa (`REFERENCES users(id)`) | Usuário de uma empresa pode ser responsável por registro de outra; vazamento entre clientes |
| `ON DELETE CASCADE` a partir do tenant | Apagar a empresa apaga a evidência de auditoria em cascata |
| Sem tabela de histórico e sem versão (trava otimista) | Sem rastro de quem mudou o quê; edição simultânea sobrescreve |
| Reprogramação em colunas na própria ação | Só guarda a última; perde o histórico de reprogramações decidido |
| `rnc_causes` sem `tenant_id`; `department` como texto | Isolamento e cadastro de áreas fracos |
| Um papel por usuário (`role`) | Não comporta pessoa com dois papéis (decidido no doc 11) |
| IP e assinatura em treinamentos | Dado pessoal (LGPD) sem finalidade definida |

O schema do Vigen-novo (fatia 1a) já cobre a base com chaves compostas por empresa, histórico só de inclusão e trava otimista; os módulos entram nele, fatia a fatia.
