/**
 * Motor de aprovação multi-assinante (docs/06-desenho-modulos.md, decisão 2).
 * Todas as escritas usam o db do tenant (a.db); o fluxo tem trava otimista (versao) e cada
 * passo grava HistoricoAprovacao (append-only). Notificações são disparadas após o commit.
 */
import { Prisma, type FluxoAprovacao, type ModoAprovacao, type StatusFluxoAprovacao, type TipoAlteracaoAprovacao, type TipoEntidadeAprovacao } from "@prisma/client";
import type { Ator, Tx } from "@/lib/ator";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { comSeguranca, criarNotificacoes, type NovaNotificacao } from "@/lib/notificacoes/servico";
import { aplicarDecisao, montarEtapas, normalizarComentario, validarAprovadores, type Decisao } from "./regras";
import { obterHandlerAprovacao } from "./registry";

export const linkFluxoAprovacao = (id: string) => `/aprovacoes/${id}`;
export const MAX_RESUMO = 300;

export interface DadosSolicitacao {
  entidadeTipo: TipoEntidadeAprovacao;
  entidadeId: string;
  tipoAlteracao: TipoAlteracaoAprovacao;
  modo: ModoAprovacao;
  /** Em ordem (relevante no SEQUENCIAL). */
  aprovadorIds: string[];
  /** Alteração proposta, aplicada pelo handler ao aprovar. */
  payload?: Prisma.InputJsonValue;
  /** Texto curto exibido em listas e notificações (sem dados sensíveis). */
  resumo: string;
}

function ehUnicoViolado(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function registrarHistorico(
  tx: Tx,
  a: Ator,
  fluxoId: string,
  acao: "SOLICITADO" | "APROVADO" | "REJEITADO" | "CANCELADO" | "CONCLUIDO",
  extra: { etapaId?: string | null; comentario?: string | null; metadados?: Prisma.InputJsonValue } = {},
) {
  await tx.historicoAprovacao.create({
    data: {
      empresaId: a.empresaId,
      fluxoId,
      etapaId: extra.etapaId ?? null,
      usuarioId: a.usuarioId,
      acao,
      comentario: extra.comentario ?? null,
      metadados: extra.metadados,
    },
  });
}

/** Incrementa a versão exigindo a lida e status PENDENTE; senão ErroConflito. */
async function travarFluxo(tx: Tx, f: { id: string; versao: number }, data: Prisma.FluxoAprovacaoUncheckedUpdateManyInput = {}) {
  const r = await tx.fluxoAprovacao.updateMany({
    where: { id: f.id, versao: f.versao, status: "PENDENTE" },
    data: { ...data, versao: { increment: 1 } },
  });
  if (r.count === 0) throw new ErroConflito();
}

// ---------------------------------------------------------------- escrita

export async function solicitarAprovacao(a: Ator, d: DadosSolicitacao): Promise<{ id: string }> {
  if (!obterHandlerAprovacao(d.entidadeTipo)) throw new ErroNegocio(`Tipo de entidade sem fluxo de aprovação: ${d.entidadeTipo}.`);
  const resumo = d.resumo.trim();
  if (!resumo) throw new ErroNegocio("Informe um resumo da alteração.");
  if (resumo.length > MAX_RESUMO) throw new ErroNegocio(`Resumo com no máximo ${MAX_RESUMO} caracteres.`);
  const ativos = await a.db.usuario.findMany({ where: { id: { in: d.aprovadorIds }, ativo: true }, select: { id: true } });
  validarAprovadores(a.usuarioId, d.aprovadorIds, new Set(ativos.map((u) => u.id)));

  let fluxo: { id: string };
  try {
    fluxo = await a.db.$transaction(async (tx) => {
      const f = await tx.fluxoAprovacao.create({
        data: {
          empresaId: a.empresaId,
          entidadeTipo: d.entidadeTipo,
          entidadeId: d.entidadeId,
          tipoAlteracao: d.tipoAlteracao,
          modo: d.modo,
          solicitanteId: a.usuarioId,
          payload: d.payload ?? {},
          resumo,
        },
        select: { id: true },
      });
      await tx.etapaAprovacao.createMany({
        data: montarEtapas(d.modo, d.aprovadorIds).map((e) => ({ ...e, empresaId: a.empresaId, fluxoId: f.id })),
      });
      await registrarHistorico(tx, a, f.id, "SOLICITADO", { metadados: { modo: d.modo, aprovadorIds: d.aprovadorIds } });
      return f;
    });
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio("Já existe uma aprovação pendente para este registro.");
    throw e;
  }
  await notificarPendentes(a, fluxo.id);
  return fluxo;
}

export interface DadosDecisao {
  decisao: Decisao;
  comentario?: string | null;
  /** Versão do fluxo vista pelo usuário (opcional; conflito se mudou). */
  versao?: number;
}

export async function decidir(a: Ator, fluxoId: string, d: DadosDecisao): Promise<{ status: StatusFluxoAprovacao }> {
  const comentario = normalizarComentario(d.decisao, d.comentario);
  const r = await a.db.$transaction(async (tx) => {
    const fluxo = await tx.fluxoAprovacao.findFirst({ where: { id: fluxoId }, include: { etapas: true } });
    if (!fluxo || !fluxo.etapas.some((e) => e.aprovadorId === a.usuarioId)) throw new ErroNegocio("Fluxo de aprovação não encontrado.");
    if (fluxo.status !== "PENDENTE") throw new ErroNegocio("Este fluxo de aprovação já foi encerrado.");
    if (d.versao !== undefined && d.versao !== fluxo.versao) throw new ErroConflito();
    const res = aplicarDecisao(fluxo.etapas, a.usuarioId, d.decisao);
    const agora = new Date();
    const final = res.statusFluxo !== "PENDENTE";
    await travarFluxo(tx, fluxo, final ? { status: res.statusFluxo, concluidoEm: agora } : {});
    for (const m of res.mudancas) {
      const decidida = m.id === res.etapaId;
      const u = await tx.etapaAprovacao.updateMany({
        where: { id: m.id, fluxoId, status: decidida ? "PENDENTE" : { in: ["PENDENTE", "AGUARDANDO"] } },
        data: { status: m.status, ...(decidida ? { decididoEm: agora, comentario } : {}) },
      });
      if (u.count === 0) throw new ErroConflito();
    }
    await registrarHistorico(tx, a, fluxoId, d.decisao === "APROVAR" ? "APROVADO" : "REJEITADO", { etapaId: res.etapaId, comentario });
    if (final) {
      const atualizado: FluxoAprovacao = { ...fluxo, status: res.statusFluxo, concluidoEm: agora, versao: fluxo.versao + 1 };
      const h = obterHandlerAprovacao(fluxo.entidadeTipo);
      if (res.statusFluxo === "APROVADO") {
        if (!h) throw new ErroNegocio(`Tipo de entidade sem fluxo de aprovação: ${fluxo.entidadeTipo}.`);
        await h.aoAprovar(tx, atualizado, a);
      } else if (h?.aoRejeitar) {
        await h.aoRejeitar(tx, atualizado, a);
      }
      await registrarHistorico(tx, a, fluxoId, "CONCLUIDO", { metadados: { status: res.statusFluxo } });
    }
    return res;
  });
  if (r.statusFluxo === "PENDENTE") await notificarPendentes(a, fluxoId);
  else await notificarDecisaoFinal(a, fluxoId);
  return { status: r.statusFluxo };
}

/** Só o solicitante cancela, e apenas enquanto PENDENTE. */
export async function cancelar(a: Ator, fluxoId: string, motivo?: string | null, versao?: number) {
  const m = (motivo ?? "").trim() || null;
  await a.db.$transaction(async (tx) => {
    const fluxo = await tx.fluxoAprovacao.findFirst({ where: { id: fluxoId, solicitanteId: a.usuarioId } });
    if (!fluxo) throw new ErroNegocio("Fluxo de aprovação não encontrado.");
    if (fluxo.status !== "PENDENTE") throw new ErroNegocio("Somente fluxos pendentes podem ser cancelados.");
    if (versao !== undefined && versao !== fluxo.versao) throw new ErroConflito();
    await travarFluxo(tx, fluxo, { status: "CANCELADO", concluidoEm: new Date() });
    await tx.etapaAprovacao.updateMany({ where: { fluxoId, status: { in: ["PENDENTE", "AGUARDANDO"] } }, data: { status: "IGNORADA" } });
    await registrarHistorico(tx, a, fluxoId, "CANCELADO", { comentario: m });
  });
}

// ---------------------------------------------------------------- leitura

const incluirResumo = {
  solicitante: { select: { id: true, nome: true } },
  etapas: { orderBy: { ordem: "asc" }, include: { aprovador: { select: { id: true, nome: true } } } },
} satisfies Prisma.FluxoAprovacaoInclude;

/** Fluxos PENDENTE em que a etapa do ator está PENDENTE (é a vez dele). */
export async function listarAguardandoMim(a: Ator) {
  return a.db.fluxoAprovacao.findMany({
    where: { status: "PENDENTE", etapas: { some: { aprovadorId: a.usuarioId, status: "PENDENTE" } } },
    include: incluirResumo,
    orderBy: { criadoEm: "asc" },
    take: 200,
  });
}

export async function listarSolicitadasPorMim(a: Ator, opts: { status?: StatusFluxoAprovacao[]; take?: number } = {}) {
  return a.db.fluxoAprovacao.findMany({
    where: { solicitanteId: a.usuarioId, ...(opts.status ? { status: { in: opts.status } } : {}) },
    include: incluirResumo,
    orderBy: { criadoEm: "desc" },
    take: opts.take ?? 200,
  });
}

/** Fluxos de uma entidade (ex.: aba "Aprovações" do registro), filtrados por visibilidade. */
export async function listarFluxosDaEntidade(a: Ator, entidadeTipo: TipoEntidadeAprovacao, entidadeId: string) {
  const fs = await a.db.fluxoAprovacao.findMany({ where: { entidadeTipo, entidadeId }, include: incluirResumo, orderBy: { criadoEm: "desc" } });
  const out: typeof fs = [];
  for (const f of fs) if (await podeVerFluxo(a, f)) out.push(f);
  return out;
}

export async function podeVerFluxo(a: Ator, f: FluxoAprovacao & { etapas: { aprovadorId: string }[] }) {
  if (f.solicitanteId === a.usuarioId || f.etapas.some((e) => e.aprovadorId === a.usuarioId)) return true;
  const h = obterHandlerAprovacao(f.entidadeTipo);
  return h?.podeVer ? !!(await h.podeVer(a, f)) : false;
}

/** Detalhe com etapas e histórico; null se não existe ou sem acesso. */
export async function obterFluxo(a: Ator, fluxoId: string) {
  const f = await a.db.fluxoAprovacao.findFirst({
    where: { id: fluxoId },
    include: {
      ...incluirResumo,
      historico: { orderBy: { criadoEm: "asc" }, include: { usuario: { select: { id: true, nome: true } } } },
    },
  });
  if (!f || !(await podeVerFluxo(a, f))) return null;
  const minhaEtapa = f.etapas.find((e) => e.aprovadorId === a.usuarioId && e.status === "PENDENTE") ?? null;
  return {
    ...f,
    podeDecidir: f.status === "PENDENTE" && !!minhaEtapa,
    podeCancelar: f.status === "PENDENTE" && f.solicitanteId === a.usuarioId,
  };
}

// ---------------------------------------------------------------- notificações

const ROTULO_ALTERACAO: Record<TipoAlteracaoAprovacao, string> = {
  INCLUSAO: "Inclusão",
  ALTERACAO: "Alteração",
  EXCLUSAO: "Exclusão",
  PUBLICACAO: "Publicação",
};

/** Aprovadores cuja etapa está PENDENTE (idempotente por etapa). */
function notificarPendentes(a: Ator, fluxoId: string) {
  return comSeguranca("aprovacao-pendente", async () => {
    const f = await a.db.fluxoAprovacao.findFirst({
      where: { id: fluxoId, status: "PENDENTE" },
      include: { solicitante: { select: { nome: true } }, etapas: { where: { status: "PENDENTE" } } },
    });
    if (!f) return;
    await criarNotificacoes(
      a.db,
      a.empresaId,
      f.etapas.map(
        (e): NovaNotificacao => ({
          usuarioId: e.aprovadorId,
          tipo: "APROVACAO_PENDENTE",
          entidadeTipo: "FLUXO_APROVACAO",
          entidadeId: f.id,
          titulo: `Aprovação pendente: ${f.resumo}`,
          corpo: `${f.solicitante.nome} solicitou sua aprovação (${ROTULO_ALTERACAO[f.tipoAlteracao].toLowerCase()}). Acesse o sistema para aprovar ou rejeitar.`,
          link: linkFluxoAprovacao(f.id),
          chave: `aprovacao-pendente:${e.id}`,
        }),
      ),
    );
  });
}

/** Solicitante, na decisão final (aprovado/rejeitado). Comentário não vai no e-mail. */
function notificarDecisaoFinal(a: Ator, fluxoId: string) {
  return comSeguranca("aprovacao-decidida", async () => {
    const f = await a.db.fluxoAprovacao.findFirst({ where: { id: fluxoId } });
    if (!f || (f.status !== "APROVADO" && f.status !== "REJEITADO")) return;
    const aprovado = f.status === "APROVADO";
    await criarNotificacoes(a.db, a.empresaId, [
      {
        usuarioId: f.solicitanteId,
        tipo: "APROVACAO_DECIDIDA",
        entidadeTipo: "FLUXO_APROVACAO",
        entidadeId: f.id,
        titulo: `${aprovado ? "Aprovado" : "Rejeitado"}: ${f.resumo}`,
        corpo: aprovado
          ? "Todos os aprovadores assinaram e a alteração foi aplicada."
          : "Sua solicitação foi rejeitada. Acesse o sistema para ver o motivo.",
        link: linkFluxoAprovacao(f.id),
        chave: `aprovacao-decidida:${f.id}`,
      },
    ]);
  });
}

// ---------------------------------------------------------------- apoio às telas

/** Contador do menu "Aprovações": fluxos em que é a vez do ator. */
export function contarAguardandoMim(a: Ator) {
  return a.db.fluxoAprovacao.count({
    where: { status: "PENDENTE", etapas: { some: { aprovadorId: a.usuarioId, status: "PENDENTE" } } },
  });
}

/** Usuários ativos que podem ser escolhidos como aprovadores (exclui o próprio ator). */
export function listarAprovadoresPossiveis(a: Ator) {
  return a.db.usuario.findMany({
    where: { ativo: true, id: { not: a.usuarioId } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

export type FluxoResumo = Awaited<ReturnType<typeof listarAguardandoMim>>[number];
