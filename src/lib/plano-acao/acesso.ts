import type { Prisma } from "@prisma/client";
import { atorTem, type Ator } from "@/lib/ator";

/**
 * Regras de acesso a planos de ação SEM RNC de origem (avulsos/MANUAL). Módulo sem dependências
 * de serviços, usado por rnc/servico (filtroAcessoItem), plano-acao/servico, anexos e telas.
 */

/** Obra do plano acessível ao ator (plano sem obra = da empresa toda). */
export function obraDoPlanoAcessivel(a: Pick<Ator, "obrasPermitidas">, plano: { obraId: string | null }) {
  return plano.obraId === null || a.obrasPermitidas === null || a.obrasPermitidas.includes(plano.obraId);
}

/** Gerenciar plano sem RNC: PLANO_GERENCIAR e acesso à obra do plano (se houver). */
export function podeGerenciarPlanoManual(a: Pick<Ator, "permissoes" | "obrasPermitidas">, plano: { obraId: string | null }) {
  return atorTem(a, "PLANO_GERENCIAR") && obraDoPlanoAcessivel(a, plano);
}

/**
 * Quem pode registrar a conclusão de um item: o responsável (quem) ou a qualidade/administração
 * (PLANO_GERENCIAR) com acesso ao item. Em item de RNC, o acesso é o da RNC (`rncVisivel`); em plano
 * avulso, o da obra do plano. A situação da RNC (plano em execução, ciclo atual) é checada à parte.
 */
export function podeConcluirItem(
  a: Pick<Ator, "usuarioId" | "permissoes" | "obrasPermitidas">,
  item: { quemId: string; planoAcao: { obraId: string | null; rnc: unknown } },
  rncVisivel = true,
) {
  if (item.quemId === a.usuarioId) return true;
  if (!atorTem(a, "PLANO_GERENCIAR")) return false;
  return item.planoAcao.rnc ? rncVisivel : obraDoPlanoAcessivel(a, item.planoAcao);
}

/** Filtro de obra do plano (Prisma) equivalente a obraDoPlanoAcessivel. */
function filtroObraPlano(a: Pick<Ator, "obrasPermitidas">): Prisma.PlanoAcaoWhereInput {
  if (a.obrasPermitidas === null) return {};
  return { OR: [{ obraId: null }, { obraId: { in: [...a.obrasPermitidas] } }] };
}

/**
 * Planos sem RNC com visão completa (todos os itens): quem criou ou quem pode gerenciar
 * (PLANO_GERENCIAR + obra). O "quem" de um item vê o plano apenas com os próprios itens.
 */
export function filtroGestaoPlanoManual(a: Pick<Ator, "usuarioId" | "permissoes" | "obrasPermitidas">): Prisma.PlanoAcaoWhereInput {
  const ou: Prisma.PlanoAcaoWhereInput[] = [{ criadoPorId: a.usuarioId }];
  if (atorTem(a, "PLANO_GERENCIAR")) ou.push(filtroObraPlano(a));
  return { rnc: { is: null }, OR: ou };
}

/** Planos sem RNC visíveis: visão completa ou "quem" de algum item. */
export function filtroAcessoPlanoManual(a: Pick<Ator, "usuarioId" | "permissoes" | "obrasPermitidas">): Prisma.PlanoAcaoWhereInput {
  return {
    rnc: { is: null },
    OR: [filtroGestaoPlanoManual(a), { itens: { some: { quemId: a.usuarioId } } }],
  };
}

export const linkPlano = (id: string) => `/plano-acao/planos/${id}`;
