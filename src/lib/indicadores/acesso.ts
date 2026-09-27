/**
 * Indicadores (P7) — regras de acesso.
 * Leitura: módulo INDICADORES (indicador é da empresa, sem escopo de obra).
 * Cadastro/edição/inativação: INDICADOR_GERENCIAR. Lançar resultado: INDICADOR_GERENCIAR ou o responsável.
 */
import { atorTem, type Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";

export const linkIndicador = (id: string) => `/indicadores/${id}`;

export async function moduloIndicadoresAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("INDICADORES");
}

export async function exigirModuloIndicadores(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloIndicadoresAtivo(a))) throw new ErroNegocio("Módulo de Indicadores não contratado para esta empresa.");
}

export const podeGerenciarIndicadores = (a: Pick<Ator, "permissoes">) => atorTem(a, "INDICADOR_GERENCIAR");

export const podeLancarResultado = (a: Pick<Ator, "permissoes" | "usuarioId">, i: { responsavelId: string | null }) =>
  atorTem(a, "INDICADOR_GERENCIAR") || (!!i.responsavelId && i.responsavelId === a.usuarioId);
