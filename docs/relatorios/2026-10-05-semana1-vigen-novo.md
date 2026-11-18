# Semana 1 do Vigen novo: ambiente e primeiro commit

**Data:** 05/10/2026 (noite, horário do Eric).

## Feito
- Node v24.19.0 e npm 11.17.0 instalados.
- Git 2.55.0 instalado (vinha do winget, mas fora do PATH; corrigido acrescentando `C:\Program Files\Git\cmd` ao PATH do usuário).
- Git configurado com nome e e-mail.
- Repositório `Muzilon/Vigen-novo` criado, clonado e **tornado privado** (estava público).
- Primeiro programa `hoje.js`: imprime «Hoje é segunda-feira, 05/10/2026», com `toLocaleDateString("pt-BR", { weekday, day, month, year })`.
- Primeiro commit (`46e30ca`) e push para o GitHub.

## Lições que o Eric viu na prática
1. O computador roda o que está salvo no disco, não o que está na tela (Ctrl+S, Auto Save).
2. Opções do `toLocaleDateString`: só aparece o que se pede.
3. Fuso horário: a máquina do Eric e o servidor estavam em dias diferentes; prazos no Vigen usam o fuso da empresa.
4. PATH: onde o Windows procura os comandos.
5. Três lugares: disco (salvar), histórico local (commit), nuvem (push).

## Pendente
- Registrar as horas reais de cada sessão (base da revisão de 15/11).
- Semana 2: JavaScript (funções, listas, objetos, módulos) e cálculo de dias úteis com feriados.
