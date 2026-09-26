import type { Prisma } from "@prisma/client";
import { atorTem, type Ator, type Tx } from "@/lib/ator";
import { paraDataDb } from "@/lib/datas";
import { ErroNegocio } from "@/lib/erros";
import { cicloAtual } from "@/lib/rnc/estados";
import { filtroAcessoRnc, podeGerenciarPlanoRnc } from "@/lib/rnc/servico";

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
  return a.db.$transaction(async (tx) => {
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
      await tx.rnc.update({ where: { id: rnc.id }, data: { planoAcaoId: planoId } });
    }
    const ciclo = cicloAtual(rnc.verificacoes);
    const base = Math.max(0, ...(rnc.planoAcao?.itens.map((i) => i.ordem) ?? []));
    await tx.itemAcao.createMany({
      data: dados.map((d, i) => ({ ...d, empresaId: a.empresaId, planoAcaoId: planoId!, ciclo, ordem: base + i + 1 })),
    });
    return { planoId, ciclo };
  });
}

async function carregarItem(tx: Tx, a: Ator, itemId: string) {
  const item = await tx.itemAcao.findFirst({
    where: { id: itemId },
    include: { planoAcao: { include: { rnc: { include: { verificacoes: true } } } } },
  });
  if (!item) throw new ErroNegocio("Item não encontrado.");
  const rnc = item.planoAcao.rnc;
  if (rnc) {
    // Garante visibilidade da RNC de origem (quem do item é sempre envolvido).
    const visivel = await tx.rnc.count({ where: { AND: [{ id: rnc.id }, filtroAcessoRnc(a)] } });
    if (!visivel) throw new ErroNegocio("Item não encontrado.");
  }
  return item;
}

type ItemCarregado = Awaited<ReturnType<typeof carregarItem>>;

function exigirGerenciar(a: Ator, item: ItemCarregado) {
  const rnc = item.planoAcao.rnc;
  const pode = rnc ? podeGerenciarPlanoRnc(a, rnc) : atorTem(a, "PLANO_GERENCIAR");
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

export async function editarItem(a: Ator, itemId: string, d: DadosItem) {
  return a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirGerenciar(a, item);
    const dados = dadosItem(d);
    await validarUsuarios(tx, [dados.quemId]);
    const r = await tx.itemAcao.updateMany({
      where: { id: itemId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      data: dados as Prisma.ItemAcaoUncheckedUpdateManyInput,
    });
    if (r.count === 0) throw new ErroNegocio("Item já finalizado.");
  });
}

export async function cancelarItem(a: Ator, itemId: string) {
  return a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirGerenciar(a, item);
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
    const r = await tx.itemAcao.updateMany({ where: { id: itemId, status: "PENDENTE" }, data: { status: "EM_ANDAMENTO" } });
    if (r.count === 0) throw new ErroNegocio("Item não está pendente.");
  });
}

export async function concluirItem(a: Ator, itemId: string, d: { dataConclusao: string; evidencia: string }) {
  if (!d.evidencia.trim()) throw new ErroNegocio("Descreva a evidência de conclusão.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataConclusao)) throw new ErroNegocio("Data de conclusão inválida.");
  return a.db.$transaction(async (tx) => {
    const item = await carregarItem(tx, a, itemId);
    exigirExecucao(a, item);
    const r = await tx.itemAcao.updateMany({
      where: { id: itemId, status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
      data: { status: "CONCLUIDO", dataConclusao: paraDataDb(d.dataConclusao), evidenciaConclusao: d.evidencia.trim() },
    });
    if (r.count === 0) throw new ErroNegocio("Item já finalizado.");
  });
}
