/**
 * Gatilhos de notificação disparados pelos serviços de domínio, sempre APÓS o commit da
 * transação e sem propagar erro (comSeguranca). Os destinatários respeitam as mesmas regras
 * de visibilidade (obra/restrita) dos serviços; RNC restrita não expõe o título.
 */
import type { Ator } from "@/lib/ator";
import { formatarData } from "@/lib/datas";
import { linkPlano } from "@/lib/plano-acao/acesso";
import { usuariosComPermissaoNaRnc } from "./destinatarios";
import { comSeguranca, criarNotificacoes, type NovaNotificacao } from "./servico";

/** RNC restrita ou com dados pessoais: nenhum texto livre (título, oQue, motivo) sai em notificação/e-mail (M2). */
export function rncSensivel(r: { restrita: boolean; contemDadosPessoais?: boolean } | null | undefined) {
  return !!r && (r.restrita || !!r.contemDadosPessoais);
}

export function rotuloRnc(r: { codigo: string; titulo: string; restrita: boolean; contemDadosPessoais?: boolean }) {
  return rncSensivel(r) ? `RNC ${r.codigo}` : `RNC ${r.codigo} — ${r.titulo}`;
}

/** Descrição de um item de ação sem expor texto livre quando a RNC de origem é sensível. */
export function descricaoItem(i: { oQue: string; planoAcao: { rnc: { codigo: string; titulo: string; restrita: boolean; contemDadosPessoais?: boolean } | null } }) {
  const rnc = i.planoAcao.rnc;
  if (!rnc) return i.oQue;
  return rncSensivel(rnc) ? `Item de ação da ${rotuloRnc(rnc)}` : `${i.oQue} (${rotuloRnc(rnc)})`;
}

export const linkRnc = (id: string) => `/rncs/${id}`;
export const linkItem = (id: string) => `/plano-acao/${id}`;

const selRnc = {
  id: true,
  codigo: true,
  titulo: true,
  restrita: true,
  contemDadosPessoais: true,
  obraId: true,
  abertoPorId: true,
  responsavelId: true,
  versao: true,
} as const;

/** RNC atribuída (criação com responsável ou troca de responsável). */
export function notificarRncAtribuida(a: Ator, rncId: string) {
  return comSeguranca("rnc-atribuida", async () => {
    const rnc = await a.db.rnc.findFirst({ where: { id: rncId }, select: { ...selRnc, gravidade: true } });
    if (!rnc?.responsavelId || rnc.responsavelId === a.usuarioId) return;
    await criarNotificacoes(a.db, a.empresaId, [
      {
        usuarioId: rnc.responsavelId,
        tipo: "RNC_ATRIBUIDA",
        entidadeTipo: "RNC",
        entidadeId: rnc.id,
        titulo: `Você é o responsável pela ${rotuloRnc(rnc)}`,
        corpo: `A ${rotuloRnc(rnc)} foi atribuída a você para tratamento.`,
        link: linkRnc(rnc.id),
        chave: `rnc-atribuida:${rnc.id}:${rnc.responsavelId}:v${rnc.versao}`,
      },
    ]);
  });
}

/** Itens de ação atribuídos (criação ou troca do "quem"). `marca` diferencia eventos distintos. */
export function notificarItensAtribuidos(a: Ator, itemIds: string[], marca: string) {
  return comSeguranca("item-atribuido", async () => {
    if (itemIds.length === 0) return;
    const itens = await a.db.itemAcao.findMany({
      where: { id: { in: itemIds }, quemId: { not: a.usuarioId } },
      select: {
        id: true,
        oQue: true,
        quando: true,
        quemId: true,
        planoAcao: {
          select: { id: true, titulo: true, rnc: { select: { codigo: true, titulo: true, restrita: true, contemDadosPessoais: true } } },
        },
      },
    });
    await criarNotificacoes(
      a.db,
      a.empresaId,
      itens.map((i) => {
        // Plano avulso (sem RNC): cita o plano e leva à página do plano.
        const manual = !i.planoAcao.rnc;
        const descricao = manual ? `${i.oQue} (Plano: ${i.planoAcao.titulo})` : descricaoItem(i);
        return {
          usuarioId: i.quemId,
          tipo: "ITEM_ATRIBUIDO",
          entidadeTipo: "ITEM_ACAO",
          entidadeId: i.id,
          titulo: "Nova ação atribuída a você",
          corpo: `${descricao}\nPrazo: ${formatarData(i.quando)}`,
          link: manual ? linkPlano(i.planoAcao.id) : linkItem(i.id),
          chave: `item-atribuido:${i.id}:${i.quemId}:${marca}`,
        } satisfies NovaNotificacao;
      }),
    );
  });
}

/** Solicitação de cancelamento → quem tem RNC_APROVAR_CANCELAMENTO e acessa a RNC. */
export function notificarCancelamentoSolicitado(a: Ator, solicitacaoId: string) {
  return comSeguranca("cancelamento-solicitado", async () => {
    const s = await a.db.solicitacaoCancelamento.findFirst({
      where: { id: solicitacaoId },
      select: { id: true, solicitante: { select: { nome: true } }, rnc: { select: selRnc } },
    });
    if (!s) return;
    const dest = await usuariosComPermissaoNaRnc(a.db, s.rnc, "RNC_APROVAR_CANCELAMENTO", [a.usuarioId]);
    await criarNotificacoes(
      a.db,
      a.empresaId,
      dest.map((u) => ({
        usuarioId: u.id,
        tipo: "CANCELAMENTO_SOLICITADO",
        entidadeTipo: "RNC",
        entidadeId: s.rnc.id,
        titulo: `Cancelamento solicitado: ${rotuloRnc(s.rnc)}`,
        // M2: o motivo (texto livre) nunca vai na notificação/e-mail; é lido no sistema.
        corpo: `${s.solicitante.nome} solicitou o cancelamento. Acesse o sistema para ver o motivo e decidir.`,
        link: `${linkRnc(s.rnc.id)}?aba=cancelamento`,
        chave: `cancelamento-solicitado:${s.id}:${u.id}`,
      })),
    );
  });
}

/** Decisão do cancelamento → solicitante. */
export function notificarCancelamentoDecidido(a: Ator, solicitacaoId: string) {
  return comSeguranca("cancelamento-decidido", async () => {
    const s = await a.db.solicitacaoCancelamento.findFirst({
      where: { id: solicitacaoId },
      select: { id: true, status: true, solicitanteId: true, aprovador: { select: { nome: true } }, rnc: { select: selRnc } },
    });
    if (!s || s.status === "PENDENTE" || s.solicitanteId === a.usuarioId) return;
    const aprovada = s.status === "APROVADA";
    await criarNotificacoes(a.db, a.empresaId, [
      {
        usuarioId: s.solicitanteId,
        tipo: "CANCELAMENTO_DECIDIDO",
        entidadeTipo: "RNC",
        entidadeId: s.rnc.id,
        titulo: `Cancelamento ${aprovada ? "aprovado" : "rejeitado"}: ${rotuloRnc(s.rnc)}`,
        // M2: comentário da decisão não vai na notificação/e-mail.
        corpo: `${s.aprovador?.nome ?? "O aprovador"} ${aprovada ? "aprovou" : "rejeitou"} sua solicitação. Acesse o sistema para ver os detalhes.`,
        link: linkRnc(s.rnc.id),
        chave: `cancelamento-decidido:${s.id}`,
      },
    ]);
  });
}

/** RNC enviada para verificação → quem tem RNC_VERIFICAR_EFICACIA e acesso à obra. */
export function notificarEnviadaVerificacao(a: Ator, rncId: string) {
  return comSeguranca("rnc-em-verificacao", async () => {
    const rnc = await a.db.rnc.findFirst({ where: { id: rncId }, select: selRnc });
    if (!rnc) return;
    const dest = await usuariosComPermissaoNaRnc(a.db, rnc, "RNC_VERIFICAR_EFICACIA", [a.usuarioId]);
    await criarNotificacoes(
      a.db,
      a.empresaId,
      dest.map((u) => ({
        usuarioId: u.id,
        tipo: "RNC_EM_VERIFICACAO",
        entidadeTipo: "RNC",
        entidadeId: rnc.id,
        titulo: `Verificação de eficácia pendente: ${rotuloRnc(rnc)}`,
        corpo: `O plano de ação foi concluído e a ${rotuloRnc(rnc)} aguarda verificação de eficácia.`,
        link: `${linkRnc(rnc.id)}?aba=verificacao`,
        chave: `rnc-em-verificacao:${rnc.id}:v${rnc.versao}:${u.id}`,
      })),
    );
  });
}
