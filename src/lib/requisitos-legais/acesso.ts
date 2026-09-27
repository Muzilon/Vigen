/**
 * Requisitos legais — regras de acesso sem dependência de outros serviços (anexos, interações, telas).
 * Leitura: módulo REQUISITOS_LEGAIS + (requisito sem obra = empresa toda, ou obra no escopo do ator).
 * Cadastro/edição/exclusão/revisão geral: REQUISITO_LEGAL_GERENCIAR.
 * Verificação de atendimento e plano de ação: REQUISITO_LEGAL_GERENCIAR ou o responsável do requisito.
 */
import type { Prisma } from "@prisma/client";
import { atorTem, type Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";

export const linkRequisito = (id: string) => `/requisitos-legais/${id}`;

export async function moduloRequisitosAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("REQUISITOS_LEGAIS");
}

export async function exigirModuloRequisitos(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloRequisitosAtivo(a))) throw new ErroNegocio("Módulo de Requisitos Legais não contratado para esta empresa.");
}

/** Escopo: sem obra = visível a todos com o módulo; com obra = obra no escopo. */
export function filtroObraRequisito(a: Pick<Ator, "obrasPermitidas">): Prisma.RequisitoLegalWhereInput {
  if (a.obrasPermitidas === null) return {};
  return { OR: [{ obraId: null }, { obraId: { in: [...a.obrasPermitidas] } }] };
}

export const podeGerenciarRequisitos = (a: Pick<Ator, "permissoes">) => atorTem(a, "REQUISITO_LEGAL_GERENCIAR");

export const podeVerificarRequisito = (a: Pick<Ator, "permissoes" | "usuarioId">, r: { responsavelId: string | null }) =>
  atorTem(a, "REQUISITO_LEGAL_GERENCIAR") || (!!r.responsavelId && r.responsavelId === a.usuarioId);
