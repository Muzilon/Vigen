/**
 * Treinamentos (P7) — regras de acesso.
 * Catálogo (treinamentos e sessões): qualquer usuário com o módulo TREINAMENTOS.
 * Cadastrar treinamento/sessão, lançar presença, anexar certificado e ver a matriz/participantes: TREINAMENTO_GERENCIAR.
 * Cada usuário vê a própria situação e os próprios certificados.
 */
import { atorTem, type Ator } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";

export const linkTreinamento = (id: string) => `/treinamentos/${id}`;

export async function moduloTreinamentosAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("TREINAMENTOS");
}

export async function exigirModuloTreinamentos(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloTreinamentosAtivo(a))) throw new ErroNegocio("Módulo de Treinamentos não contratado para esta empresa.");
}

export const podeGerenciarTreinamentos = (a: Pick<Ator, "permissoes">) => atorTem(a, "TREINAMENTO_GERENCIAR");
