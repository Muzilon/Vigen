/**
 * Auditorias — regras de acesso sem dependência de outros serviços (usadas por anexos, interações e telas).
 * Leitura: módulo AUDITORIAS + (auditoria sem obra = empresa toda, ou obra no escopo do ator).
 * Planejar (programa, nova auditoria, editar, cancelar): AUDITORIA_GERENCIAR.
 * Executar (iniciar, plano, constatações, concluir, abrir RNC): AUDITORIA_GERENCIAR ou o auditor líder com AUDITORIA_REALIZAR.
 */
import type { Prisma } from "@prisma/client";
import { atorTem, type Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";

export const linkAuditoria = (id: string) => `/auditorias/${id}`;

export async function moduloAuditoriasAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("AUDITORIAS");
}

export async function exigirModuloAuditorias(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloAuditoriasAtivo(a))) throw new ErroNegocio("Módulo de Auditorias não contratado para esta empresa.");
}

/** Escopo: sem obra = visível a todos com o módulo; com obra = obra no escopo. */
export function filtroObraAuditoria(a: Pick<Ator, "obrasPermitidas">): Prisma.AuditoriaWhereInput {
  if (a.obrasPermitidas === null) return {};
  return { OR: [{ obraId: null }, { obraId: { in: [...a.obrasPermitidas] } }] };
}

export const podeGerenciarAuditorias = (a: Pick<Ator, "permissoes">) => atorTem(a, "AUDITORIA_GERENCIAR");
export const podeExecutarAuditoria = (a: Pick<Ator, "permissoes" | "usuarioId">, au: { auditorLiderId: string }) =>
  atorTem(a, "AUDITORIA_GERENCIAR") || (atorTem(a, "AUDITORIA_REALIZAR") && au.auditorLiderId === a.usuarioId);
