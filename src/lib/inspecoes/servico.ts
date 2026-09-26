/**
 * Inspeções / checklists (P5, docs/06-desenho-modulos.md) — serviço de domínio.
 * Modelos de checklist (INSPECAO_GERENCIAR), inspeções de campo por obra (INSPECAO_REALIZAR; escopo
 * por obra) e o valor central do módulo: de uma resposta NÃO CONFORME abre-se uma RNC real
 * (origem INSPECAO, fotos da resposta viram evidências) ou um item de ação no plano da inspeção
 * (origem INSPECAO) — sem duplicar o motor de RNC/Plano de Ação.
 */
import type { Gravidade, Prisma, StatusInspecao, TipoChecklist, TipoRespostaChecklist, TipoRnc } from "@prisma/client";
import { atorTem, fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { anoNoFuso, formatarData, hojeNoFuso, paraDataDb, somarDias } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { filtroObras, obraNoEscopo } from "@/lib/escopo-obras";
import { notificarItensAtribuidos, notificarRncAtribuida } from "@/lib/notificacoes/gatilhos";
import { adicionarItemNaTransacao, criarPlanoNaTransacao, type DadosItem } from "@/lib/plano-acao/servico";
import { formatarCodigoAnual, proximaSequencia } from "@/lib/rnc/numeracao";
import { criarRncNaTransacao } from "@/lib/rnc/servico";
import { exigirModuloInspecoes, moduloInspecoesAtivo, podeExecutarInspecao, podeGerenciarModelos, podeRealizarInspecao } from "./acesso";
import {
  classificar,
  descricaoRncDaResposta,
  moverNaLista,
  normalizarResposta,
  pendenciasConclusao,
  percentualConformidade,
  textoResposta,
  tipoRncDoChecklist,
  tituloRncDaResposta,
  TIPOS_CHECKLIST,
  TIPOS_RESPOSTA,
} from "./regras";

export * from "./acesso";

// ---------------------------------------------------------------- modelos

export interface DadosModelo {
  nome: string;
  descricao?: string | null;
  tipo: TipoChecklist;
  notaMinima?: number | null;
}

export interface DadosItemModelo {
  pergunta: string;
  tipoResposta: TipoRespostaChecklist;
  obrigatorioFoto?: boolean;
  ajuda?: string | null;
}

function dadosModelo(d: DadosModelo) {
  const nome = d.nome.trim();
  if (nome.length < 3 || nome.length > 150) throw new ErroNegocio("Nome do modelo entre 3 e 150 caracteres.");
  if (!TIPOS_CHECKLIST.includes(d.tipo)) throw new ErroNegocio("Tipo de checklist inválido.");
  const notaMinima = d.notaMinima ?? 3;
  if (!Number.isInteger(notaMinima) || notaMinima < 1 || notaMinima > 5) throw new ErroNegocio("Nota mínima entre 1 e 5.");
  const descricao = d.descricao?.trim() || null;
  if (descricao && descricao.length > 2000) throw new ErroNegocio("Descrição excede 2000 caracteres.");
  return { nome, descricao, tipo: d.tipo, notaMinima };
}

function dadosItemModelo(d: DadosItemModelo) {
  const pergunta = d.pergunta.trim();
  if (pergunta.length < 3 || pergunta.length > 500) throw new ErroNegocio("Pergunta entre 3 e 500 caracteres.");
  if (!TIPOS_RESPOSTA.includes(d.tipoResposta)) throw new ErroNegocio("Tipo de resposta inválido.");
  const ajuda = d.ajuda?.trim() || null;
  if (ajuda && ajuda.length > 1000) throw new ErroNegocio("Critério/ajuda excede 1000 caracteres.");
  return { pergunta, tipoResposta: d.tipoResposta, obrigatorioFoto: !!d.obrigatorioFoto && d.tipoResposta !== "TEXTO", ajuda };
}

async function exigirGestaoModelos(a: Ator) {
  await exigirModuloInspecoes(a);
  if (!podeGerenciarModelos(a)) throw new ErroNegocio("Sem permissão para gerenciar modelos de checklist (INSPECAO_GERENCIAR).");
}

async function nomeLivre(db: Tx | Ator["db"], nome: string, exceto?: string) {
  const outro = await db.modeloChecklist.findFirst({ where: { nome: { equals: nome, mode: "insensitive" }, ...(exceto ? { id: { not: exceto } } : {}) }, select: { id: true } });
  if (outro) throw new ErroNegocio("Já existe um modelo com este nome.");
}

export async function listarModelos(a: Ator, f: { todos?: boolean } = {}) {
  await exigirModuloInspecoes(a);
  const ms = await a.db.modeloChecklist.findMany({
    where: f.todos ? {} : { ativo: true },
    include: { itens: { where: { ativo: true }, select: { id: true } }, _count: { select: { inspecoes: true } } },
    orderBy: { nome: "asc" },
  });
  return ms.map(({ itens, ...m }) => ({ ...m, totalItens: itens.length }));
}

export async function obterModelo(a: Ator, id: string) {
  await exigirModuloInspecoes(a);
  return a.db.modeloChecklist.findFirst({
    where: { id },
    include: { itens: { where: { ativo: true }, orderBy: { ordem: "asc" } }, criadoPor: { select: { nome: true } }, _count: { select: { inspecoes: true } } },
  });
}

export async function criarModelo(a: Ator, d: DadosModelo, itens: DadosItemModelo[] = []) {
  await exigirGestaoModelos(a);
  const m = dadosModelo(d);
  const its = itens.map(dadosItemModelo);
  return a.db.$transaction(async (tx) => {
    await nomeLivre(tx, m.nome);
    const criado = await tx.modeloChecklist.create({ data: { ...m, empresaId: a.empresaId, criadoPorId: a.usuarioId }, select: { id: true } });
    if (its.length) {
      await tx.itemModeloChecklist.createMany({ data: its.map((x, i) => ({ ...x, empresaId: a.empresaId, modeloId: criado.id, ordem: i + 1 })) });
    }
    return criado;
  });
}

async function travarModelo(tx: Tx, id: string, versao: number | undefined, dados: Prisma.ModeloChecklistUncheckedUpdateManyInput = {}) {
  const atual = await tx.modeloChecklist.findFirst({ where: { id }, select: { versao: true } });
  if (!atual) throw new ErroNegocio("Modelo não encontrado.");
  const r = await tx.modeloChecklist.updateMany({ where: { id, versao: versao ?? atual.versao }, data: { ...dados, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
}

export async function editarModelo(a: Ator, id: string, d: DadosModelo, versao?: number) {
  await exigirGestaoModelos(a);
  const m = dadosModelo(d);
  await a.db.$transaction(async (tx) => {
    await nomeLivre(tx, m.nome, id);
    await travarModelo(tx, id, versao, m);
  });
}

/** Inativa/reativa o modelo (inativo não aparece para novas inspeções; as feitas continuam). */
export async function definirModeloAtivo(a: Ator, id: string, ativo: boolean) {
  await exigirGestaoModelos(a);
  await a.db.$transaction((tx) => travarModelo(tx, id, undefined, { ativo }));
}

export async function adicionarItemModelo(a: Ator, modeloId: string, d: DadosItemModelo) {
  await exigirGestaoModelos(a);
  const item = dadosItemModelo(d);
  return a.db.$transaction(async (tx) => {
    await travarModelo(tx, modeloId, undefined);
    const ult = await tx.itemModeloChecklist.findFirst({ where: { modeloId, ativo: true }, orderBy: { ordem: "desc" }, select: { ordem: true } });
    return tx.itemModeloChecklist.create({ data: { ...item, empresaId: a.empresaId, modeloId, ordem: (ult?.ordem ?? 0) + 1 }, select: { id: true } });
  });
}

async function itemDoModelo(tx: Tx, itemId: string) {
  const it = await tx.itemModeloChecklist.findFirst({ where: { id: itemId, ativo: true } });
  if (!it) throw new ErroNegocio("Item do checklist não encontrado.");
  return it;
}

/** Editar texto/tipo do item não altera inspeções já iniciadas (a resposta guarda o snapshot da pergunta). */
export async function editarItemModelo(a: Ator, itemId: string, d: DadosItemModelo) {
  await exigirGestaoModelos(a);
  const item = dadosItemModelo(d);
  await a.db.$transaction(async (tx) => {
    const it = await itemDoModelo(tx, itemId);
    await travarModelo(tx, it.modeloId, undefined);
    await tx.itemModeloChecklist.update({ where: { id: itemId }, data: item });
  });
}

/** Remove (inativa) o item e recompacta a ordem dos ativos. */
export async function removerItemModelo(a: Ator, itemId: string) {
  await exigirGestaoModelos(a);
  await a.db.$transaction(async (tx) => {
    const it = await itemDoModelo(tx, itemId);
    await travarModelo(tx, it.modeloId, undefined);
    await tx.itemModeloChecklist.update({ where: { id: itemId }, data: { ativo: false } });
    const restantes = await tx.itemModeloChecklist.findMany({ where: { modeloId: it.modeloId, ativo: true }, orderBy: { ordem: "asc" }, select: { id: true } });
    for (const [i, r] of restantes.entries()) await tx.itemModeloChecklist.update({ where: { id: r.id }, data: { ordem: i + 1 } });
  });
}

export async function moverItemModelo(a: Ator, itemId: string, direcao: "cima" | "baixo") {
  await exigirGestaoModelos(a);
  await a.db.$transaction(async (tx) => {
    const it = await itemDoModelo(tx, itemId);
    await travarModelo(tx, it.modeloId, undefined);
    const lista = await tx.itemModeloChecklist.findMany({ where: { modeloId: it.modeloId, ativo: true }, orderBy: { ordem: "asc" }, select: { id: true } });
    for (const [i, r] of moverNaLista(lista, itemId, direcao).entries()) await tx.itemModeloChecklist.update({ where: { id: r.id }, data: { ordem: i + 1 } });
  });
}

// ---------------------------------------------------------------- inspeções: leitura

export interface FiltrosInspecao {
  obra?: string;
  modelo?: string;
  status?: StatusInspecao;
  /** YYYY-MM-DD */
  de?: string;
  ate?: string;
}

export async function opcoesInspecoes(a: Ator) {
  const [modelos, obras, setores, processos, usuarios] = await Promise.all([
    a.db.modeloChecklist.findMany({ where: { ativo: true }, select: { id: true, nome: true, tipo: true, itens: { where: { ativo: true }, select: { id: true } } }, orderBy: { nome: "asc" } }),
    a.db.obraUnidade.findMany({ where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.setor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { modelos: modelos.map(({ itens, ...m }) => ({ ...m, totalItens: itens.length })), obras, setores, processos, usuarios };
}

const selResposta = { tipoResposta: true, resposta: true, nota: true, texto: true, geradaRncId: true, geradoItemAcaoId: true } as const;

export async function listarInspecoes(a: Ator, f: FiltrosInspecao = {}) {
  await exigirModuloInspecoes(a);
  const is = await a.db.inspecao.findMany({
    where: {
      AND: [
        filtroObras(a),
        f.obra ? { obraId: f.obra } : {},
        f.modelo ? { modeloId: f.modelo } : {},
        f.status ? { status: f.status } : {},
        f.de ? { dataInspecao: { gte: paraDataDb(f.de) } } : {},
        f.ate ? { dataInspecao: { lte: paraDataDb(f.ate) } } : {},
      ],
    },
    include: {
      modelo: { select: { id: true, nome: true, tipo: true, notaMinima: true } },
      obra: { select: { id: true, nome: true } },
      inspetor: { select: { id: true, nome: true } },
      respostas: { select: selResposta },
    },
    orderBy: [{ dataInspecao: "desc" }, { sequencia: "desc" }],
    take: 300,
  });
  return is.map(({ respostas, ...i }) => ({
    ...i,
    naoConformes: respostas.filter((r) => classificar(r, i.modelo.notaMinima) === "NAO_CONFORME").length,
    pendentes: respostas.filter((r) => classificar(r, i.modelo.notaMinima) === "PENDENTE").length,
    total: respostas.length,
    rncsGeradas: respostas.filter((r) => r.geradaRncId).length,
    itensGerados: respostas.filter((r) => r.geradoItemAcaoId).length,
    percentualAtual: i.percentualConformidade ?? percentualConformidade(respostas, i.modelo.notaMinima),
  }));
}

/** Inspeção visível (módulo + obra no escopo) com respostas, vínculos gerados e nº de fotos por resposta. */
export async function obterInspecao(a: Ator, id: string) {
  await exigirModuloInspecoes(a);
  const i = await a.db.inspecao.findFirst({
    where: { AND: [{ id }, filtroObras(a)] },
    include: {
      modelo: { select: { id: true, nome: true, tipo: true, notaMinima: true } },
      obra: { select: { id: true, nome: true } },
      setor: { select: { id: true, nome: true } },
      processo: { select: { id: true, codigo: true, nome: true } },
      inspetor: { select: { id: true, nome: true } },
      planoAcao: { select: { id: true, titulo: true } },
      respostas: {
        orderBy: { ordem: "asc" },
        include: {
          geradaRnc: { select: { id: true, codigo: true, status: true, titulo: true } },
          geradoItemAcao: { select: { id: true, oQue: true, status: true, quando: true, quem: { select: { nome: true } } } },
        },
      },
    },
  });
  if (!i) return null;
  const fotos = await contarFotos(a.db, i.respostas.map((r) => r.id));
  return { ...i, fotos };
}

async function contarFotos(db: Tx | Ator["db"], respostaIds: string[]) {
  const mapa = new Map<string, number>();
  if (respostaIds.length === 0) return mapa;
  const g = await db.anexo.groupBy({ by: ["entidadeId"], where: { entidadeTipo: "RESPOSTA_INSPECAO", entidadeId: { in: respostaIds }, excluidoEm: null }, _count: { _all: true } });
  for (const x of g) mapa.set(x.entidadeId, x._count._all);
  return mapa;
}

// ---------------------------------------------------------------- inspeções: escrita

export interface DadosNovaInspecao {
  modeloId: string;
  obraId: string;
  setorId?: string | null;
  processoId?: string | null;
  /** YYYY-MM-DD */
  dataInspecao: string;
  /** Padrão: o próprio usuário. Outro inspetor só com INSPECAO_GERENCIAR. */
  inspetorId?: string | null;
}

/** Inicia a inspeção: código INSP-NNN-AA e uma resposta vazia por item ativo do modelo (snapshot da pergunta). */
export async function iniciarInspecao(a: Ator, d: DadosNovaInspecao) {
  await exigirModuloInspecoes(a);
  if (!podeRealizarInspecao(a)) throw new ErroNegocio("Sem permissão para realizar inspeções (INSPECAO_REALIZAR).");
  if (!obraNoEscopo(a, d.obraId)) throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataInspecao)) throw new ErroNegocio("Data da inspeção inválida.");
  const inspetorId = d.inspetorId || a.usuarioId;
  if (inspetorId !== a.usuarioId && !atorTem(a, "INSPECAO_GERENCIAR")) throw new ErroNegocio("Somente quem gerencia inspeções pode designar outro inspetor.");
  const ano = anoNoFuso(await fusoDaEmpresa(a));
  const r = await a.db.$transaction(async (tx) => {
    const [modelo, obra, inspetor] = await Promise.all([
      tx.modeloChecklist.findFirst({ where: { id: d.modeloId, ativo: true }, include: { itens: { where: { ativo: true }, orderBy: { ordem: "asc" } } } }),
      tx.obraUnidade.findFirst({ where: { id: d.obraId, ativo: true }, select: { id: true } }),
      tx.usuario.findFirst({ where: { id: inspetorId, ativo: true }, select: { id: true } }),
    ]);
    if (!modelo) throw new ErroNegocio("Modelo de checklist inválido ou inativo.");
    if (modelo.itens.length === 0) throw new ErroNegocio("O modelo não tem perguntas.");
    if (!obra) throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
    if (!inspetor) throw new ErroNegocio("Inspetor inválido.");
    if (d.setorId && !(await tx.setor.findFirst({ where: { id: d.setorId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Setor inválido.");
    if (d.processoId && !(await tx.processo.findFirst({ where: { id: d.processoId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Processo inválido.");
    const sequencia = await proximaSequencia(tx, a.empresaId, "INSPECAO", ano);
    const insp = await tx.inspecao.create({
      data: {
        empresaId: a.empresaId,
        ano,
        sequencia,
        codigo: formatarCodigoAnual("INSP", sequencia, ano),
        modeloId: modelo.id,
        obraId: d.obraId,
        setorId: d.setorId || null,
        processoId: d.processoId || null,
        inspetorId,
        dataInspecao: paraDataDb(d.dataInspecao),
      },
      select: { id: true, codigo: true },
    });
    await tx.respostaInspecao.createMany({
      data: modelo.itens.map((it, n) => ({
        empresaId: a.empresaId,
        inspecaoId: insp.id,
        itemModeloId: it.id,
        ordem: n + 1,
        pergunta: it.pergunta,
        tipoResposta: it.tipoResposta,
        obrigatorioFoto: it.obrigatorioFoto,
        ajuda: it.ajuda,
      })),
    });
    return insp;
  });
  return r;
}

/** Resposta + inspeção visível e executável pelo ator (módulo, escopo, inspetor/gestor). */
async function carregarResposta(tx: Tx, a: Ator, respostaId: string) {
  const r = await tx.respostaInspecao.findFirst({
    where: { id: respostaId, inspecao: filtroObras(a) },
    include: {
      inspecao: {
        include: {
          modelo: { select: { nome: true, tipo: true, notaMinima: true } },
          obra: { select: { nome: true } },
          inspetor: { select: { nome: true } },
          processo: { select: { codigo: true, nome: true } },
        },
      },
    },
  });
  if (!r) throw new ErroNegocio("Pergunta não encontrada ou sem acesso.");
  if (!podeExecutarInspecao(a, r.inspecao)) throw new ErroNegocio("Somente o inspetor ou quem gerencia inspeções pode alterar esta inspeção.");
  return r;
}

export interface DadosResposta {
  resposta?: string | null;
  nota?: number | string | null;
  texto?: string | null;
  comentario?: string | null;
}

/** Registra/altera a resposta de uma pergunta (inspeção em andamento). */
export async function responder(a: Ator, respostaId: string, d: DadosResposta) {
  await exigirModuloInspecoes(a);
  return a.db.$transaction(async (tx) => {
    const r = await carregarResposta(tx, a, respostaId);
    if (r.inspecao.status !== "EM_ANDAMENTO") throw new ErroNegocio("A inspeção não está em andamento.");
    const v = normalizarResposta(r.tipoResposta, d);
    const nc = classificar({ tipoResposta: r.tipoResposta, ...v }, r.inspecao.modelo.notaMinima) === "NAO_CONFORME";
    if (!nc && (r.geradaRncId || r.geradoItemAcaoId)) {
      throw new ErroNegocio("Esta pergunta já gerou RNC/item de ação: a resposta precisa continuar não conforme.");
    }
    await tx.respostaInspecao.update({ where: { id: r.id }, data: { ...v, respondidoEm: new Date() } });
    return { naoConforme: nc };
  });
}

async function carregarInspecaoExecutavel(tx: Tx, a: Ator, id: string) {
  const i = await tx.inspecao.findFirst({
    where: { AND: [{ id }, filtroObras(a)] },
    include: { modelo: { select: { notaMinima: true } }, respostas: { orderBy: { ordem: "asc" } } },
  });
  if (!i) throw new ErroNegocio("Inspeção não encontrada ou sem acesso.");
  if (!podeExecutarInspecao(a, i)) throw new ErroNegocio("Somente o inspetor ou quem gerencia inspeções pode alterar esta inspeção.");
  return i;
}

/** Conclui: todas respondidas e fotos das NCs obrigatórias; grava o % de conformidade. */
export async function concluirInspecao(a: Ator, id: string, d: { observacoes?: string | null } = {}, versao?: number) {
  await exigirModuloInspecoes(a);
  const observacoes = d.observacoes?.trim() || null;
  if (observacoes && observacoes.length > 4000) throw new ErroNegocio("Observações excedem 4000 caracteres.");
  return a.db.$transaction(async (tx) => {
    const i = await carregarInspecaoExecutavel(tx, a, id);
    if (i.status !== "EM_ANDAMENTO") throw new ErroNegocio("A inspeção não está em andamento.");
    if (versao !== undefined && versao !== i.versao) throw new ErroConflito();
    const fotos = await contarFotos(tx, i.respostas.map((r) => r.id));
    const pend = pendenciasConclusao(i.respostas.map((r) => ({ ...r, fotos: fotos.get(r.id) ?? 0 })), i.modelo.notaMinima);
    if (pend.length) throw new ErroNegocio(pend.join(" "));
    const percentual = percentualConformidade(i.respostas, i.modelo.notaMinima);
    const u = await tx.inspecao.updateMany({
      where: { id, versao: i.versao, status: "EM_ANDAMENTO" },
      data: { status: "CONCLUIDA", concluidaEm: new Date(), percentualConformidade: percentual, observacoes: observacoes ?? i.observacoes, versao: { increment: 1 } },
    });
    if (u.count === 0) throw new ErroConflito();
    return { percentual };
  });
}

/** Cancela uma inspeção em andamento que ainda não gerou RNC/item de ação. */
export async function cancelarInspecao(a: Ator, id: string, motivo: string, versao?: number) {
  await exigirModuloInspecoes(a);
  const m = motivo.trim();
  if (m.length < 3) throw new ErroNegocio("Informe o motivo do cancelamento.");
  await a.db.$transaction(async (tx) => {
    const i = await carregarInspecaoExecutavel(tx, a, id);
    if (i.status !== "EM_ANDAMENTO") throw new ErroNegocio("Só é possível cancelar inspeção em andamento.");
    if (i.respostas.some((r) => r.geradaRncId || r.geradoItemAcaoId)) throw new ErroNegocio("A inspeção já gerou RNC/item de ação: conclua-a em vez de cancelar.");
    const u = await tx.inspecao.updateMany({
      where: { id, versao: versao ?? i.versao, status: "EM_ANDAMENTO" },
      data: { status: "CANCELADA", observacoes: [i.observacoes, `Cancelada: ${m}`].filter(Boolean).join("\n"), versao: { increment: 1 } },
    });
    if (u.count === 0) throw new ErroConflito();
  });
}

// ---------------------------------------------------------------- RNC / item de ação a partir da resposta

function exigirNaoConforme(r: Awaited<ReturnType<typeof carregarResposta>>) {
  if (r.inspecao.status === "CANCELADA") throw new ErroNegocio("Inspeção cancelada.");
  if (classificar(r, r.inspecao.modelo.notaMinima) !== "NAO_CONFORME") throw new ErroNegocio("Somente respostas não conformes geram RNC ou item de ação.");
}

export interface DadosRncDaResposta {
  titulo?: string | null;
  descricao?: string | null;
  tipo?: TipoRnc | null;
  gravidade: Gravidade;
  responsavelId?: string | null;
}

/** Textos sugeridos para a RNC de uma resposta (pré-preenchimento da tela). */
export function sugestaoRnc(i: { codigo: string; dataInspecao: Date; modelo: { nome: string; tipo: TipoChecklist }; obra: { nome: string }; inspetor: { nome: string } }, r: Parameters<typeof textoResposta>[0] & { pergunta: string; comentario: string | null }) {
  return {
    titulo: tituloRncDaResposta(r.pergunta),
    descricao: descricaoRncDaResposta({
      codigo: i.codigo,
      modelo: i.modelo.nome,
      data: formatarData(i.dataInspecao),
      inspetor: i.inspetor.nome,
      obra: i.obra.nome,
      pergunta: r.pergunta,
      resposta: textoResposta(r),
      comentario: r.comentario,
    }),
    tipo: tipoRncDoChecklist(i.modelo.tipo),
  };
}

/**
 * Abre uma RNC real a partir de uma resposta não conforme: origem INSPECAO, obra/setor/processo da
 * inspeção, descrição a partir da pergunta + comentário e as fotos da resposta copiadas como anexos
 * (evidências) da RNC — tudo na mesma transação que grava o vínculo.
 */
export async function abrirRncDaResposta(a: Ator, respostaId: string, d: DadosRncDaResposta) {
  await exigirModuloInspecoes(a);
  const rnc = await a.db.$transaction(async (tx) => {
    const r = await carregarResposta(tx, a, respostaId);
    exigirNaoConforme(r);
    if (r.geradaRncId) throw new ErroNegocio("Esta pergunta já gerou uma RNC.");
    const sug = sugestaoRnc(r.inspecao, r);
    const criada = await criarRncNaTransacao(tx, a, {
      titulo: d.titulo?.trim() || sug.titulo,
      descricao: d.descricao?.trim() || sug.descricao,
      tipo: d.tipo ?? sug.tipo,
      origem: "INSPECAO",
      gravidade: d.gravidade,
      obraId: r.inspecao.obraId,
      setorId: r.inspecao.setorId,
      processoArea: r.inspecao.processo ? `${r.inspecao.processo.codigo} — ${r.inspecao.processo.nome}` : null,
      responsavelId: d.responsavelId || null,
    });
    const u = await tx.respostaInspecao.updateMany({ where: { id: r.id, geradaRncId: null }, data: { geradaRncId: criada.id } });
    if (u.count === 0) throw new ErroConflito();
    await copiarAnexos(tx, a, { tipo: "RESPOSTA_INSPECAO", id: r.id }, criada.id);
    return criada;
  });
  if (rnc.responsavelId) await notificarRncAtribuida(a, rnc.id);
  return rnc;
}

/** Copia (mesmo arquivo no armazenamento, novo registro) os anexos ativos de uma origem para a RNC. */
export async function copiarAnexos(tx: Tx, a: Ator, origem: { tipo: "RESPOSTA_INSPECAO" | "CONSTATACAO_AUDITORIA"; id: string }, rncId: string) {
  const anexos = await tx.anexo.findMany({ where: { entidadeTipo: origem.tipo, entidadeId: origem.id, excluidoEm: null } });
  if (anexos.length === 0) return 0;
  await tx.anexo.createMany({
    data: anexos.map((x) => ({
      empresaId: a.empresaId,
      entidadeTipo: "RNC" as const,
      entidadeId: rncId,
      nomeArquivo: x.nomeArquivo,
      mimeType: x.mimeType,
      tamanhoBytes: x.tamanhoBytes,
      chaveArmazenamento: x.chaveArmazenamento,
      url: null,
      sensivel: false,
      enviadoPorId: x.enviadoPorId,
    })),
  });
  return anexos.length;
}

/**
 * Cria só um item de ação (5W2H) para a não conformidade, no plano da inspeção (origem INSPECAO,
 * criado no primeiro item e reaproveitado nos seguintes).
 */
export async function criarItemAcaoDaResposta(a: Ator, respostaId: string, d: Omit<DadosItem, "oQue"> & { oQue?: string | null }) {
  await exigirModuloInspecoes(a);
  const itemId = await a.db.$transaction(async (tx) => {
    const r = await carregarResposta(tx, a, respostaId);
    exigirNaoConforme(r);
    if (r.geradoItemAcaoId) throw new ErroNegocio("Esta pergunta já gerou um item de ação.");
    const item: DadosItem = { ...d, oQue: d.oQue?.trim() || `Corrigir: ${r.pergunta}`.slice(0, 500), porQue: d.porQue ?? `Não conformidade na inspeção ${r.inspecao.codigo}.` };
    let id: string;
    if (r.inspecao.planoAcaoId) {
      id = await adicionarItemNaTransacao(tx, a, r.inspecao.planoAcaoId, item);
    } else {
      const p = await criarPlanoNaTransacao(
        tx,
        a,
        { titulo: `Ações da inspeção ${r.inspecao.codigo}`, descricao: `${r.inspecao.modelo.nome} — ${r.inspecao.obra.nome}`, obraId: r.inspecao.obraId, itens: [item] },
        { tipo: "INSPECAO", id: r.inspecao.id },
      );
      const u = await tx.inspecao.updateMany({ where: { id: r.inspecao.id, planoAcaoId: null }, data: { planoAcaoId: p.id } });
      if (u.count === 0) throw new ErroConflito();
      id = p.itemIds[0];
    }
    const u = await tx.respostaInspecao.updateMany({ where: { id: r.id, geradoItemAcaoId: null }, data: { geradoItemAcaoId: id } });
    if (u.count === 0) throw new ErroConflito();
    return id;
  });
  await notificarItensAtribuidos(a, [itemId], "criado");
  return { itemId };
}

// ---------------------------------------------------------------- dashboard

/** Indicadores do dashboard (null sem o módulo): últimos 12 meses nas obras do escopo. */
export async function resumoInspecoes(a: Ator) {
  if (!(await moduloInspecoesAtivo(a))) return null;
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const desde = paraDataDb(somarDias(hoje, -365));
  const [concluidas, emAndamento, paradas, respostas] = await Promise.all([
    a.db.inspecao.findMany({ where: { ...filtroObras(a), status: "CONCLUIDA", dataInspecao: { gte: desde } }, select: { percentualConformidade: true, modelo: { select: { nome: true } } } }),
    a.db.inspecao.count({ where: { ...filtroObras(a), status: "EM_ANDAMENTO" } }),
    a.db.inspecao.count({ where: { ...filtroObras(a), status: "EM_ANDAMENTO", dataInspecao: { lt: paraDataDb(somarDias(hoje, -7)) } } }),
    a.db.respostaInspecao.findMany({ where: { inspecao: { ...filtroObras(a), dataInspecao: { gte: desde } }, OR: [{ geradaRncId: { not: null } }, { geradoItemAcaoId: { not: null } }] }, select: { geradaRncId: true, geradoItemAcaoId: true } }),
  ]);
  const comPct = concluidas.filter((c) => c.percentualConformidade !== null);
  const media = comPct.length ? Math.round(comPct.reduce((s, c) => s + (c.percentualConformidade ?? 0), 0) / comPct.length) : null;
  const porModelo = new Map<string, { soma: number; n: number }>();
  for (const c of comPct) {
    const m = porModelo.get(c.modelo.nome) ?? { soma: 0, n: 0 };
    m.soma += c.percentualConformidade ?? 0;
    m.n++;
    porModelo.set(c.modelo.nome, m);
  }
  return {
    concluidas: concluidas.length,
    emAndamento,
    paradas,
    mediaConformidade: media,
    rncsGeradas: respostas.filter((r) => r.geradaRncId).length,
    itensGerados: respostas.filter((r) => r.geradoItemAcaoId).length,
    porModelo: [...porModelo.entries()].map(([nome, m]) => ({ nome, media: Math.round(m.soma / m.n), n: m.n })).sort((x, y) => x.media - y.media),
  };
}

