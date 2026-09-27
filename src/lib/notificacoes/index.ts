import { criarDbTenant } from "@/lib/db-tenant";
import { descricaoItem, rotuloRnc } from "./gatilhos";
import { comSeguranca, criarNotificacoes } from "./servico";

/** Evento de domínio que gera notificação (in-app + e-mail). */
export type EventoNotificacao = {
  tipo: "INTERACAO_CRIADA";
  empresaId: string;
  interacaoId: string;
  destinatarioId: string | null;
  autorId: string;
  entidadeTipo: "RNC" | "ITEM_ACAO" | "PROCESSO" | "RISCO_OPORTUNIDADE" | "HIRA" | "LAIA" | "DOCUMENTO" | "INSPECAO" | "AUDITORIA" | "REQUISITO_LEGAL";
  entidadeId: string;
};

/**
 * Ponto de extensão para eventos de interação: gera notificação INTERACAO_NOVA para o
 * destinatário (idempotente por interação). O conteúdo da mensagem não vai para o e-mail
 * (pode conter dados pessoais); o usuário lê a thread no sistema. Nunca lança erro.
 */
export async function notificar(evento: EventoNotificacao): Promise<void> {
  await comSeguranca("interacao", async () => {
    if (!evento.destinatarioId || evento.destinatarioId === evento.autorId) return;
    const db = criarDbTenant(evento.empresaId);
    const autor = await db.usuario.findFirst({ where: { id: evento.autorId }, select: { nome: true } });
    let onde = "um item de ação";
    let link = `/plano-acao/${evento.entidadeId}`;
    if (evento.entidadeTipo === "RNC") {
      const rnc = await db.rnc.findFirst({
        where: { id: evento.entidadeId },
        select: { codigo: true, titulo: true, restrita: true, contemDadosPessoais: true },
      });
      onde = rnc ? `a ${rotuloRnc(rnc)}` : "uma RNC";
      link = `/rncs/${evento.entidadeId}?aba=interacoes`;
    } else if (evento.entidadeTipo === "PROCESSO") {
      const p = await db.processo.findFirst({ where: { id: evento.entidadeId }, select: { codigo: true, nome: true } });
      onde = p ? `o processo ${p.codigo} — ${p.nome}` : "um processo";
      link = `/processos/${evento.entidadeId}`;
    } else if (evento.entidadeTipo === "RISCO_OPORTUNIDADE") {
      const r = await db.riscoOportunidade.findFirst({ where: { id: evento.entidadeId }, select: { numero: true, tipo: true } });
      const num = r ? String(r.numero).padStart(3, "0") : "";
      onde = !r ? "um risco/oportunidade" : r.tipo === "RISCO" ? `o risco R-${num}` : `a oportunidade O-${num}`;
      link = `/riscos/${evento.entidadeId}`;
    } else if (evento.entidadeTipo === "HIRA") {
      const l = await db.linhaHira.findFirst({ where: { id: evento.entidadeId }, select: { numero: true } });
      onde = l ? `a linha HIRA H-${String(l.numero).padStart(3, "0")}` : "uma linha HIRA";
      link = `/hira/${evento.entidadeId}`;
    } else if (evento.entidadeTipo === "LAIA") {
      const l = await db.linhaLaia.findFirst({ where: { id: evento.entidadeId }, select: { numero: true } });
      onde = l ? `a linha LAIA A-${String(l.numero).padStart(3, "0")}` : "uma linha LAIA";
      link = `/laia/${evento.entidadeId}`;
    } else if (evento.entidadeTipo === "INSPECAO") {
      const i = await db.inspecao.findFirst({ where: { id: evento.entidadeId }, select: { codigo: true } });
      onde = i ? `a inspeção ${i.codigo}` : "uma inspeção";
      link = `/inspecoes/${evento.entidadeId}`;
    } else if (evento.entidadeTipo === "AUDITORIA") {
      const au = await db.auditoria.findFirst({ where: { id: evento.entidadeId }, select: { codigo: true } });
      onde = au ? `a auditoria ${au.codigo}` : "uma auditoria";
      link = `/auditorias/${evento.entidadeId}`;
    } else if (evento.entidadeTipo === "REQUISITO_LEGAL") {
      const r = await db.requisitoLegal.findFirst({ where: { id: evento.entidadeId }, select: { codigo: true } });
      onde = r ? `o requisito legal ${r.codigo}` : "um requisito legal";
      link = `/requisitos-legais/${evento.entidadeId}`;
    } else if (evento.entidadeTipo === "DOCUMENTO") {
      const d = await db.documento.findFirst({ where: { id: evento.entidadeId }, select: { codigo: true } });
      onde = d ? `o documento ${d.codigo}` : "um documento";
      link = `/documentos/${evento.entidadeId}`;
    } else {
      const item = await db.itemAcao.findFirst({
        where: { id: evento.entidadeId },
        select: { oQue: true, planoAcao: { select: { rnc: { select: { codigo: true, titulo: true, restrita: true, contemDadosPessoais: true } } } } },
      });
      if (item) onde = `o item de ação "${descricaoItem(item)}"`;
    }
    await criarNotificacoes(db, evento.empresaId, [
      {
        usuarioId: evento.destinatarioId,
        tipo: "INTERACAO_NOVA",
        entidadeTipo: evento.entidadeTipo,
        entidadeId: evento.entidadeId,
        titulo: `Nova mensagem de ${autor?.nome ?? "um usuário"}`,
        corpo: `${autor?.nome ?? "Um usuário"} enviou uma mensagem sobre ${onde}.`,
        link,
        chave: `interacao:${evento.interacaoId}`,
      },
    ]);
  });
}
