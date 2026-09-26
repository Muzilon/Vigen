/**
 * Matriz SWOT + partes interessadas (ISO 9001 4.1/4.2) — docs/06-desenho-modulos.md, seção 3.
 * Leitura: empresa com o módulo SWOT. Escrita: módulo + SWOT_GERENCIAR. Ciclo encerrado é
 * somente leitura (reabra para editar). "Gerar risco/oportunidade" exige também o módulo
 * RISCOS_OPORTUNIDADES e RISCO_GERENCIAR (usa criarRisco).
 */
import { Prisma, type QuadranteSwot } from "@prisma/client";
import { atorTem, type Ator, type Tx } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";
import { criarRisco, exigirModuloRiscos } from "@/lib/riscos/servico";
import type { DadosRisco } from "@/lib/riscos/regras";
import { normalizarCiclo, normalizarItem, normalizarParte, tipoRiscoDoQuadrante } from "./regras";

export async function moduloSwotAtivo(a: Pick<Ator, "db" | "empresaId">) {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("SWOT");
}

export async function exigirModuloSwot(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloSwotAtivo(a))) throw new ErroNegocio("Módulo SWOT não contratado para esta empresa.");
}

export const podeGerenciarSwot = (a: Pick<Ator, "permissoes">) => atorTem(a, "SWOT_GERENCIAR");

async function exigirGestao(a: Ator) {
  await exigirModuloSwot(a);
  if (!podeGerenciarSwot(a)) throw new ErroNegocio("Sem permissão para gerenciar a SWOT (SWOT_GERENCIAR).");
}

function ehUnicoViolado(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function cicloAberto(tx: Tx | Ator["db"], cicloId: string) {
  const c = await tx.cicloSwot.findFirst({ where: { id: cicloId }, select: { id: true, encerrado: true } });
  if (!c) throw new ErroNegocio("Ciclo SWOT não encontrado.");
  if (c.encerrado) throw new ErroNegocio("Ciclo encerrado: reabra para editar.");
  return c;
}

// ---------------------------------------------------------------- leitura

export async function listarCiclos(a: Ator) {
  await exigirModuloSwot(a);
  return a.db.cicloSwot.findMany({
    orderBy: { ano: "desc" },
    include: { _count: { select: { itens: true, partesInteressadas: true } } },
  });
}

export async function obterCiclo(a: Ator, id: string) {
  await exigirModuloSwot(a);
  return a.db.cicloSwot.findFirst({
    where: { id },
    include: {
      itens: {
        orderBy: [{ relevancia: "desc" }, { criadoEm: "asc" }],
        include: { riscoOportunidade: { select: { id: true, numero: true, tipo: true, faixa: true, ativo: true } } },
      },
      partesInteressadas: { orderBy: [{ influencia: "desc" }, { interesse: "desc" }, { nome: "asc" }] },
      criadoPor: { select: { nome: true } },
    },
  });
}

// ---------------------------------------------------------------- ciclos

export async function criarCiclo(a: Ator, d: { ano: number; titulo?: string | null }) {
  await exigirGestao(a);
  const dados = normalizarCiclo(d);
  try {
    return await a.db.cicloSwot.create({ data: { ...dados, empresaId: a.empresaId, criadoPorId: a.usuarioId }, select: { id: true } });
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio(`Já existe um ciclo SWOT para ${dados.ano}.`);
    throw e;
  }
}

export async function editarCiclo(a: Ator, id: string, d: { titulo?: string | null; encerrado?: boolean }) {
  await exigirGestao(a);
  const c = await a.db.cicloSwot.findFirst({ where: { id } });
  if (!c) throw new ErroNegocio("Ciclo SWOT não encontrado.");
  const { titulo } = normalizarCiclo({ ano: c.ano, titulo: d.titulo ?? c.titulo });
  await a.db.cicloSwot.updateMany({ where: { id }, data: { titulo, ...(d.encerrado !== undefined ? { encerrado: d.encerrado } : {}) } });
}

/**
 * Cria o ciclo do `ano` copiando itens e partes interessadas do ciclo anterior mais recente
 * (vínculos com riscos não são copiados — cada ano gera os seus).
 */
export async function copiarCicloAnterior(a: Ator, ano: number) {
  await exigirGestao(a);
  const dados = normalizarCiclo({ ano });
  try {
    return await a.db.$transaction(async (tx) => {
      const anterior = await tx.cicloSwot.findFirst({
        where: { ano: { lt: ano } },
        orderBy: { ano: "desc" },
        include: { itens: true, partesInteressadas: true },
      });
      if (!anterior) throw new ErroNegocio(`Não há ciclo anterior a ${ano} para copiar.`);
      const novo = await tx.cicloSwot.create({ data: { ...dados, empresaId: a.empresaId, criadoPorId: a.usuarioId }, select: { id: true } });
      if (anterior.itens.length) {
        await tx.itemSwot.createMany({
          data: anterior.itens.map((i) => ({ empresaId: a.empresaId, cicloId: novo.id, quadrante: i.quadrante, descricao: i.descricao, relevancia: i.relevancia })),
        });
      }
      if (anterior.partesInteressadas.length) {
        await tx.parteInteressada.createMany({
          data: anterior.partesInteressadas.map((p) => ({
            empresaId: a.empresaId,
            cicloId: novo.id,
            nome: p.nome,
            necessidades: p.necessidades,
            expectativas: p.expectativas,
            influencia: p.influencia,
            interesse: p.interesse,
          })),
        });
      }
      return { id: novo.id, anoOrigem: anterior.ano };
    });
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio(`Já existe um ciclo SWOT para ${ano}.`);
    throw e;
  }
}

// ---------------------------------------------------------------- itens

export async function adicionarItem(a: Ator, cicloId: string, d: { quadrante: QuadranteSwot; descricao: string; relevancia: number }) {
  await exigirGestao(a);
  const dados = normalizarItem(d);
  await cicloAberto(a.db, cicloId);
  return a.db.itemSwot.create({ data: { ...dados, empresaId: a.empresaId, cicloId }, select: { id: true } });
}

async function itemDoCicloAberto(a: Ator, itemId: string) {
  const i = await a.db.itemSwot.findFirst({ where: { id: itemId } });
  if (!i) throw new ErroNegocio("Item não encontrado.");
  await cicloAberto(a.db, i.cicloId);
  return i;
}

export async function editarItem(a: Ator, itemId: string, d: { quadrante: QuadranteSwot; descricao: string; relevancia: number }) {
  await exigirGestao(a);
  const dados = normalizarItem(d);
  await itemDoCicloAberto(a, itemId);
  await a.db.itemSwot.updateMany({ where: { id: itemId }, data: dados });
}

export async function removerItem(a: Ator, itemId: string) {
  await exigirGestao(a);
  await itemDoCicloAberto(a, itemId);
  await a.db.itemSwot.deleteMany({ where: { id: itemId } });
}

/**
 * Gera um risco (fraqueza/ameaça) ou oportunidade (força/oportunidade) a partir do item,
 * pré-preenchido com a descrição, e vincula o item a ele.
 */
export async function gerarRiscoDoItem(
  a: Ator,
  itemId: string,
  d: Partial<Omit<DadosRisco, "tipo">> & { probabilidade: number; impacto: number },
) {
  await exigirGestao(a);
  await exigirModuloRiscos(a);
  const item = await itemDoCicloAberto(a, itemId);
  if (item.riscoOportunidadeId) throw new ErroNegocio("Este item já está vinculado a um risco/oportunidade.");
  const r = await criarRisco(a, {
    ...d,
    tipo: tipoRiscoDoQuadrante(item.quadrante),
    descricao: d.descricao?.trim() || item.descricao,
    probabilidade: d.probabilidade,
    impacto: d.impacto,
  });
  const res = await a.db.itemSwot.updateMany({ where: { id: itemId, riscoOportunidadeId: null }, data: { riscoOportunidadeId: r.id } });
  if (res.count === 0) throw new ErroNegocio("O item foi vinculado por outra pessoa ao mesmo tempo.");
  return r;
}

// ---------------------------------------------------------------- partes interessadas

type DadosParte = { nome: string; necessidades?: string | null; expectativas?: string | null; influencia: number; interesse: number };

export async function adicionarParte(a: Ator, cicloId: string, d: DadosParte) {
  await exigirGestao(a);
  const dados = normalizarParte(d);
  await cicloAberto(a.db, cicloId);
  return a.db.parteInteressada.create({ data: { ...dados, empresaId: a.empresaId, cicloId }, select: { id: true } });
}

async function parteDoCicloAberto(a: Ator, id: string) {
  const p = await a.db.parteInteressada.findFirst({ where: { id } });
  if (!p) throw new ErroNegocio("Parte interessada não encontrada.");
  await cicloAberto(a.db, p.cicloId);
  return p;
}

export async function editarParte(a: Ator, id: string, d: DadosParte) {
  await exigirGestao(a);
  const dados = normalizarParte(d);
  await parteDoCicloAberto(a, id);
  await a.db.parteInteressada.updateMany({ where: { id }, data: dados });
}

export async function removerParte(a: Ator, id: string) {
  await exigirGestao(a);
  await parteDoCicloAberto(a, id);
  await a.db.parteInteressada.deleteMany({ where: { id } });
}
