/**
 * Incidentes — regras de acesso sem dependência de outros serviços (anexos, interações, telas).
 * Leitura: módulo INCIDENTES + obra no escopo + restrição LGPD (mesma lógica da RNC restrita): incidente restrito só é
 * visível a quem tem INCIDENTE_VER_RESTRITOS, a quem registrou e ao responsável pela investigação.
 * Dados sensíveis (IncidenteDadosSensiveis, envolvido, testemunhas, anexos sensíveis): somente INCIDENTE_VER_RESTRITOS —
 * sem a permissão o usuário não os vê nem sabe que existem.
 * Registrar: qualquer usuário com o módulo e a obra no escopo (participação dos trabalhadores, ISO 45001 5.4).
 * Investigar/editar/plano/concluir: INCIDENTE_GERENCIAR ou o responsável pela investigação.
 */
import type { Prisma } from "@prisma/client";
import { atorTem, type Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";

export const linkIncidente = (id: string) => `/incidentes/${id}`;

export async function moduloIncidentesAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("INCIDENTES");
}

export async function exigirModuloIncidentes(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloIncidentesAtivo(a))) throw new ErroNegocio("Módulo de Incidentes e Acidentes não contratado para esta empresa.");
}

export const podeVerRestritosIncidente = (a: Pick<Ator, "permissoes">) => atorTem(a, "INCIDENTE_VER_RESTRITOS");
export const podeGerenciarIncidentes = (a: Pick<Ator, "permissoes">) => atorTem(a, "INCIDENTE_GERENCIAR");
export const podeTratarIncidente = (a: Pick<Ator, "permissoes" | "usuarioId">, i: { responsavelId: string | null }) =>
  atorTem(a, "INCIDENTE_GERENCIAR") || (!!i.responsavelId && i.responsavelId === a.usuarioId);

/** Escopo de obras + restrição LGPD. */
export function filtroAcessoIncidente(a: Pick<Ator, "obrasPermitidas" | "permissoes" | "usuarioId">): Prisma.IncidenteWhereInput {
  const and: Prisma.IncidenteWhereInput[] = [];
  if (a.obrasPermitidas !== null) and.push({ obraId: { in: [...a.obrasPermitidas] } });
  if (!podeVerRestritosIncidente(a)) and.push({ OR: [{ restrita: false }, { registradoPorId: a.usuarioId }, { responsavelId: a.usuarioId }] });
  return { AND: and };
}
