/**
 * Fonte de alerta do módulo INDICADORES (cron diário, via src/lib/reavaliacao): indicador ativo sem resultado lançado
 * no último período fechado → INDICADOR_SEM_LANCAMENTO para o responsável (ou quem cadastrou). A "data" do alerta é o
 * prazo de lançamento (fim do período + DIAS_PRAZO_LANCAMENTO); a chave idempotente inclui o período, então cada
 * período pendente gera um único alerta por pessoa.
 * Registrada por efeito colateral: src/lib/notificacoes/cron.ts importa este arquivo.
 */
import { somarDias } from "@/lib/datas";
import { registrarFonteReavaliacao, type ItemReavaliacao } from "@/lib/reavaliacao/fontes";
import { linkIndicador } from "./acesso";
import { DIAS_PRAZO_LANCAMENTO, limitesPeriodo, rotuloPeriodo, ultimoPeriodoFechado } from "./periodos";

registrarFonteReavaliacao({
  modulo: "INDICADORES",
  tipoNotificacao: "INDICADOR_SEM_LANCAMENTO",
  mensagem: (i, vencida, data) => ({
    titulo: `${vencida ? "Resultado em atraso" : "Lançar resultado"}: ${i.titulo}`,
    corpo: `O resultado do período ainda não foi lançado${vencida ? ` (prazo era ${data})` : ` — prazo ${data}`}.`,
  }),
  async listarVencendo(db, _empresa, hoje) {
    const lista = await db.indicador.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, periodicidade: true, responsavelId: true, criadoPorId: true, resultados: { select: { periodo: true } } },
    });
    const out: ItemReavaliacao[] = [];
    for (const i of lista) {
      const periodo = ultimoPeriodoFechado(hoje, i.periodicidade);
      if (i.resultados.some((r) => r.periodo === periodo)) continue;
      out.push({
        entidadeId: i.id,
        modo: "ITEM",
        dataReavaliacao: somarDias(limitesPeriodo(periodo, i.periodicidade).fim, DIAS_PRAZO_LANCAMENTO),
        titulo: `${i.nome} (${rotuloPeriodo(periodo)})`,
        link: linkIndicador(i.id),
        usuarioIds: [i.responsavelId ?? i.criadoPorId],
      });
    }
    return out;
  },
});
