import type { Prisma, TipoEntidadeInteracao } from "@prisma/client";
import type { Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";
import { notificar } from "@/lib/notificacoes";
import { marcarLidasDaEntidade } from "@/lib/notificacoes/servico";
import { filtroObras } from "@/lib/escopo-obras";
import { moduloHiraAtivo } from "@/lib/hira/servico";
import { moduloLaiaAtivo } from "@/lib/laia/servico";
import { acessoDocumento } from "@/lib/documentos/acesso";
import { moduloProcessosAtivo } from "@/lib/processos/servico";
import { filtroObraRisco, moduloRiscosAtivo } from "@/lib/riscos/servico";
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
  if (t.tipo === "PROCESSO") {
    // Mapa de processos: qualquer usuário da empresa com o módulo contratado; fala com o dono.
    if (!(await moduloProcessosAtivo(a))) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const p = await a.db.processo.findFirst({ where: { id: t.entidadeId }, select: { donoId: true } });
    if (!p) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    return { destinatarioPadrao: p.donoId && p.donoId !== a.usuarioId ? p.donoId : null };
  }
  if (t.tipo === "RISCO_OPORTUNIDADE") {
    // Riscos: usuários da empresa com o módulo (escopo de obras); fala com o responsável.
    if (!(await moduloRiscosAtivo(a))) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const r = await a.db.riscoOportunidade.findFirst({
      where: { AND: [{ id: t.entidadeId, ativo: true }, filtroObraRisco(a)] },
      select: { responsavelId: true, criadoPorId: true },
    });
    if (!r) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const padrao = r.responsavelId ?? r.criadoPorId;
    return { destinatarioPadrao: padrao !== a.usuarioId ? padrao : null };
  }
  if (t.tipo === "HIRA") {
    // HIRA: usuários com o módulo e a obra no escopo; fala com o responsável da linha.
    if (!(await moduloHiraAtivo(a))) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const l = await a.db.linhaHira.findFirst({ where: { AND: [{ id: t.entidadeId }, filtroObras(a)] }, select: { responsavelId: true, criadoPorId: true } });
    if (!l) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const padrao = l.responsavelId ?? l.criadoPorId;
    return { destinatarioPadrao: padrao !== a.usuarioId ? padrao : null };
  }
  if (t.tipo === "LAIA") {
    // LAIA: usuários com o módulo e a obra no escopo; fala com o responsável da linha.
    if (!(await moduloLaiaAtivo(a))) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const l = await a.db.linhaLaia.findFirst({ where: { AND: [{ id: t.entidadeId }, filtroObras(a)] }, select: { responsavelId: true, criadoPorId: true } });
    if (!l) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const padrao = l.responsavelId ?? l.criadoPorId;
    return { destinatarioPadrao: padrao !== a.usuarioId ? padrao : null };
  }
  if (t.tipo === "DOCUMENTO") {
    // Documentos: comentários para quem tem acesso completo (lista mestra, responsável, signatários); fala com o responsável.
    if (!(await acessoDocumento(a, t.entidadeId)).completo) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    const d = await a.db.documento.findFirst({ where: { id: t.entidadeId }, select: { responsavelId: true } });
    if (!d) throw new ErroNegocio("Registro não encontrado ou sem acesso.");
    return { destinatarioPadrao: d.responsavelId !== a.usuarioId ? d.responsavelId : null };
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
  if (t.entidadeTipo === "RNC") return `/rncs/${t.entidadeId}?aba=interacoes`;
  if (t.entidadeTipo === "PROCESSO") return `/processos/${t.entidadeId}`;
  if (t.entidadeTipo === "RISCO_OPORTUNIDADE") return `/riscos/${t.entidadeId}`;
  if (t.entidadeTipo === "HIRA") return `/hira/${t.entidadeId}`;
  if (t.entidadeTipo === "LAIA") return `/laia/${t.entidadeId}`;
  if (t.entidadeTipo === "DOCUMENTO") return `/documentos/${t.entidadeId}`;
  return `/plano-acao/${t.entidadeId}`;
}
