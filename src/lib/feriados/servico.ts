/**
 * Calendário de feriados da empresa (permissão ADMIN_CONFIG para gravar e listar na tela).
 * Alimenta o cálculo de dias úteis (`somarDiasUteis`/`diasUteisEntre` em `@/lib/datas`).
 * Cadastrar, editar ou inativar feriado NÃO recalcula prazos já gravados.
 * Exclusão lógica (`ativo`); trava otimista por `versao`. Sem histórico próprio (decisão do doc 04:
 * tabela por linha, com criadoPorId/criadoEm/atualizadoEm).
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { atorTem, fusoDaEmpresa, type Ator } from "@/lib/ator";
import { anoNoFuso, dataIso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";

function exigirAdmin(a: Ator) {
  if (!atorTem(a, "ADMIN_CONFIG")) throw new ErroNegocio("Sem permissão para administrar feriados.");
}

const esquemaData = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").refine((s) => {
  const d = paraDataDb(s);
  return !Number.isNaN(d.getTime()) && dataIso(d) === s;
}, "Data inválida.");

export const esquemaFeriado = z.object({
  data: esquemaData,
  descricao: z.string().trim().min(1, "Informe a descrição do feriado.").max(120, "Descrição muito longa."),
});

function validar<T extends z.ZodType>(esquema: T, dados: unknown): z.output<T> {
  const r = esquema.safeParse(dados);
  if (!r.success) throw new ErroNegocio(r.error.issues.map((i) => i.message).join(" "));
  return r.data;
}

export interface FeriadoLinha {
  id: string;
  data: string;
  descricao: string;
  ativo: boolean;
  versao: number;
}

const selecao = { id: true, data: true, descricao: true, ativo: true, versao: true } as const;
const paraLinha = (f: { id: string; data: Date; descricao: string; ativo: boolean; versao: number }): FeriadoLinha => ({
  ...f,
  data: dataIso(f.data),
});

/** Lista feriados da empresa (por data). Sem `ano`, todos; `incluirInativos` só para a tela de administração. */
export async function listarFeriados(a: Ator, opcoes: { ano?: number; incluirInativos?: boolean } = {}) {
  exigirAdmin(a);
  const { ano, incluirInativos = false } = opcoes;
  const rows = await a.db.feriadoEmpresa.findMany({
    where: {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(ano ? { data: { gte: paraDataDb(`${ano}-01-01`), lte: paraDataDb(`${ano}-12-31`) } } : {}),
    },
    orderBy: { data: "asc" },
    select: selecao,
  });
  return rows.map(paraLinha);
}

/**
 * Feriados ATIVOS como conjunto de YYYY-MM-DD, para o cálculo de dias úteis. Sem checagem de permissão
 * de administração: é leitura interna de serviços (ex.: criar atividade) que já exigiram a sua própria.
 */
export async function carregarFeriados(a: Pick<Ator, "db">): Promise<Set<string>> {
  const rows = await a.db.feriadoEmpresa.findMany({ where: { ativo: true }, select: { data: true } });
  return new Set(rows.map((r) => dataIso(r.data)));
}

/** Aviso na tela: true quando o ano corrente (no fuso da empresa) não tem nenhum feriado ativo. */
export async function faltaFeriadoNoAnoCorrente(a: Ator, agora: Date = new Date()): Promise<boolean> {
  exigirAdmin(a);
  const ano = anoNoFuso(await fusoDaEmpresa(a), agora);
  const n = await a.db.feriadoEmpresa.count({
    where: { ativo: true, data: { gte: paraDataDb(`${ano}-01-01`), lte: paraDataDb(`${ano}-12-31`) } },
  });
  return n === 0;
}

/** Cria o feriado. Data já cadastrada e ativa: erro; data cadastrada e inativa: é reativada. */
export async function criarFeriado(a: Ator, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaFeriado, dados);
  const data = paraDataDb(d.data);
  try {
    return await a.db.$transaction(async (tx) => {
      const existente = await tx.feriadoEmpresa.findFirst({ where: { data }, select: { id: true, ativo: true, versao: true } });
      if (existente) {
        if (existente.ativo) throw new ErroNegocio("Já existe um feriado cadastrado nesta data.");
        const r = await tx.feriadoEmpresa.updateMany({
          where: { id: existente.id, versao: existente.versao },
          data: { ativo: true, descricao: d.descricao, versao: { increment: 1 } },
        });
        if (r.count === 0) throw new ErroConflito();
        return { id: existente.id };
      }
      return tx.feriadoEmpresa.create({
        data: { empresaId: a.empresaId, data, descricao: d.descricao, criadoPorId: a.usuarioId },
        select: { id: true },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ErroNegocio("Já existe um feriado cadastrado nesta data.");
    }
    throw e;
  }
}

/** Edita data e/ou descrição com trava otimista. */
export async function editarFeriado(a: Ator, id: string, versao: number, dados: unknown) {
  exigirAdmin(a);
  const d = validar(esquemaFeriado, dados);
  try {
    const r = await a.db.feriadoEmpresa.updateMany({
      where: { id, versao, ativo: true },
      data: { data: paraDataDb(d.data), descricao: d.descricao, versao: { increment: 1 } },
    });
    if (r.count === 0) await falhaDeAtualizacao(a, id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ErroNegocio("Já existe um feriado cadastrado nesta data.");
    }
    throw e;
  }
  return { id };
}

/** Inativa (exclusão lógica) com trava otimista. Não recalcula prazos já gravados. */
export async function inativarFeriado(a: Ator, id: string, versao: number) {
  exigirAdmin(a);
  const r = await a.db.feriadoEmpresa.updateMany({
    where: { id, versao, ativo: true },
    data: { ativo: false, versao: { increment: 1 } },
  });
  if (r.count === 0) await falhaDeAtualizacao(a, id);
  return { id };
}

/** count === 0: não existe na empresa (negócio) ou a versão mudou/já inativo (conflito). */
async function falhaDeAtualizacao(a: Ator, id: string): Promise<never> {
  const atual = await a.db.feriadoEmpresa.findFirst({ where: { id }, select: { id: true } });
  if (!atual) throw new ErroNegocio("Feriado não encontrado.");
  throw new ErroConflito();
}
