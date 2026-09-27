/**
 * Auditorias internas (P5, docs/06-desenho-modulos.md) — serviço de domínio.
 * Programa anual, auditorias (AUD-NNN-AA) com plano (itens de requisito/pergunta), constatações
 * (NC, observação, oportunidade de melhoria, ponto forte) e — como nas inspeções — a constatação de
 * não conformidade abre uma RNC real (origem AUDITORIA_INTERNA/EXTERNA) com as evidências anexadas.
 */
import type { Gravidade, Prisma, StatusAuditoria, TipoAuditoria, TipoConstatacao, TipoRnc } from "@prisma/client";
import { fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { anoNoFuso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { obraNoEscopo } from "@/lib/escopo-obras";
import { copiarAnexos } from "@/lib/inspecoes/servico";
import { notificarRncAtribuida } from "@/lib/notificacoes/gatilhos";
import { comSeguranca, criarNotificacoes } from "@/lib/notificacoes/servico";
import { moverNaLista } from "@/lib/inspecoes/regras";
import { formatarCodigoAnual, proximaSequencia } from "@/lib/rnc/numeracao";
import { criarRncNaTransacao } from "@/lib/rnc/servico";
import { exigirModuloAuditorias, filtroObraAuditoria, linkAuditoria, moduloAuditoriasAtivo, podeExecutarAuditoria, podeGerenciarAuditorias } from "./acesso";
import {
  contarPorTipo,
  descricaoRncDaConstatacao,
  exigirStatus,
  origemRncDaAuditoria,
  tipoRncDaNorma,
  tituloRncDaConstatacao,
  TIPOS_AUDITORIA,
  TIPOS_CONSTATACAO,
} from "./regras";

export * from "./acesso";

async function exigirGestao(a: Ator) {
  await exigirModuloAuditorias(a);
  if (!podeGerenciarAuditorias(a)) throw new ErroNegocio("Sem permissão para planejar auditorias (AUDITORIA_GERENCIAR).");
}

const texto = (s: string | null | undefined, nome: string, min: number, max: number) => {
  const t = (s ?? "").trim();
  if (t.length < min) throw new ErroNegocio(min > 0 ? `Informe ${nome}.` : `${nome} inválido.`);
  if (t.length > max) throw new ErroNegocio(`${nome[0].toUpperCase()}${nome.slice(1)} excede ${max} caracteres.`);
  return t;
};
const opcional = (s: string | null | undefined, nome: string, max: number) => {
  const t = s?.trim() || null;
  if (t && t.length > max) throw new ErroNegocio(`${nome} excede ${max} caracteres.`);
  return t;
};

// ---------------------------------------------------------------- programa anual

export async function listarProgramas(a: Ator) {
  await exigirModuloAuditorias(a);
  return a.db.programaAuditoria.findMany({
    orderBy: { ano: "desc" },
    include: {
      criadoPor: { select: { nome: true } },
      auditorias: {
        where: filtroObraAuditoria(a),
        orderBy: [{ dataInicio: "asc" }, { sequencia: "asc" }],
        include: { auditorLider: { select: { nome: true } }, processo: { select: { codigo: true } }, obra: { select: { nome: true } }, constatacoes: { select: { tipo: true } } },
      },
    },
  });
}

export async function salvarPrograma(a: Ator, d: { ano: number; objetivo: string }) {
  await exigirGestao(a);
  if (!Number.isInteger(d.ano) || d.ano < 2000 || d.ano > 2100) throw new ErroNegocio("Ano inválido.");
  const objetivo = texto(d.objetivo, "o objetivo do programa", 3, 4000);
  return a.db.programaAuditoria.upsert({
    where: { empresaId_ano: { empresaId: a.empresaId, ano: d.ano } },
    update: { objetivo },
    create: { empresaId: a.empresaId, ano: d.ano, objetivo, criadoPorId: a.usuarioId },
    select: { id: true },
  });
}

// ---------------------------------------------------------------- leitura

export interface FiltrosAuditoria {
  status?: StatusAuditoria;
  tipo?: TipoAuditoria;
  ano?: number;
  obra?: string;
}

export async function opcoesAuditorias(a: Ator) {
  const [programas, obras, processos, usuarios] = await Promise.all([
    a.db.programaAuditoria.findMany({ select: { id: true, ano: true }, orderBy: { ano: "desc" } }),
    a.db.obraUnidade.findMany({ where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { programas, obras, processos, usuarios };
}

export async function listarAuditorias(a: Ator, f: FiltrosAuditoria = {}) {
  await exigirModuloAuditorias(a);
  const as = await a.db.auditoria.findMany({
    where: {
      AND: [
        filtroObraAuditoria(a),
        f.status ? { status: f.status } : {},
        f.tipo ? { tipo: f.tipo } : {},
        f.ano ? { dataInicio: { gte: new Date(Date.UTC(f.ano, 0, 1)), lt: new Date(Date.UTC(f.ano + 1, 0, 1)) } } : {},
        f.obra ? { obraId: f.obra } : {},
      ],
    },
    include: {
      auditorLider: { select: { id: true, nome: true } },
      processo: { select: { id: true, codigo: true, nome: true } },
      obra: { select: { id: true, nome: true } },
      constatacoes: { select: { tipo: true, geradaRncId: true } },
    },
    orderBy: [{ dataInicio: "desc" }, { sequencia: "desc" }],
    take: 300,
  });
  return as.map(({ constatacoes, ...x }) => ({ ...x, porTipo: contarPorTipo(constatacoes), rncsGeradas: constatacoes.filter((c) => c.geradaRncId).length }));
}

export async function obterAuditoria(a: Ator, id: string) {
  await exigirModuloAuditorias(a);
  return a.db.auditoria.findFirst({
    where: { AND: [{ id }, filtroObraAuditoria(a)] },
    include: {
      programa: { select: { id: true, ano: true } },
      auditorLider: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      processo: { select: { id: true, codigo: true, nome: true } },
      obra: { select: { id: true, nome: true } },
      itens: { orderBy: { ordem: "asc" } },
      constatacoes: {
        orderBy: { criadoEm: "asc" },
        include: { itemAuditoria: { select: { id: true, ordem: true, requisito: true } }, criadoPor: { select: { nome: true } }, geradaRnc: { select: { id: true, codigo: true, status: true } } },
      },
    },
  });
}

// ---------------------------------------------------------------- planejamento

export interface DadosAuditoria {
  programaId?: string | null;
  tipo: TipoAuditoria;
  norma: string;
  escopo: string;
  processoId?: string | null;
  obraId?: string | null;
  auditorLiderId: string;
  equipe?: string | null;
  /** YYYY-MM-DD */
  dataInicio: string;
  dataFim: string;
}

async function dadosAuditoria(tx: Tx, a: Ator, d: DadosAuditoria) {
  if (!TIPOS_AUDITORIA.includes(d.tipo)) throw new ErroNegocio("Tipo de auditoria inválido.");
  const norma = texto(d.norma, "a norma", 2, 200);
  const escopo = texto(d.escopo, "o escopo", 3, 4000);
  const equipe = opcional(d.equipe, "Equipe", 1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(d.dataFim)) throw new ErroNegocio("Datas inválidas.");
  if (d.dataFim < d.dataInicio) throw new ErroNegocio("A data de término não pode ser anterior à de início.");
  if (d.obraId && !obraNoEscopo(a, d.obraId)) throw new ErroNegocio("Unidade inválida ou sem acesso.");
  if (d.obraId && !(await tx.obraUnidade.findFirst({ where: { id: d.obraId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Unidade inválida.");
  if (d.processoId && !(await tx.processo.findFirst({ where: { id: d.processoId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Processo inválido.");
  if (d.programaId && !(await tx.programaAuditoria.findFirst({ where: { id: d.programaId }, select: { id: true } }))) throw new ErroNegocio("Programa inválido.");
  const lider = await tx.usuario.findFirst({ where: { id: d.auditorLiderId, ativo: true }, select: { id: true } });
  if (!lider) throw new ErroNegocio("Auditor líder inválido.");
  return {
    programaId: d.programaId || null,
    tipo: d.tipo,
    norma,
    escopo,
    processoId: d.processoId || null,
    obraId: d.obraId || null,
    auditorLiderId: d.auditorLiderId,
    equipe,
    dataInicio: paraDataDb(d.dataInicio),
    dataFim: paraDataDb(d.dataFim),
  };
}

/** Planeja uma auditoria (PLANEJADA), com itens iniciais opcionais do plano. Notifica o auditor líder. */
export async function criarAuditoria(a: Ator, d: DadosAuditoria, itens: { requisito: string; pergunta?: string | null }[] = []) {
  await exigirGestao(a);
  const ano = anoNoFuso(await fusoDaEmpresa(a));
  const criada = await a.db.$transaction(async (tx) => {
    const dados = await dadosAuditoria(tx, a, d);
    const its = itens.map(dadosItem);
    const sequencia = await proximaSequencia(tx, a.empresaId, "AUDITORIA", ano);
    const au = await tx.auditoria.create({
      data: { ...dados, empresaId: a.empresaId, ano, sequencia, codigo: formatarCodigoAnual("AUD", sequencia, ano), criadoPorId: a.usuarioId },
      select: { id: true, codigo: true, auditorLiderId: true },
    });
    if (its.length) await tx.itemAuditoria.createMany({ data: its.map((x, i) => ({ ...x, empresaId: a.empresaId, auditoriaId: au.id, ordem: i + 1 })) });
    return au;
  });
  await notificarLider(a, criada);
  return criada;
}

async function notificarLider(a: Ator, au: { id: string; codigo: string; auditorLiderId: string }) {
  if (au.auditorLiderId === a.usuarioId) return;
  await comSeguranca("auditoria-atribuida", async () => {
    await criarNotificacoes(a.db, a.empresaId, [
      {
        usuarioId: au.auditorLiderId,
        tipo: "AUDITORIA_ATRIBUIDA",
        entidadeTipo: "AUDITORIA",
        entidadeId: au.id,
        titulo: `Você é o auditor líder da ${au.codigo}`,
        corpo: `A auditoria ${au.codigo} foi planejada com você como auditor líder.`,
        link: linkAuditoria(au.id),
        chave: `auditoria-lider:${au.id}:${au.auditorLiderId}`,
      },
    ]);
  });
}

async function carregar(tx: Tx, a: Ator, id: string) {
  const au = await tx.auditoria.findFirst({ where: { AND: [{ id }, filtroObraAuditoria(a)] } });
  if (!au) throw new ErroNegocio("Auditoria não encontrada ou sem acesso.");
  return au;
}

async function carregarExecutavel(tx: Tx, a: Ator, id: string) {
  const au = await carregar(tx, a, id);
  if (!podeExecutarAuditoria(a, au)) throw new ErroNegocio("Somente o auditor líder ou quem gerencia auditorias pode alterar esta auditoria.");
  return au;
}

async function travar(tx: Tx, au: { id: string; versao: number; status: StatusAuditoria }, data: Prisma.AuditoriaUncheckedUpdateManyInput = {}) {
  const r = await tx.auditoria.updateMany({ where: { id: au.id, versao: au.versao, status: au.status }, data: { ...data, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
}

export async function editarAuditoria(a: Ator, id: string, d: DadosAuditoria, versao?: number) {
  await exigirGestao(a);
  const r = await a.db.$transaction(async (tx) => {
    const au = await carregar(tx, a, id);
    exigirStatus(au.status, "EDITAR_PLANO");
    if (versao !== undefined && versao !== au.versao) throw new ErroConflito();
    const dados = await dadosAuditoria(tx, a, d);
    await travar(tx, au, dados);
    return { id: au.id, codigo: au.codigo, auditorLiderId: dados.auditorLiderId, trocouLider: dados.auditorLiderId !== au.auditorLiderId };
  });
  if (r.trocouLider) await notificarLider(a, r);
}

export async function iniciarAuditoria(a: Ator, id: string, versao?: number) {
  await exigirModuloAuditorias(a);
  await a.db.$transaction(async (tx) => {
    const au = await carregarExecutavel(tx, a, id);
    exigirStatus(au.status, "INICIAR");
    if (versao !== undefined && versao !== au.versao) throw new ErroConflito();
    await travar(tx, au, { status: "EM_EXECUCAO" });
  });
}

export async function concluirAuditoria(a: Ator, id: string, conclusao: string, versao?: number) {
  await exigirModuloAuditorias(a);
  const c = texto(conclusao, "a conclusão da auditoria", 3, 8000);
  await a.db.$transaction(async (tx) => {
    const au = await carregarExecutavel(tx, a, id);
    exigirStatus(au.status, "CONCLUIR");
    if (versao !== undefined && versao !== au.versao) throw new ErroConflito();
    await travar(tx, au, { status: "CONCLUIDA", conclusao: c, concluidaEm: new Date() });
  });
}

export async function cancelarAuditoria(a: Ator, id: string, motivo: string, versao?: number) {
  await exigirGestao(a);
  const m = texto(motivo, "o motivo do cancelamento", 3, 2000);
  await a.db.$transaction(async (tx) => {
    const au = await carregar(tx, a, id);
    exigirStatus(au.status, "CANCELAR");
    if (versao !== undefined && versao !== au.versao) throw new ErroConflito();
    if (await tx.constatacao.count({ where: { auditoriaId: id, geradaRncId: { not: null } } })) throw new ErroNegocio("A auditoria já gerou RNC: conclua-a em vez de cancelar.");
    await travar(tx, au, { status: "CANCELADA", conclusao: `Cancelada: ${m}` });
  });
}

// ---------------------------------------------------------------- plano (itens)

function dadosItem(d: { requisito: string; pergunta?: string | null }) {
  return { requisito: texto(d.requisito, "o requisito/cláusula", 1, 500), pergunta: opcional(d.pergunta, "Pergunta/critério", 2000) };
}

export async function adicionarItemAuditoria(a: Ator, auditoriaId: string, d: { requisito: string; pergunta?: string | null }) {
  await exigirModuloAuditorias(a);
  const item = dadosItem(d);
  return a.db.$transaction(async (tx) => {
    const au = await carregarExecutavel(tx, a, auditoriaId);
    exigirStatus(au.status, "EDITAR_PLANO");
    await travar(tx, au);
    const ult = await tx.itemAuditoria.findFirst({ where: { auditoriaId }, orderBy: { ordem: "desc" }, select: { ordem: true } });
    return tx.itemAuditoria.create({ data: { ...item, empresaId: a.empresaId, auditoriaId, ordem: (ult?.ordem ?? 0) + 1 }, select: { id: true } });
  });
}

async function itemExecutavel(tx: Tx, a: Ator, itemId: string) {
  const it = await tx.itemAuditoria.findFirst({ where: { id: itemId } });
  if (!it) throw new ErroNegocio("Item do plano não encontrado.");
  const au = await carregarExecutavel(tx, a, it.auditoriaId);
  exigirStatus(au.status, "EDITAR_PLANO");
  await travar(tx, au);
  return it;
}

export async function editarItemAuditoria(a: Ator, itemId: string, d: { requisito: string; pergunta?: string | null }) {
  await exigirModuloAuditorias(a);
  const item = dadosItem(d);
  await a.db.$transaction(async (tx) => {
    await itemExecutavel(tx, a, itemId);
    await tx.itemAuditoria.update({ where: { id: itemId }, data: item });
  });
}

/** Remove item do plano sem constatações vinculadas e recompacta a ordem. */
export async function removerItemAuditoria(a: Ator, itemId: string) {
  await exigirModuloAuditorias(a);
  await a.db.$transaction(async (tx) => {
    const it = await itemExecutavel(tx, a, itemId);
    if (await tx.constatacao.count({ where: { itemAuditoriaId: itemId } })) throw new ErroNegocio("O item tem constatações registradas e não pode ser removido.");
    await tx.itemAuditoria.delete({ where: { id: itemId } });
    const restantes = await tx.itemAuditoria.findMany({ where: { auditoriaId: it.auditoriaId }, orderBy: { ordem: "asc" }, select: { id: true } });
    for (const [i, r] of restantes.entries()) await tx.itemAuditoria.update({ where: { id: r.id }, data: { ordem: i + 1 } });
  });
}

export async function moverItemAuditoria(a: Ator, itemId: string, direcao: "cima" | "baixo") {
  await exigirModuloAuditorias(a);
  await a.db.$transaction(async (tx) => {
    const it = await itemExecutavel(tx, a, itemId);
    const lista = await tx.itemAuditoria.findMany({ where: { auditoriaId: it.auditoriaId }, orderBy: { ordem: "asc" }, select: { id: true } });
    for (const [i, r] of moverNaLista(lista, itemId, direcao).entries()) await tx.itemAuditoria.update({ where: { id: r.id }, data: { ordem: i + 1 } });
  });
}

// ---------------------------------------------------------------- constatações

export interface DadosConstatacao {
  itemAuditoriaId?: string | null;
  tipo: TipoConstatacao;
  descricao: string;
  evidencia?: string | null;
}

export async function registrarConstatacao(a: Ator, auditoriaId: string, d: DadosConstatacao) {
  await exigirModuloAuditorias(a);
  if (!TIPOS_CONSTATACAO.includes(d.tipo)) throw new ErroNegocio("Tipo de constatação inválido.");
  const descricao = texto(d.descricao, "a descrição da constatação", 3, 4000);
  const evidencia = opcional(d.evidencia, "Evidência", 4000);
  return a.db.$transaction(async (tx) => {
    const au = await carregarExecutavel(tx, a, auditoriaId);
    exigirStatus(au.status, "CONSTATAR");
    if (d.itemAuditoriaId && !(await tx.itemAuditoria.findFirst({ where: { id: d.itemAuditoriaId, auditoriaId }, select: { id: true } }))) {
      throw new ErroNegocio("Item do plano inválido.");
    }
    await travar(tx, au);
    return tx.constatacao.create({
      data: { empresaId: a.empresaId, auditoriaId, itemAuditoriaId: d.itemAuditoriaId || null, tipo: d.tipo, descricao, evidencia, criadoPorId: a.usuarioId },
      select: { id: true },
    });
  });
}

async function carregarConstatacao(tx: Tx, a: Ator, id: string) {
  const c = await tx.constatacao.findFirst({ where: { id }, include: { itemAuditoria: { select: { requisito: true } } } });
  if (!c) throw new ErroNegocio("Constatação não encontrada.");
  const au = await carregarExecutavel(tx, a, c.auditoriaId);
  return { c, au };
}

export async function removerConstatacao(a: Ator, id: string) {
  await exigirModuloAuditorias(a);
  await a.db.$transaction(async (tx) => {
    const { c, au } = await carregarConstatacao(tx, a, id);
    exigirStatus(au.status, "CONSTATAR");
    if (c.geradaRncId) throw new ErroNegocio("A constatação já gerou RNC e não pode ser removida.");
    await travar(tx, au);
    await tx.constatacao.delete({ where: { id } });
  });
}

export interface DadosRncDaConstatacao {
  titulo?: string | null;
  descricao?: string | null;
  tipo?: TipoRnc | null;
  gravidade: Gravidade;
  /** Obrigatória quando a auditoria não tem obra. */
  obraId?: string | null;
  responsavelId?: string | null;
}

export function sugestaoRncConstatacao(
  au: { codigo: string; tipo: TipoAuditoria; norma: string; auditorLider: { nome: string } },
  c: { descricao: string; evidencia: string | null; itemAuditoria: { requisito: string } | null },
) {
  return {
    titulo: tituloRncDaConstatacao(au.codigo, c.descricao),
    descricao: descricaoRncDaConstatacao({
      codigo: au.codigo,
      tipoAuditoria: au.tipo,
      norma: au.norma,
      requisito: c.itemAuditoria?.requisito ?? null,
      descricao: c.descricao,
      evidencia: c.evidencia,
      auditor: au.auditorLider.nome,
    }),
    tipo: tipoRncDaNorma(au.norma),
    origem: origemRncDaAuditoria(au.tipo),
  };
}

/** Abre RNC real a partir de uma constatação de não conformidade (origem conforme o tipo da auditoria; anexos viram evidências). */
export async function abrirRncDaConstatacao(a: Ator, constatacaoId: string, d: DadosRncDaConstatacao) {
  await exigirModuloAuditorias(a);
  const rnc = await a.db.$transaction(async (tx) => {
    const { c, au } = await carregarConstatacao(tx, a, constatacaoId);
    exigirStatus(au.status, "GERAR_RNC");
    if (c.tipo !== "NAO_CONFORMIDADE") throw new ErroNegocio("Somente constatações de não conformidade geram RNC.");
    if (c.geradaRncId) throw new ErroNegocio("Esta constatação já gerou uma RNC.");
    const obraId = au.obraId ?? d.obraId;
    if (!obraId) throw new ErroNegocio("Escolha a unidade da RNC (a auditoria não tem unidade).");
    const lider = await tx.usuario.findFirst({ where: { id: au.auditorLiderId }, select: { nome: true } });
    const processo = au.processoId ? await tx.processo.findFirst({ where: { id: au.processoId }, select: { codigo: true, nome: true } }) : null;
    const sug = sugestaoRncConstatacao({ ...au, auditorLider: { nome: lider?.nome ?? "—" } }, c);
    const criada = await criarRncNaTransacao(tx, a, {
      titulo: d.titulo?.trim() || sug.titulo,
      descricao: d.descricao?.trim() || sug.descricao,
      tipo: d.tipo ?? sug.tipo,
      origem: sug.origem,
      gravidade: d.gravidade,
      obraId,
      processoArea: processo ? `${processo.codigo} — ${processo.nome}` : null,
      responsavelId: d.responsavelId || null,
    });
    const u = await tx.constatacao.updateMany({ where: { id: c.id, geradaRncId: null }, data: { geradaRncId: criada.id } });
    if (u.count === 0) throw new ErroConflito();
    await copiarAnexos(tx, a, { tipo: "CONSTATACAO_AUDITORIA", id: c.id }, criada.id);
    return criada;
  });
  if (rnc.responsavelId) await notificarRncAtribuida(a, rnc.id);
  return rnc;
}

// ---------------------------------------------------------------- dashboard

/** Nº de não conformidades por auditoria (concluídas/em execução mais recentes). null sem o módulo. */
export async function resumoAuditorias(a: Ator) {
  if (!(await moduloAuditoriasAtivo(a))) return null;
  const [recentes, planejadas] = await Promise.all([
    a.db.auditoria.findMany({
      where: { AND: [filtroObraAuditoria(a), { status: { in: ["EM_EXECUCAO", "CONCLUIDA"] } }] },
      orderBy: [{ dataInicio: "desc" }],
      take: 8,
      select: { id: true, codigo: true, norma: true, status: true, constatacoes: { select: { tipo: true, geradaRncId: true } } },
    }),
    a.db.auditoria.count({ where: { AND: [filtroObraAuditoria(a), { status: "PLANEJADA" }] } }),
  ]);
  return {
    planejadas,
    auditorias: recentes.map((r) => ({ id: r.id, codigo: r.codigo, norma: r.norma, status: r.status, ...contarPorTipo(r.constatacoes), rncs: r.constatacoes.filter((c) => c.geradaRncId).length })),
  };
}

