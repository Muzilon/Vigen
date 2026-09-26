/**
 * Inspeções — regras de acesso sem dependência de outros serviços (usadas por anexos, interações e telas).
 * Leitura: módulo INSPECOES contratado + obra da inspeção no escopo do ator.
 * Modelos: INSPECAO_GERENCIAR. Realizar (abrir e executar a própria): INSPECAO_REALIZAR.
 * Executar/cancelar uma inspeção: o inspetor (com INSPECAO_REALIZAR) ou INSPECAO_GERENCIAR.
 */
import { atorTem, type Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";

export const linkInspecao = (id: string) => `/inspecoes/${id}`;

export async function moduloInspecoesAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("INSPECOES");
}

export async function exigirModuloInspecoes(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloInspecoesAtivo(a))) throw new ErroNegocio("Módulo de Inspeções não contratado para esta empresa.");
}

export const podeGerenciarModelos = (a: Pick<Ator, "permissoes">) => atorTem(a, "INSPECAO_GERENCIAR");
export const podeRealizarInspecao = (a: Pick<Ator, "permissoes">) => atorTem(a, "INSPECAO_REALIZAR") || atorTem(a, "INSPECAO_GERENCIAR");
export const podeExecutarInspecao = (a: Pick<Ator, "permissoes" | "usuarioId">, i: { inspetorId: string }) =>
  atorTem(a, "INSPECAO_GERENCIAR") || (atorTem(a, "INSPECAO_REALIZAR") && i.inspetorId === a.usuarioId);
