import type { Prisma } from "@prisma/client";
import { atorTem, fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { hojeNoFuso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { cicloAtual } from "@/lib/rnc/estados";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { notificarItensAtribuidos } from "@/lib/notificacoes/gatilhos";
import { filtroAcessoPlanoManual, filtroGestaoPlanoManual, obraDoPlanoAcessivel, podeGerenciarPlanoManual } from "@/lib/plano-acao/acesso";
import { statusGeralPlano } from "@/lib/plano-acao/status";
import { filtroAcessoItem, filtroAcessoRnc, podeGerenciarPlanoRnc, travarRnc } from "@/lib/rnc/servico";

export interface DadosItem {
  oQue: string;
  porQue?: string | null;
  onde?: string | null;
  quemId: string;
  /** YYYY-MM-DD */
  quando: string;
  como?: string | null;
  quanto?: number | null;
}

/** Status da RNC em que o plano pode ser editado (itens criados/alterados). */
const STATUS_EDICAO_PLANO = ["EM_ANALISE", "PLANO_EM_EXECUCAO"] as const;

async function validarUsuarios(tx: Tx, ids: string[]) {
  const unicos = [...new Set(ids)];
  const n = await tx.usuario.count({ where: { id: { in: unicos }, ativo: true } });
  if (n !== unicos.length) throw new ErroNegocio("Responsável (quem) inválido em algum item.");
}

/** Plano sem RNC: "quem" ativo e, se o plano tiver obra, com acesso a ela. */
async function validarQuemPlanoManual(tx: Tx, ids: string[], obraId: string | null) {
  const ativos = new Map((await usuariosAtivos(tx)).map((u) => [u.id, u]));
  for (const id of new Set(ids)) {
    const u = ativos.get(id);
    if (!u) throw new ErroNegocio("Responsável (quem) inválido em algum item.");
    if (obraId && u.obras !== null && !u.obras.includes(obraId)) {
      throw new ErroNegocio(`${u.nome} não tem acesso à obra/unidade deste plano.`);
    }
  }
}

/** Trava otimista do plano sem RNC (versão lida); serializa escritas concorrentes nos itens. */
async function travarPlano(tx: Tx, plano: { id: string; versao: number }, extra: Prisma.PlanoAcaoUncheckedUpdateManyInput = {}) {
  const r = await tx.planoAcao.updateMany({
    where: { id: plano.id, versao: plano.versao },
    data: { ...extra, versao: { increment: 1 } },
  });
  if (r.count === 0) throw new ErroConflito();
}

function dadosItem(d: DadosItem) {
  if (!d.oQue.trim()) throw new ErroNegocio("Informe o que será feito.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.quando)) throw new ErroNegocio("Prazo (quando) inválido.");
  return {
    oQue: d.oQue.trim(),
    porQue: d.porQue?.trim() || null,
    onde: d.onde?.trim() || null,
    quemId: d.quemId,
    quando: paraDataDb(d.quando),
    como: d.como?.trim() || null,
    quanto: d.quanto ?? null,
  };
}

/** Adiciona vários itens ao plano da RNC (cria o plano se necessário) no ciclo atual. */
export async function adicionarItensRnc(a: Ator, rncId: string, itens: DadosItem[]) {
  if (itens.length === 0) throw new ErroNegocio("Informe ao menos um item.");
  if (itens.length > 50) throw new ErroNegocio("No máximo 50 itens por vez.");
  const r = await a.db.$transaction(async (tx) => {
    const rnc = await tx.rnc.findFirst({
      where: { AND: [{ id: rncId }, filtroAcessoRnc(a)] },
      include: { verificacoes: true, planoAcao: { include: { itens: { select: { ordem: true } } } } },
    });
    if (!rnc) throw new ErroNegocio("RNC não encontrada ou sem acesso.");
    if (!podeGerenciarPlanoRnc(a, rnc)) throw new ErroNegocio("Sem permissão para editar o plano de ação.");
    if (!(STATUS_EDICAO_PLANO as readonly string[]).includes(rnc.status)) {
      throw new ErroNegocio("O plano só pode ser editado em análise ou em execução.");
    }
    const dados = itens.map(dadosItem);
    await validarUsuarios(tx, dados.map((d) => d.quemId));

    let planoId = rnc.planoAcaoId;
    if (!planoId) {
      const plano = await tx.planoAcao.create({
        data: {
          empresaId: a.empresaId,
          origemTipo: "RNC",
          origemId: rnc.id,
          titulo: `Plano de ação — ${rnc.codigo}`,
          criadoPorId: a.usuarioId,
        },
      });
      planoId = plano.id;
    }
    // M1: trava/incrementa a versão da RNC na mesma transação.
    await travarRnc(tx, rnc, rnc.planoAcaoId ? {} : { planoAcaoId: planoId });
    const ciclo = cicloAtual(rnc.verificacoes);
    const base = Math.max(0, ...(rnc.planoAcao?.itens.map((i) => i.ordem) ?? []));
    const criados = await tx.itemAcao.createManyAndReturn({
      data: dados.map((d, i) => ({ ...d, empresaId: a.empresaId, planoAcaoId: planoId!, ciclo, ordem: base + i + 1 })),
      select: { id: true },
    });
    return { planoId, ciclo, itemIds: criados.map((c) => c.id) };
  });
  await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { planoId: r.planoId, ciclo: r.ciclo };
}

async function carregarItem(tx: Tx, a: Ator, itemId: string) {
  const item = await tx.itemAcao.findFirst({
    where: { AND: [{ id: itemId }, filtroAcessoItem(a)] },
    include: { planoAcao: { include: { rnc: { include: { verificacoes: true } } } } },
  });
  if (!item) throw new ErroNegocio("Item não encontrado.");
  const rnc = item.planoAcao.rnc;
  // O "quem" enxerga o próprio item mesmo sem acesso à RNC (B4); gerenciar exige acesso à RNC.
  const rncVisivel = !rnc || (await tx.rnc.count({ where: { AND: [{ id: rnc.id }, filtroAcessoRnc(a)] } })) > 0;
  return { ...item, rncVisivel };
}

type ItemCarregado = Awaited<ReturnType<typeof carregarItem>>;

function exigirGerenciar(a: Ator, item: ItemCarregado) {
  const rnc = item.planoAcao.rnc;
  const pode = rnc ? item.rncVisivel && podeGerenciarPlanoRnc(a, rnc) : podeGerenciarPlanoManual(a, item.planoAcao);
  if (!pode) throw new ErroNegocio("Sem permissão para editar o plano de ação.");
  if (rnc) {
    if (!(STATUS_EDICAO_PLANO as readonly string[]).includes(rnc.status)) {
      throw new ErroNegocio("O plano só pode ser editado em análise ou em execução.");
    }
    if (item.ciclo !== cicloAtual(rnc.verificacoes)) throw new ErroNegocio("Itens de ciclos anteriores não podem ser alterados.");
  }
}

function exigirExecucao(a: Ator, item: ItemCarregado) {
  if (item.quemId !== a.usuarioId) throw new ErroNegocio("Somente o responsável pelo item pode atualizá-lo.");
  const rnc = item.planoAcao.rnc;
  if (rnc) {
    if (rnc.status !== "PLANO_EM_EXECUCAO") throw new ErroNegocio("O plano da RNC não está em execução.");
    if (item.ciclo !== cicloAtual(rnc.verificacoes)) throw new ErroNegocio("Item de ciclo anterior.");
  }
}

/**
 * M1: toda escrita em item trava a origem: a RNC (versão + status lidos) ou, em plano sem RNC,
 * o próprio plano (versão lida).
 */
async function travarOrigemDoItem(tx: Tx, item: ItemCarregado) {
  const rnc = item.planoAcao.rnc;
  if (rnc) await travarRnc(tx, rnc);
  else await travarPlano(tx, item.planoAcao);
}

export async function editarItem(a: Ator, itemId: string, d: DadosItem) {
  const trocouQuem = await a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirGerenciar(a, item);
    const dados = dadosItem(d);
    if (item.planoAcao.rnc) await validarUsuarios(tx, [dados.quemId]);
    // Plano sem RNC: o novo "quem" precisa de acesso à obra do plano (o atual é mantido se não mudou).
    else if (dados.quemId !== item.quemId) await validarQuemPlanoManual(tx, [dados.quemId], item.planoAcao.obraId);
    else await validarUsuarios(tx, [dados.quemId]);
    await travarOrigemDoItem(tx, item);
    // Prazo alterado: os alertas de prazo/atraso voltam a valer para a nova data.
    const novoPrazo = dados.quando.getTime() !== item.quando.getTime();
    const r = await tx.itemAcao.updateMany({
      where: { id: itemId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      data: {
        ...(dados as Prisma.ItemAcaoUncheckedUpdateManyInput),
        ...(novoPrazo ? { alertaEnviadoEm: null, atrasoNotificadoEm: null } : {}),
      },
    });
    if (r.count === 0) throw new ErroNegocio("Item já finalizado.");
    return item.quemId !== dados.quemId;
  });
  if (trocouQuem) await notificarItensAtribuidos(a, [itemId], `troca-${Date.now()}`);
}

export async function cancelarItem(a: Ator, itemId: string) {
  return a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirGerenciar(a, item);
    await travarOrigemDoItem(tx, item);
    const r = await tx.itemAcao.updateMany({
      where: { id: itemId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      data: { status: "CANCELADO" },
    });
    if (r.count === 0) throw new ErroNegocio("Item já finalizado.");
  });
}

export async function marcarEmAndamento(a: Ator, itemId: string) {
  return a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirExecucao(a, item);
    await travarOrigemDoItem(tx, item);
    const r = await tx.itemAcao.updateMany({ where: { id: itemId, status: "PENDENTE" }, data: { status: "EM_ANDAMENTO" } });
    if (r.count === 0) throw new ErroNegocio("Item não está pendente.");
  });
}

export async function concluirItem(a: Ator, itemId: string, d: { dataConclusao: string; evidencia: string }) {
  if (!d.evidencia.trim()) throw new ErroNegocio("Descreva a evidência de conclusão.");
  if (d.evidencia.length > 5000) throw new ErroNegocio("Evidência excede 5000 caracteres.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataConclusao)) throw new ErroNegocio("Data de conclusão inválida.");
  return a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirExecucao(a, item);
    await travarOrigemDoItem(tx, item);
    const r = await tx.itemAcao.updateMany({
      where: { id: itemId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      data: { status: "CONCLUIDO", dataConclusao: paraDataDb(d.dataConclusao), evidenciaConclusao: d.evidencia.trim() },
    });
    if (r.count === 0) throw new ErroNegocio("Item já finalizado.");
  });
}

// ---------------------------------------------------------------- planos avulsos (origem MANUAL)

export interface DadosCabecalhoPlano {
  titulo: string;
  /** Objetivo/descrição (opcional). */
  descricao?: string | null;
}

export interface DadosPlanoManual extends DadosCabecalhoPlano {
  /** Obra/unidade opcional: restringe visibilidade/gestão e o "quem" dos itens. */
  obraId?: string | null;
  itens: DadosItem[];
}

const MAX_ITENS_POR_VEZ = 50;

function cabecalhoPlano(d: DadosCabecalhoPlano) {
  const titulo = d.titulo.trim();
  if (titulo.length < 3) throw new ErroNegocio("Informe o título do plano (mínimo 3 caracteres).");
  if (titulo.length > 200) throw new ErroNegocio("Título excede 200 caracteres.");
  const descricao = d.descricao?.trim() || null;
  if (descricao && descricao.length > 5000) throw new ErroNegocio("Objetivo excede 5000 caracteres.");
  return { titulo, descricao };
}

function validarQuantidadeItens(itens: readonly DadosItem[]) {
  if (itens.length === 0) throw new ErroNegocio("Informe ao menos um item.");
  if (itens.length > MAX_ITENS_POR_VEZ) throw new ErroNegocio(`No máximo ${MAX_ITENS_POR_VEZ} itens por vez.`);
}

/** Cria um plano de ação avulso (sem RNC) com os itens 5W2H iniciais. Exige PLANO_GERENCIAR. */
export async function criarPlanoManual(a: Ator, d: DadosPlanoManual) {
  if (!atorTem(a, "PLANO_GERENCIAR")) throw new ErroNegocio("Sem permissão para criar planos de ação.");
  // Regras validadas antes de tocar no banco (repetidas em criarPlanoNaTransacao, que é pura quanto a elas).
  cabecalhoPlano(d);
  validarQuantidadeItens(d.itens);
  d.itens.forEach(dadosItem);
  const obraId = d.obraId || null;
  if (obraId && !obraDoPlanoAcessivel(a, { obraId })) throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
  const r = await a.db.$transaction((tx) => criarPlanoNaTransacao(tx, a, { ...d, obraId }, { tipo: "MANUAL", id: null }));
  await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { id: r.id };
}

/**
 * Cria plano sem RNC (avulso ou de outra origem, ex.: RISCO_OPORTUNIDADE) na transação do
 * chamador. Não checa permissão (quem chama decide) nem notifica — após o commit, chame
 * notificarItensAtribuidos(a, itemIds, "criado").
 */
export async function criarPlanoNaTransacao(
  tx: Tx,
  a: Ator,
  d: DadosPlanoManual,
  origem: { tipo: "MANUAL" | "RISCO_OPORTUNIDADE" | "HIRA" | "LAIA" | "INSPECAO" | "AUDITORIA"; id: string | null },
) {
  const cab = cabecalhoPlano(d);
  validarQuantidadeItens(d.itens);
  const obraId = d.obraId || null;
  const dados = d.itens.map(dadosItem);
  if (obraId && !(await tx.obraUnidade.findFirst({ where: { id: obraId, ativo: true }, select: { id: true } }))) {
    throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
  }
  await validarQuemPlanoManual(tx, dados.map((x) => x.quemId), obraId);
  const plano = await tx.planoAcao.create({
    data: { empresaId: a.empresaId, origemTipo: origem.tipo, origemId: origem.id, ...cab, obraId, criadoPorId: a.usuarioId },
    select: { id: true },
  });
  const criados = await tx.itemAcao.createManyAndReturn({
    data: dados.map((x, i) => ({ ...x, empresaId: a.empresaId, planoAcaoId: plano.id, ciclo: 1, ordem: i + 1 })),
    select: { id: true },
  });
  return { id: plano.id, itemIds: criados.map((c) => c.id) };
}

async function carregarPlanoParaGestao(tx: Tx, a: Ator, planoId: string) {
  const plano = await tx.planoAcao.findFirst({
    where: { AND: [{ id: planoId }, filtroGestaoPlanoManual(a)] },
    include: { itens: { select: { ordem: true } } },
  });
  if (!plano) throw new ErroNegocio("Plano de ação não encontrado ou sem acesso.");
  if (!podeGerenciarPlanoManual(a, plano)) throw new ErroNegocio("Sem permissão para editar o plano de ação.");
  return plano;
}

/** Edita título/objetivo do plano avulso (trava otimista pela versão exibida, se informada). */
export async function editarPlanoManual(a: Ator, planoId: string, d: DadosCabecalhoPlano, versao?: number) {
  const cab = cabecalhoPlano(d);
  await a.db.$transaction(async (tx) => {
    const plano = await carregarPlanoParaGestao(tx, a, planoId);
    if (versao !== undefined && versao !== plano.versao) throw new ErroConflito();
    await travarPlano(tx, plano, cab);
  });
}

/** Adiciona itens 5W2H a um plano avulso. */
export async function adicionarItensPlanoManual(a: Ator, planoId: string, itens: DadosItem[]) {
  validarQuantidadeItens(itens);
  const dados = itens.map(dadosItem);
  const r = await a.db.$transaction(async (tx) => {
    const plano = await carregarPlanoParaGestao(tx, a, planoId);
    await validarQuemPlanoManual(tx, dados.map((x) => x.quemId), plano.obraId);
    await travarPlano(tx, plano);
    const base = Math.max(0, ...plano.itens.map((i) => i.ordem));
    const criados = await tx.itemAcao.createManyAndReturn({
      data: dados.map((x, i) => ({ ...x, empresaId: a.empresaId, planoAcaoId: plano.id, ciclo: 1, ordem: base + i + 1 })),
      select: { id: true },
    });
    return criados.map((c) => c.id);
  });
  await notificarItensAtribuidos(a, r, "criado");
  return { itemIds: r };
}

/**
 * Acrescenta um item a um plano SEM RNC de outra origem (ex.: inspeção) na transação do chamador.
 * Não checa permissão de gestão do plano (quem chama decide) nem notifica. Trava o plano pela versão.
 */
export async function adicionarItemNaTransacao(tx: Tx, a: Ator, planoId: string, item: DadosItem) {
  const dados = dadosItem(item);
  const plano = await tx.planoAcao.findFirst({ where: { id: planoId, rnc: { is: null } }, include: { itens: { select: { ordem: true } } } });
  if (!plano) throw new ErroNegocio("Plano de ação não encontrado.");
  await validarQuemPlanoManual(tx, [dados.quemId], plano.obraId);
  await travarPlano(tx, plano);
  const base = Math.max(0, ...plano.itens.map((i) => i.ordem));
  const criado = await tx.itemAcao.create({ data: { ...dados, empresaId: a.empresaId, planoAcaoId: plano.id, ciclo: 1, ordem: base + 1 }, select: { id: true } });
  return criado.id;
}

/**
 * Plano sem RNC para exibição, com status geral calculado. Visão completa para quem criou ou
 * pode gerenciar; o "quem" de algum item vê o cabeçalho e apenas os próprios itens.
 */
export async function obterPlanoManual(a: Ator, planoId: string) {
  const plano = await a.db.planoAcao.findFirst({
    where: { AND: [{ id: planoId }, filtroAcessoPlanoManual(a)] },
    include: {
      obra: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      itens: { orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }], include: { quem: { select: { nome: true } } } },
    },
  });
  if (!plano) return null;
  const podeGerenciar = podeGerenciarPlanoManual(a, plano);
  const visaoCompleta = podeGerenciar || plano.criadoPorId === a.usuarioId;
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  return {
    ...plano,
    itens: visaoCompleta ? plano.itens : plano.itens.filter((i) => i.quemId === a.usuarioId),
    statusGeral: statusGeralPlano(plano.itens, hoje),
    hoje,
    podeGerenciar,
    visaoCompleta,
  };
}
