import type { Prisma, TipoEntidadeInteracao } from "@prisma/client";
import type { Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";
import { notificar } from "@/lib/notificacoes";
import { marcarLidasDaEntidade } from "@/lib/notificacoes/servico";
import { filtroAcessoItem, filtroAcessoRnc } from "@/lib/rnc/servico";

export const MAX_MENSAGEM = 4000;

export interface Thread {
  tipo: TipoEntidadeInteracao;
  entidadeId: string;
}

/**
 * Confere se o ator vê a entidade (RNC: filtroAcessoRnc — inclui o responsável mesmo sem
 * RNC_TRATAR; item: filtroAcessoItem — inclui o "quem") e devolve o destinatário padrão.
 */
async function acessarEntidade(a: Ator, t: Thread): Promise<{ destinatarioPadrao: string | null }> {
  if (t.tipo === "RNC") {
    const rnc = await a.db.rnc.findFirst({
      where: { AND: [{ id: t.entidadeId }, filtroAcessoRnc(a)] },
      select: { abertoPorId: true, responsavelId: true },
    });
    if (!rnc) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const padrao = rnc.responsavelId && rnc.responsavelId !== a.usuarioId ? rnc.responsavelId : rnc.abertoPorId;
    return { destinatarioPadrao: padrao !== a.usuarioId ? padrao : null };
  }
  const item = await a.db.itemAcao.findFirst({
    where: { AND: [{ id: t.entidadeId }, filtroAcessoItem(a)] },
    select: { quemId: true, planoAcao: { select: { criadoPorId: true, rnc: { select: { responsavelId: true } } } } },
  });
  if (!item) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
  // "quem" fala com o responsável da RNC (ou quem criou o plano); os demais falam com o "quem".
  const padrao =
    item.quemId === a.usuarioId ? (item.planoAcao.rnc?.responsavelId ?? item.planoAcao.criadoPorId) : item.quemId;
  return { destinatarioPadrao: padrao !== a.usuarioId ? padrao : null };
}

export async function podeAcessarThread(a: Ator, t: Thread) {
  try {
    await acessarEntidade(a, t);
    return true;
  } catch {
    return false;
  }
}

export async function criarInteracao(a: Ator, t: Thread, mensagem: string, destinatarioId?: string | null) {
  const texto = mensagem.trim();
  if (!texto) throw new ErroNegocio("Escreva a mensagem.");
  if (texto.length > MAX_MENSAGEM) throw new ErroNegocio(`Mensagem excede ${MAX_MENSAGEM} caracteres.`);
  const { destinatarioPadrao } = await acessarEntidade(a, t);
  let destino = destinatarioPadrao;
  if (destinatarioId) {
    const u = await a.db.usuario.findFirst({ where: { id: destinatarioId, ativo: true }, select: { id: true } });
    if (!u) throw new ErroNegocio("Destinatário inválido.");
    destino = u.id === a.usuarioId ? null : u.id;
  }
  const i = await a.db.interacao.create({
    data: {
      empresaId: a.empresaId,
      entidadeTipo: t.tipo,
      entidadeId: t.entidadeId,
      autorId: a.usuarioId,
      destinatarioId: destino,
      mensagem: texto,
    },
  });
  try {
    await notificar({
      tipo: "INTERACAO_CRIADA",
      empresaId: a.empresaId,
      interacaoId: i.id,
      destinatarioId: destino,
      autorId: a.usuarioId,
      entidadeTipo: t.tipo,
      entidadeId: t.entidadeId,
    });
  } catch {
    // notificação é best-effort
  }
  return i;
}

/** Thread da entidade (exige acesso). */
export async function listarInteracoes(a: Ator, t: Thread) {
  await acessarEntidade(a, t);
  return a.db.interacao.findMany({
    where: { entidadeTipo: t.tipo, entidadeId: t.entidadeId },
    orderBy: { criadoEm: "asc" },
    take: 500,
    include: {
      autor: { select: { nome: true } },
      destinatario: { select: { nome: true } },
      leituras: { where: { usuarioId: a.usuarioId }, select: { lidaEm: true } },
    },
  });
}

/**
 * Marca como lidas, para o ator, as mensagens da thread escritas por outros e as
 * notificações INTERACAO_NOVA da mesma entidade. Retorna quantas mensagens foram marcadas.
 */
export async function marcarLidas(a: Ator, t: Thread) {
  await acessarEntidade(a, t);
  await marcarLidasDaEntidade(a, t.tipo, t.entidadeId);
  const pendentes = await a.db.interacao.findMany({
    where: { ...naoLidasWhere(a), entidadeTipo: t.tipo, entidadeId: t.entidadeId },
    select: { id: true },
  });
  if (pendentes.length === 0) return 0;
  const r = await a.db.leituraInteracao.createMany({
    data: pendentes.map((p) => ({ empresaId: a.empresaId, interacaoId: p.id, usuarioId: a.usuarioId })),
    skipDuplicates: true,
  });
  return r.count;
}

function naoLidasWhere(a: Ator): Prisma.InteracaoWhereInput {
  return {
    destinatarioId: a.usuarioId,
    autorId: { not: a.usuarioId },
    leituras: { none: { usuarioId: a.usuarioId } },
  };
}

export async function contarNaoLidas(a: Ator) {
  return a.db.interacao.count({ where: naoLidasWhere(a) });
}

/** Caixa "Mensagens": não lidas endereçadas ao ator. */
export async function listarNaoLidas(a: Ator, take = 20) {
  return a.db.interacao.findMany({
    where: naoLidasWhere(a),
    orderBy: { criadoEm: "desc" },
    take,
    include: { autor: { select: { nome: true } } },
  });
}

export function linkThread(t: { entidadeTipo: TipoEntidadeInteracao; entidadeId: string }) {
  return t.entidadeTipo === "RNC" ? `/rncs/${t.entidadeId}?aba=interacoes` : `/plano-acao/${t.entidadeId}`;
}
