/**
 * Mapa de Processos (ISO 9001 4.4) — serviço de domínio (docs/06-desenho-modulos.md, seção 1).
 * Leitura: qualquer usuário da empresa com o módulo MAPA_PROCESSOS contratado.
 * Escrita: módulo contratado + permissão PROCESSO_GERENCIAR.
 * Publicação: direta (publicarVersao) ou pelo motor de aprovação (solicitarPublicacao; o handler
 * PROCESSO em ./aprovacao.ts publica na mesma transação da última aprovação).
 */
import { Prisma, type ModoAprovacao, type TipoProcesso } from "@prisma/client";
import { atorTem, type Ator, type Tx } from "@/lib/ator";
import { solicitarAprovacao } from "@/lib/aprovacao/servico";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import {
  diffIndicadores,
  MAX_NOME,
  MAX_TEXTO,
  montarSnapshot,
  moverNaRaia,
  nomesIndicadores,
  normalizarProcesso,
  type DadosProcesso,
} from "./regras";

export const linkProcesso = (id: string) => `/processos/${id}`;

// ---------------------------------------------------------------- acesso

export async function moduloProcessosAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("MAPA_PROCESSOS");
}

export async function exigirModuloProcessos(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloProcessosAtivo(a))) throw new ErroNegocio("Módulo Mapa de Processos não contratado para esta empresa.");
}

export const podeGerenciarProcessos = (a: Pick<Ator, "permissoes">) => atorTem(a, "PROCESSO_GERENCIAR");

async function exigirGestao(a: Ator) {
  await exigirModuloProcessos(a);
  if (!podeGerenciarProcessos(a)) throw new ErroNegocio("Sem permissão para gerenciar o mapa de processos (PROCESSO_GERENCIAR).");
}

function ehUnicoViolado(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function validarDono(tx: Tx, donoId: string | null) {
  if (!donoId) return;
  const n = await tx.usuario.count({ where: { id: donoId, ativo: true } });
  if (n === 0) throw new ErroNegocio("Dono do processo inválido.");
}

async function carregar(tx: Tx, id: string) {
  const p = await tx.processo.findFirst({ where: { id } });
  if (!p) throw new ErroNegocio("Processo não encontrado.");
  return p;
}

/** Trava otimista de edição (revisao lida); incrementa. */
async function travar(tx: Tx, p: { id: string; revisao: number }, data: Prisma.ProcessoUncheckedUpdateManyInput = {}) {
  const r = await tx.processo.updateMany({ where: { id: p.id, revisao: p.revisao }, data: { ...data, revisao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
}

async function proximaOrdem(tx: Tx, tipo: TipoProcesso) {
  const r = await tx.processo.aggregate({ where: { tipo, ativo: true }, _max: { ordem: true } });
  return (r._max.ordem ?? 0) + 1;
}

async function sincronizarIndicadores(tx: Tx, a: Ator, processoId: string, textoIndicadores: string) {
  const atuais = await tx.indicadorProcesso.findMany({ where: { processoId }, select: { id: true, nome: true } });
  const { manter, criar, remover } = diffIndicadores(atuais, nomesIndicadores(textoIndicadores));
  if (remover.length) await tx.indicadorProcesso.deleteMany({ where: { id: { in: remover }, processoId } });
  for (const m of manter) await tx.indicadorProcesso.updateMany({ where: { id: m.id, processoId }, data: { ordem: m.ordem } });
  if (criar.length) {
    await tx.indicadorProcesso.createMany({ data: criar.map((c) => ({ ...c, empresaId: a.empresaId, processoId })) });
  }
}

// ---------------------------------------------------------------- leitura

export async function listarProcessos(a: Ator, opts: { incluirInativos?: boolean } = {}) {
  await exigirModuloProcessos(a);
  return a.db.processo.findMany({
    where: opts.incluirInativos ? {} : { ativo: true },
    include: {
      dono: { select: { id: true, nome: true } },
      indicadores: { orderBy: { ordem: "asc" }, select: { id: true, nome: true } },
    },
    orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { codigo: "asc" }],
  });
}
export type ProcessoListado = Awaited<ReturnType<typeof listarProcessos>>[number];

export async function listarInteracoes(a: Ator) {
  await exigirModuloProcessos(a);
  return a.db.interacaoProcesso.findMany({
    where: { origem: { ativo: true }, destino: { ativo: true } },
    select: { id: true, origemId: true, destinoId: true, descricao: true },
  });
}

export async function obterProcesso(a: Ator, id: string) {
  await exigirModuloProcessos(a);
  return a.db.processo.findFirst({
    where: { id },
    include: {
      dono: { select: { id: true, nome: true } },
      indicadores: { orderBy: { ordem: "asc" } },
      interacoesOrigem: { include: { destino: { select: { id: true, codigo: true, nome: true, ativo: true } } }, orderBy: { criadoEm: "asc" } },
      interacoesDestino: { include: { origem: { select: { id: true, codigo: true, nome: true, ativo: true } } }, orderBy: { criadoEm: "asc" } },
    },
  });
}

export async function listarVersoes(a: Ator, processoId: string) {
  await exigirModuloProcessos(a);
  return a.db.versaoProcesso.findMany({
    where: { processoId },
    include: { publicadoPor: { select: { nome: true } } },
    orderBy: { versao: "desc" },
  });
}

// ---------------------------------------------------------------- escrita

export async function criarProcesso(a: Ator, d: DadosProcesso & { indicadores?: string }) {
  await exigirGestao(a);
  const dados = normalizarProcesso(d);
  try {
    return await a.db.$transaction(async (tx) => {
      await validarDono(tx, dados.donoId);
      const ordem = await proximaOrdem(tx, dados.tipo);
      const p = await tx.processo.create({ data: { ...dados, empresaId: a.empresaId, ordem }, select: { id: true } });
      if (d.indicadores) await sincronizarIndicadores(tx, a, p.id, d.indicadores);
      return p;
    });
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio(`Já existe um processo com o código ${dados.codigo}.`);
    throw e;
  }
}

/**
 * Edita a linha da planilha. Mudar o tipo move o processo para o fim da nova raia.
 * `indicadores` (opcional): nomes, um por linha — sincroniza a lista (meta/unidade no detalhe).
 */
export async function editarProcesso(a: Ator, id: string, d: DadosProcesso & { indicadores?: string }, revisao?: number) {
  await exigirGestao(a);
  const dados = normalizarProcesso(d);
  try {
    await a.db.$transaction(async (tx) => {
      const p = await carregar(tx, id);
      if (revisao !== undefined && revisao !== p.revisao) throw new ErroConflito();
      if (!p.ativo) throw new ErroNegocio("Processo inativo: reative antes de editar.");
      await validarDono(tx, dados.donoId);
      const ordem = dados.tipo !== p.tipo ? await proximaOrdem(tx, dados.tipo) : p.ordem;
      await travar(tx, p, { ...dados, ordem });
      if (d.indicadores !== undefined) await sincronizarIndicadores(tx, a, p.id, d.indicadores);
    });
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio(`Já existe um processo com o código ${dados.codigo}.`);
    throw e;
  }
}

/** Move uma posição para cima/baixo dentro da raia (renumera a raia 1..n). */
export async function moverProcesso(a: Ator, id: string, direcao: "cima" | "baixo") {
  await exigirGestao(a);
  await a.db.$transaction(async (tx) => {
    const p = await carregar(tx, id);
    const raia = await tx.processo.findMany({ where: { tipo: p.tipo, ativo: true }, orderBy: [{ ordem: "asc" }, { codigo: "asc" }], select: { id: true } });
    const nova = moverNaRaia(raia.map((r) => r.id), id, direcao);
    if (!nova) throw new ErroNegocio(direcao === "cima" ? "O processo já é o primeiro da raia." : "O processo já é o último da raia.");
    for (const [i, pid] of nova.entries()) await tx.processo.updateMany({ where: { id: pid }, data: { ordem: i + 1 } });
    await travar(tx, p);
  });
}

/** Move para outra raia (tipo), no fim da ordem. */
export async function moverTipo(a: Ator, id: string, tipo: TipoProcesso) {
  await exigirGestao(a);
  await a.db.$transaction(async (tx) => {
    const p = await carregar(tx, id);
    if (p.tipo === tipo) return;
    await travar(tx, p, { tipo, ordem: await proximaOrdem(tx, tipo) });
  });
}

/** Exclusão lógica (o histórico de versões é preservado). */
export async function definirAtivo(a: Ator, id: string, ativo: boolean) {
  await exigirGestao(a);
  await a.db.$transaction(async (tx) => {
    const p = await carregar(tx, id);
    if (p.ativo === ativo) return;
    await travar(tx, p, ativo ? { ativo, ordem: await proximaOrdem(tx, p.tipo) } : { ativo });
  });
}

// ---- indicadores

export interface DadosIndicador {
  nome: string;
  meta?: string | null;
  unidade?: string | null;
  periodicidade?: string | null;
}

function normalizarIndicador(d: DadosIndicador) {
  const nome = d.nome.trim();
  if (!nome) throw new ErroNegocio("Informe o nome do indicador.");
  if (nome.length > MAX_NOME) throw new ErroNegocio(`Indicador com no máximo ${MAX_NOME} caracteres.`);
  const t = (v?: string | null) => (v?.trim() || null)?.slice(0, 200) ?? null;
  return { nome, meta: t(d.meta), unidade: t(d.unidade), periodicidade: t(d.periodicidade) };
}

export async function adicionarIndicador(a: Ator, processoId: string, d: DadosIndicador) {
  await exigirGestao(a);
  const dados = normalizarIndicador(d);
  await a.db.$transaction(async (tx) => {
    const p = await carregar(tx, processoId);
    const r = await tx.indicadorProcesso.aggregate({ where: { processoId }, _max: { ordem: true } });
    await tx.indicadorProcesso.create({ data: { ...dados, empresaId: a.empresaId, processoId, ordem: (r._max.ordem ?? 0) + 1 } });
    await travar(tx, p);
  });
}

export async function editarIndicador(a: Ator, indicadorId: string, d: DadosIndicador) {
  await exigirGestao(a);
  const dados = normalizarIndicador(d);
  const r = await a.db.indicadorProcesso.updateMany({ where: { id: indicadorId }, data: dados });
  if (r.count === 0) throw new ErroNegocio("Indicador não encontrado.");
}

export async function removerIndicador(a: Ator, indicadorId: string) {
  await exigirGestao(a);
  const r = await a.db.indicadorProcesso.deleteMany({ where: { id: indicadorId } });
  if (r.count === 0) throw new ErroNegocio("Indicador não encontrado.");
}

// ---- interações (setas do mapa)

export async function adicionarInteracao(a: Ator, origemId: string, destinoId: string, descricao?: string | null) {
  await exigirGestao(a);
  if (origemId === destinoId) throw new ErroNegocio("Origem e destino devem ser processos diferentes.");
  const desc = descricao?.trim() || null;
  if (desc && desc.length > MAX_TEXTO) throw new ErroNegocio("Descrição muito longa.");
  const n = await a.db.processo.count({ where: { id: { in: [origemId, destinoId] }, ativo: true } });
  if (n !== 2) throw new ErroNegocio("Processo de origem ou destino inválido.");
  try {
    await a.db.interacaoProcesso.create({ data: { empresaId: a.empresaId, origemId, destinoId, descricao: desc } });
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio("Essa interação já existe.");
    throw e;
  }
}

export async function removerInteracao(a: Ator, interacaoId: string) {
  await exigirGestao(a);
  const r = await a.db.interacaoProcesso.deleteMany({ where: { id: interacaoId } });
  if (r.count === 0) throw new ErroNegocio("Interação não encontrada.");
}

// ---- publicação (versões)

/**
 * Congela o estado atual em VersaoProcesso (append-only) e incrementa `versao`.
 * Usado pela publicação direta e pelo handler de aprovação (mesma transação).
 */
export async function publicarNaTransacao(tx: Tx, empresaId: string, processoId: string, publicadoPorId: string, observacao: string | null) {
  const p = await tx.processo.findFirst({
    where: { id: processoId },
    include: {
      dono: { select: { id: true, nome: true } },
      indicadores: true,
      interacoesOrigem: { include: { destino: { select: { codigo: true, nome: true } } } },
      interacoesDestino: { include: { origem: { select: { codigo: true, nome: true } } } },
    },
  });
  if (!p) throw new ErroNegocio("Processo não encontrado.");
  if (!p.ativo) throw new ErroNegocio("Processo inativo não pode ser publicado.");
  const snapshot = montarSnapshot(p);
  const nova = p.versao + 1;
  const r = await tx.processo.updateMany({ where: { id: p.id, versao: p.versao }, data: { versao: nova, revisao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
  await tx.versaoProcesso.create({
    data: {
      empresaId,
      processoId: p.id,
      versao: nova,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      observacao,
      publicadoPorId,
    },
  });
  return { versao: nova };
}

function normalizarObservacao(o?: string | null) {
  const t = o?.trim() || null;
  if (t && t.length > 1000) throw new ErroNegocio("Observação com no máximo 1000 caracteres.");
  return t;
}

export async function publicarVersao(a: Ator, processoId: string, observacao?: string | null) {
  await exigirGestao(a);
  const obs = normalizarObservacao(observacao);
  try {
    return await a.db.$transaction((tx) => publicarNaTransacao(tx, a.empresaId, processoId, a.usuarioId, obs));
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroConflito();
    throw e;
  }
}

/**
 * Publicação via motor de aprovação (opcional; a empresa escolhe por processo publicar direto
 * ou pedir assinaturas). Ao aprovar, o handler PROCESSO publica em nome do solicitante.
 */
export async function solicitarPublicacao(
  a: Ator,
  processoId: string,
  d: { aprovadorIds: string[]; modo: ModoAprovacao; observacao?: string | null },
) {
  await exigirGestao(a);
  const obs = normalizarObservacao(d.observacao);
  const p = await a.db.processo.findFirst({ where: { id: processoId, ativo: true }, select: { id: true, codigo: true, nome: true, versao: true } });
  if (!p) throw new ErroNegocio("Processo não encontrado ou inativo.");
  // Garante o registro do handler neste processo de execução.
  await import("./aprovacao");
  return solicitarAprovacao(a, {
    entidadeTipo: "PROCESSO",
    entidadeId: p.id,
    tipoAlteracao: "PUBLICACAO",
    modo: d.modo,
    aprovadorIds: d.aprovadorIds,
    payload: { processoId: p.id, observacao: obs },
    resumo: `Publicar ${p.codigo} — ${p.nome} (versão ${p.versao + 1})`.slice(0, 300),
  });
}
