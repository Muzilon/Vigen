/**
 * Seed de Indicadores (P7) — Monto: 8 indicadores (6 manuais com 3-4 períodos de resultado, 2 automáticos calculados
 * dos dados reais de RNC e Plano de Ação). Períodos relativos a hoje (último período fechado e anteriores), para o
 * seed continuar plausível em qualquer data. Inclui uma correção (novo lançamento do mesmo período) e um indicador
 * sem lançamento no último período (alerta "sem lançamento"). Feito pelo serviço. Idempotente: só cria se a empresa
 * ainda não tiver indicadores.
 */
import type { PeriodicidadeIndicador, PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { hojeNoFuso } from "../src/lib/datas";
import { criarIndicador, lancarResultado, registrarResultadoAutomatico, type DadosIndicador } from "../src/lib/indicadores/gestao";
import { periodoDaData, somarPeriodos, ultimoPeriodoFechado } from "../src/lib/indicadores/periodos";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";

async function ator(prisma: PrismaClient, email: string): Promise<Ator> {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return { db: criarDbTenant(u.empresaId, prisma), empresaId: u.empresaId, usuarioId: u.id, permissoes, obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId) };
}

export async function semearIndicadores(prisma: PrismaClient, empresaId: string) {
  if ((await prisma.indicador.count({ where: { empresaId } })) > 0) return;
  const q = await ator(prisma, "qualidade@monto.com.br");
  const id = async (email: string) => (await prisma.usuario.findUniqueOrThrow({ where: { email } })).id;
  const [seg, amb, adm] = await Promise.all([id("seguranca@monto.com.br"), id("meioambiente@monto.com.br"), id("admin@monto.com.br")]);
  const proc = async (codigo: string) => (await prisma.processo.findUnique({ where: { empresaId_codigo: { empresaId, codigo } } }))?.id ?? null;
  const [pg02, pf03, pf04, pa01, pa02] = await Promise.all([proc("PG-02"), proc("PF-03"), proc("PF-04"), proc("PA-01"), proc("PA-02")]);
  const hoje = hojeNoFuso("America/Sao_Paulo");
  /** Períodos fechados terminando no último: [antepenúltimo, ..., último]. */
  const fechados = (p: PeriodicidadeIndicador, n: number) => Array.from({ length: n }, (_, k) => somarPeriodos(ultimoPeriodoFechado(hoje, p), p, k - (n - 1)));

  const manuais: (DadosIndicador & { valores: number[]; semUltimo?: boolean; correcao?: { indice: number; antes: number } })[] = [
    {
      nome: "Satisfação do cliente na entrega", processoId: pf04, unidade: "%", direcao: "MAIOR_MELHOR", meta: 85, periodicidade: "TRIMESTRAL", responsavelId: q.usuarioId,
      formula: "Pesquisas pós-entrega com nota ≥ 8 ÷ pesquisas respondidas × 100.", valores: [82, 86.5, 88],
    },
    {
      nome: "Prazo médio de entrega de materiais", processoId: pa01, unidade: "dias", direcao: "MENOR_MELHOR", meta: 7, periodicidade: "MENSAL", responsavelId: adm,
      formula: "Média de dias entre o pedido de compra e o recebimento na obra (relatório do ERP).", valores: [8.2, 7.5, 6.8, 6.5],
    },
    {
      nome: "Perda de concreto na execução", processoId: pf03, unidade: "%", direcao: "MENOR_MELHOR", meta: 3, periodicidade: "MENSAL", responsavelId: q.usuarioId,
      formula: "(Volume comprado − volume teórico de projeto) ÷ volume teórico × 100.", valores: [3.4, 3.1, 2.9, 3.6], correcao: { indice: 2, antes: 2.4 },
    },
    {
      nome: "Taxa de frequência de acidentes", processoId: pa02, unidade: "acid./milhão HHT", direcao: "MENOR_MELHOR", meta: 10, periodicidade: "MENSAL", responsavelId: seg,
      formula: "Acidentes com e sem afastamento × 1.000.000 ÷ homens-hora trabalhadas (NBR 14280).", valores: [8.1, 12.3, 6], semUltimo: true,
    },
    {
      nome: "Horas de treinamento por colaborador", processoId: pa02, unidade: "h", direcao: "MAIOR_MELHOR", meta: 4, periodicidade: "TRIMESTRAL", responsavelId: seg,
      formula: "Horas de treinamento realizadas no trimestre ÷ efetivo médio.", valores: [3.5, 4.2, 4.8],
    },
    {
      nome: "Resíduos com destinação adequada", processoId: pf03, unidade: "%", direcao: "MAIOR_MELHOR", meta: 95, periodicidade: "SEMESTRAL", responsavelId: amb,
      formula: "Toneladas com MTR e destinação licenciada ÷ toneladas geradas × 100 (CONAMA 307).", valores: [91, 94.5, 96],
    },
  ];

  for (const m of manuais) {
    const { valores, semUltimo, correcao, ...dados } = m;
    const { id: indId } = await criarIndicador(q, dados);
    const n = valores.length + (semUltimo ? 1 : 0);
    const periodos = fechados(m.periodicidade, n).slice(0, valores.length);
    const lancador = m.responsavelId ? await ator(prisma, (await prisma.usuario.findUniqueOrThrow({ where: { id: m.responsavelId } })).email) : q;
    for (let k = 0; k < valores.length; k++) {
      if (correcao && correcao.indice === k) {
        await lancarResultado(lancador, indId, { periodo: periodos[k], valor: correcao.antes });
        await lancarResultado(lancador, indId, { periodo: periodos[k], valor: valores[k], observacao: "Correção: planilha de consumo revisada após o fechamento das notas fiscais do mês." });
      } else {
        await lancarResultado(lancador, indId, { periodo: periodos[k], valor: valores[k] });
      }
    }
  }

  // Automáticos: valor calculado dos dados reais (RNC e Plano de Ação). Registra os períodos que têm dados (últimos 4
  // meses, incluindo o corrente — parcial); períodos sem dados ficam "sem lançamento".
  const automaticos: DadosIndicador[] = [
    { nome: "Eficácia das ações corretivas (1ª verificação)", processoId: pg02, unidade: "%", direcao: "MAIOR_MELHOR", meta: 80, periodicidade: "MENSAL", fonte: "RNC_EFICACIA_PRIMEIRA_VERIFICACAO", responsavelId: q.usuarioId },
    { nome: "Itens do plano de ação atrasados", processoId: pg02, unidade: "%", direcao: "MENOR_MELHOR", meta: 15, periodicidade: "MENSAL", fonte: "PLANO_ITENS_ATRASADOS", responsavelId: q.usuarioId },
  ];
  for (const d of automaticos) {
    const { id: indId } = await criarIndicador(q, d);
    const atual = periodoDaData(hoje, d.periodicidade);
    for (let k = -3; k <= 0; k++) {
      await registrarResultadoAutomatico(q, indId, somarPeriodos(atual, d.periodicidade, k)).catch(() => undefined); // sem dados no período
    }
  }
}
