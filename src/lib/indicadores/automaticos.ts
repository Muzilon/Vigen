/**
 * Indicadores automáticos (P7): valor calculado dos dados reais do sistema, com as mesmas definições do dashboard
 * (src/lib/indicadores/calculos.ts). Cálculo puro separado do carregamento para ser testável.
 *
 * Decisão: o valor é um agregado da empresa inteira (não depende do escopo de quem consulta), para que todos vejam o
 * mesmo número do indicador. Nenhum dado pessoal ou de RNC restrita é exposto — só a porcentagem.
 */
import type { FonteIndicador, StatusItemAcao } from "@prisma/client";
import type { Ator } from "@/lib/ator";
import { dataIso, paraDataDb, somarDias } from "@/lib/datas";
import { diaNoFuso } from "./calculos";

export type FonteAutomatica = Exclude<FonteIndicador, "MANUAL">;
export const ehAutomatico = (f: FonteIndicador): f is FonteAutomatica => f !== "MANUAL";

/** Sugestões de cadastro para cada fonte automática (unidade, direção e fórmula descritiva). */
export const DEFINICAO_AUTOMATICA: Record<FonteAutomatica, { unidade: string; direcao: "MAIOR_MELHOR" | "MENOR_MELHOR"; formula: string }> = {
  RNC_EFICACIA_PRIMEIRA_VERIFICACAO: {
    unidade: "%",
    direcao: "MAIOR_MELHOR",
    formula: "Gerado automaticamente do módulo RNC: RNCs com 1ª verificação de eficácia no período avaliadas como eficazes ÷ total de 1ªs verificações no período × 100.",
  },
  PLANO_ITENS_ATRASADOS: {
    unidade: "%",
    direcao: "MENOR_MELHOR",
    formula: "Gerado automaticamente do Plano de Ação: itens com prazo no período concluídos após o prazo ou ainda abertos com prazo vencido ÷ itens com prazo no período (sem cancelados) × 100.",
  },
};

const pct = (num: number, den: number) => (den === 0 ? null : Math.round((num / den) * 1000) / 10);
const dentro = (dia: string, p: { inicio: string; fim: string }) => dia >= p.inicio && dia <= p.fim;

/** % de RNCs eficazes na 1ª verificação (verificações de tentativa 1 cujo dia, no fuso, cai no período). */
export function calcularEficaciaPrimeiraVerificacao(verificacoes: readonly { eficaz: boolean; verificadoEm: Date }[], periodo: { inicio: string; fim: string }, fuso: string): number | null {
  const noPeriodo = verificacoes.filter((v) => dentro(diaNoFuso(v.verificadoEm, fuso), periodo));
  return pct(noPeriodo.filter((v) => v.eficaz).length, noPeriodo.length);
}

/**
 * % de itens atrasados entre os itens com prazo no período (cancelados fora): atrasado = concluído depois do prazo
 * ou ainda aberto (pendente/em andamento) com prazo anterior a hoje. O complemento (100 − valor) é o atendimento ao prazo.
 *
 * A data de conclusão é gravada como o DIA escolhido à meia-noite UTC (como as colunas de data); por isso o dia é lido em UTC,
 * igual à tela e à etiqueta "Concluído fora do prazo". Convertê-la para o fuso da empresa a empurraria para o dia anterior e
 * contaria como "no prazo" uma ação concluída com 1 dia de atraso. O parâmetro `fuso` fica por compatibilidade com quem chama.
 */
export function calcularItensAtrasados(
  itens: readonly { status: StatusItemAcao; quando: Date; dataConclusao: Date | null }[],
  periodo: { inicio: string; fim: string },
  hoje: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mantido por compatibilidade com quem chama (ver comentário acima)
  _fuso?: string,
): number | null {
  const considerados = itens.filter((i) => i.status !== "CANCELADO" && dentro(dataIso(i.quando), periodo));
  const atrasados = considerados.filter((i) => {
    const prazo = dataIso(i.quando);
    if (i.status === "CONCLUIDO") return !!i.dataConclusao && dataIso(i.dataConclusao) > prazo;
    return prazo < hoje;
  });
  return pct(atrasados.length, considerados.length);
}

/** Calcula o valor de uma fonte automática para o período (dias no fuso). null = sem dados no período. */
export async function calcularAutomatico(a: Pick<Ator, "db">, fonte: FonteAutomatica, periodo: { inicio: string; fim: string }, hoje: string, fuso: string): Promise<number | null> {
  // Pré-filtro no banco com folga de 1 dia (fuso); o corte exato é feito no cálculo puro.
  const desde = paraDataDb(somarDias(periodo.inicio, -1));
  const ate = paraDataDb(somarDias(periodo.fim, 2));
  if (fonte === "RNC_EFICACIA_PRIMEIRA_VERIFICACAO") {
    const vs = await a.db.verificacaoEficacia.findMany({ where: { tentativa: 1, verificadoEm: { gte: desde, lt: ate } }, select: { resultado: true, verificadoEm: true } });
    return calcularEficaciaPrimeiraVerificacao(vs.map((v) => ({ eficaz: v.resultado === "EFICAZ", verificadoEm: v.verificadoEm })), periodo, fuso);
  }
  const itens = await a.db.itemAcao.findMany({
    where: { quando: { gte: paraDataDb(periodo.inicio), lte: paraDataDb(periodo.fim) } },
    select: { status: true, quando: true, dataConclusao: true },
  });
  return calcularItensAtrasados(itens, periodo, hoje, fuso);
}
