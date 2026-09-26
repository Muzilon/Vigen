import type { Prisma, TipoEntidadeNotificacao, TipoNotificacao } from "@prisma/client";
import type { Ator } from "@/lib/ator";
import type { DbTenant } from "@/lib/db-tenant";
import { enviarEmail } from "@/lib/email";
import { montarEmail } from "@/lib/email/templates";
import { lerPreferencias } from "./preferencias";

export interface NovaNotificacao {
  usuarioId: string;
  tipo: TipoNotificacao;
  entidadeTipo?: TipoEntidadeNotificacao | null;
  entidadeId?: string | null;
  titulo: string;
  corpo: string;
  link?: string | null;
  /** Única por empresa: repetir a mesma chave não duplica (nem reenvia e-mail). */
  chave: string;
  /** Linhas extras só para o e-mail. */
  detalhesEmail?: { rotulo: string; valor: string }[];
}

type NotificacaoCriada = { id: string; usuarioId: string; titulo: string; corpo: string; link: string | null; chaveIdempotencia: string };

/**
 * Cria notificações (idempotente pela chave) e envia e-mail apenas das efetivamente criadas.
 * Falha de e-mail nunca propaga. Retorna as notificações inseridas.
 */
export async function criarNotificacoes(db: DbTenant, empresaId: string, lista: NovaNotificacao[]) {
  if (lista.length === 0) return [];
  const porChave = new Map(lista.map((n) => [n.chave, n]));
  const criadas = await db.notificacao.createManyAndReturn({
    data: [...porChave.values()].map((n) => ({
      empresaId,
      usuarioId: n.usuarioId,
      tipo: n.tipo,
      entidadeTipo: n.entidadeTipo ?? null,
      entidadeId: n.entidadeId ?? null,
      titulo: n.titulo.slice(0, 300),
      corpo: n.corpo.slice(0, 2000),
      link: n.link ?? null,
      chaveIdempotencia: n.chave,
    })),
    skipDuplicates: true,
  });
  if (criadas.length > 0) {
    await enviarEmailsDe(db, criadas, porChave).catch((e) => console.error("[notificacoes] falha ao enviar e-mails", e));
  }
  return criadas;
}

async function enviarEmailsDe(db: DbTenant, criadas: NotificacaoCriada[], extras?: Map<string, NovaNotificacao>) {
  const empresa = await db.empresa.findFirst({ select: { config: true, diasAlertaPrazo: true } });
  if (!empresa || !lerPreferencias(empresa).email) return;
  const usuarios = await db.usuario.findMany({
    where: { id: { in: [...new Set(criadas.map((c) => c.usuarioId))] }, ativo: true },
    select: { id: true, email: true, nome: true },
  });
  const porId = new Map(usuarios.map((u) => [u.id, u]));
  const enviadas: string[] = [];
  await Promise.all(
    criadas.map(async (n) => {
      const u = porId.get(n.usuarioId);
      if (!u?.email) return;
      try {
        const m = montarEmail({
          titulo: n.titulo,
          paragrafos: [`Olá, ${u.nome}.`, ...n.corpo.split("\n").filter(Boolean)],
          itens: extras?.get(n.chaveIdempotencia)?.detalhesEmail,
          link: n.link,
        });
        await enviarEmail({ para: u.email, ...m });
        enviadas.push(n.id);
      } catch (e) {
        console.error(`[notificacoes] e-mail não enviado (${n.id})`, e);
      }
    }),
  );
  if (enviadas.length) {
    await db.notificacao.updateMany({ where: { id: { in: enviadas } }, data: { emailEnviadoEm: new Date() } });
  }
}

/** Reenvia e-mails de notificações recentes que ficaram sem envio (falha transitória). */
export async function reenviarEmailsPendentes(db: DbTenant, desde: Date) {
  const pendentes = await db.notificacao.findMany({
    where: { emailEnviadoEm: null, criadoEm: { gte: desde } },
    select: { id: true, usuarioId: true, titulo: true, corpo: true, link: true, chaveIdempotencia: true },
    take: 200,
  });
  if (pendentes.length) await enviarEmailsDe(db, pendentes);
  return pendentes.length;
}

/** Executa um gatilho de notificação sem nunca propagar erro para a operação de negócio. */
export async function comSeguranca(nome: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[notificacoes] gatilho ${nome} falhou`, e);
  }
}

// ---------------------------------------------------------------- leitura (usuário logado)

function doAtor(a: Pick<Ator, "usuarioId">): Prisma.NotificacaoWhereInput {
  return { usuarioId: a.usuarioId };
}

export async function contarNotificacoesNaoLidas(a: Ator) {
  return a.db.notificacao.count({ where: { ...doAtor(a), lidaEm: null } });
}

export async function listarNotificacoes(a: Ator, opts: { somenteNaoLidas?: boolean; take?: number } = {}) {
  return a.db.notificacao.findMany({
    where: { ...doAtor(a), ...(opts.somenteNaoLidas ? { lidaEm: null } : {}) },
    orderBy: { criadoEm: "desc" },
    take: opts.take ?? 100,
  });
}

/** Marca uma notificação do próprio ator como lida; devolve o link (ou null se não existe). */
export async function marcarNotificacaoLida(a: Ator, id: string) {
  const n = await a.db.notificacao.findFirst({ where: { id, ...doAtor(a) }, select: { id: true, link: true, lidaEm: true } });
  if (!n) return null;
  if (!n.lidaEm) await a.db.notificacao.updateMany({ where: { id, ...doAtor(a), lidaEm: null }, data: { lidaEm: new Date() } });
  return n;
}

export async function marcarTodasLidas(a: Ator) {
  const r = await a.db.notificacao.updateMany({ where: { ...doAtor(a), lidaEm: null }, data: { lidaEm: new Date() } });
  return r.count;
}

/** Marca como lidas as notificações do ator sobre uma entidade (ex.: ao abrir a thread). */
export async function marcarLidasDaEntidade(
  a: Ator,
  entidadeTipo: TipoEntidadeNotificacao,
  entidadeId: string,
  tipos: TipoNotificacao[] = ["INTERACAO_NOVA"],
) {
  const r = await a.db.notificacao.updateMany({
    where: { ...doAtor(a), lidaEm: null, entidadeTipo, entidadeId, tipo: { in: tipos } },
    data: { lidaEm: new Date() },
  });
  return r.count;
}
