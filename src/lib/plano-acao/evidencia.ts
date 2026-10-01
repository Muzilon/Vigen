import type { Ator } from "@/lib/ator";
import { notificarItemSemEvidencia } from "@/lib/notificacoes/gatilhos";

/**
 * Regras da evidência de conclusão de um item de ação. Fica fora de servico.ts para que o serviço de anexos
 * possa recalcular a etiqueta "Sem evidência" sem importar o serviço do plano (evita ciclo de importação).
 */

/** Sem evidência = sem descrição, sem link e sem nenhum anexo ativo. */
export function semEvidenciaCalculado(d: { evidencia?: string | null; linkEvidencia?: string | null; anexosAtivos: number }) {
  return !d.evidencia?.trim() && !d.linkEvidencia?.trim() && d.anexosAtivos === 0;
}

/**
 * Quando a data de conclusão exige justificativa:
 * - "futura": a data é depois de hoje (para qualquer pessoa);
 * - "retroativa-terceiro": a data é anterior a hoje e quem registra não é o responsável (qualidade/administração).
 * O responsável registrando uma data passada (esqueceu de lançar) não precisa justificar. Datas em AAAA-MM-DD, `hoje` no fuso da empresa.
 */
export function exigenciaJustificativaData(dataConclusao: string, hoje: string, porTerceiro: boolean): "futura" | "retroativa-terceiro" | null {
  if (dataConclusao > hoje) return "futura";
  if (dataConclusao < hoje && porTerceiro) return "retroativa-terceiro";
  return null;
}

/**
 * Recalcula a etiqueta "Sem evidência" de um item concluído quando um anexo entra ou sai (ou quando o envio
 * falhou). Se a etiqueta passa a valer, avisa a qualidade. Nunca propaga erro: é um ajuste posterior à operação principal.
 */
export async function recalcularSemEvidencia(a: Ator, itemId: string) {
  try {
    const item = await a.db.itemAcao.findFirst({
      where: { id: itemId },
      select: { status: true, semEvidencia: true, evidenciaConclusao: true, linkEvidencia: true },
    });
    if (!item || item.status !== "CONCLUIDO") return;
    const anexosAtivos = await a.db.anexo.count({ where: { entidadeTipo: "ITEM_ACAO", entidadeId: itemId, excluidoEm: null } });
    const sem = semEvidenciaCalculado({ evidencia: item.evidenciaConclusao, linkEvidencia: item.linkEvidencia, anexosAtivos });
    if (sem === item.semEvidencia) return;
    await a.db.itemAcao.updateMany({ where: { id: itemId, status: "CONCLUIDO" }, data: { semEvidencia: sem } });
    if (sem) await notificarItemSemEvidencia(a, itemId);
  } catch (e) {
    console.error(`[evidencia] falha ao recalcular a etiqueta do item ${itemId}`, e);
  }
}
