import type { Prisma } from "@prisma/client";
import { atorTem, type Ator, type Tx } from "@/lib/ator";
import { paraDataDb } from "@/lib/datas";
import { ErroNegocio } from "@/lib/erros";
import { cicloAtual } from "@/lib/rnc/estados";
import { notificarItensAtribuidos } from "@/lib/notificacoes/gatilhos";
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
  const pode = rnc ? item.rncVisivel && podeGerenciarPlanoRnc(a, rnc) : atorTem(a, "PLANO_GERENCIAR");
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

/** M1: toda escrita em item vinculado a RNC trava a RNC (versão + status lidos). */
async function travarRncDoItem(tx: Tx, item: ItemCarregado) {
  const rnc = item.planoAcao.rnc;
  if (rnc) await travarRnc(tx, rnc);
}

export async function editarItem(a: Ator, itemId: string, d: DadosItem) {
  const trocouQuem = await a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirGerenciar(a, item);
    const dados = dadosItem(d);
    await validarUsuarios(tx, [dados.quemId]);
    await travarRncDoItem(tx, item);
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
    await travarRncDoItem(tx, item);
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
    await travarRncDoItem(tx, item);
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
    await travarRncDoItem(tx, item);
    const r = await tx.itemAcao.updateMany({
      where: { id: itemId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      data: { status: "CONCLUIDO", dataConclusao: paraDataDb(d.dataConclusao), evidenciaConclusao: d.evidencia.trim() },
    });
    if (r.count === 0) throw new ErroNegocio("Item já finalizado.");
  });
}
