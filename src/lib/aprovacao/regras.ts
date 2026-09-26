/**
 * Regras puras do motor de aprovação (sem banco): montagem das etapas e máquina de estados
 * de uma decisão. O serviço (servico.ts) aplica o resultado dentro da transação.
 */
import type { ModoAprovacao, StatusEtapaAprovacao, StatusFluxoAprovacao } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const MAX_APROVADORES = 20;
export const MAX_COMENTARIO = 2000;

export interface EtapaNova {
  ordem: number;
  aprovadorId: string;
  status: StatusEtapaAprovacao;
}

/**
 * Valida a lista de aprovadores: ao menos um, sem repetição, sem o solicitante e todos
 * ativos na empresa (`ativos` = ids de usuários ativos do tenant).
 */
export function validarAprovadores(solicitanteId: string, aprovadorIds: readonly string[], ativos: ReadonlySet<string>) {
  if (aprovadorIds.length === 0) throw new ErroNegocio("Informe ao menos um aprovador.");
  if (aprovadorIds.length > MAX_APROVADORES) throw new ErroNegocio(`No máximo ${MAX_APROVADORES} aprovadores.`);
  if (new Set(aprovadorIds).size !== aprovadorIds.length) throw new ErroNegocio("Aprovador repetido na lista.");
  if (aprovadorIds.includes(solicitanteId)) throw new ErroNegocio("O solicitante não pode ser aprovador do próprio pedido.");
  if (aprovadorIds.some((id) => !ativos.has(id))) throw new ErroNegocio("Aprovador inválido ou inativo.");
}

/** Sequencial: 1ª etapa PENDENTE e demais AGUARDANDO. Paralelo: todas PENDENTE. */
export function montarEtapas(modo: ModoAprovacao, aprovadorIds: readonly string[]): EtapaNova[] {
  return aprovadorIds.map((aprovadorId, i) => ({
    ordem: i + 1,
    aprovadorId,
    status: modo === "PARALELO" || i === 0 ? "PENDENTE" : "AGUARDANDO",
  }));
}

export interface EtapaEstado {
  id: string;
  ordem: number;
  aprovadorId: string;
  status: StatusEtapaAprovacao;
}

export type Decisao = "APROVAR" | "REJEITAR";

export interface ResultadoDecisao {
  /** Etapa decidida pelo ator. */
  etapaId: string;
  /** Mudanças de status de etapas (inclui a decidida). */
  mudancas: { id: string; status: StatusEtapaAprovacao }[];
  /** Status resultante do fluxo. */
  statusFluxo: StatusFluxoAprovacao;
  /** Etapas que passaram a PENDENTE (notificar os aprovadores). */
  novasPendentes: EtapaEstado[];
}

/** Comentário obrigatório na rejeição; opcional na aprovação. */
export function normalizarComentario(decisao: Decisao, comentario: string | null | undefined): string | null {
  const c = (comentario ?? "").trim();
  if (decisao === "REJEITAR" && !c) throw new ErroNegocio("Informe o motivo da rejeição.");
  if (c.length > MAX_COMENTARIO) throw new ErroNegocio(`Comentário com no máximo ${MAX_COMENTARIO} caracteres.`);
  return c || null;
}

/**
 * Aplica a decisão de `usuarioId` sobre o conjunto de etapas. Só o aprovador de uma etapa
 * PENDENTE decide. Rejeição encerra o fluxo (demais não decididas → IGNORADA). Aprovação da
 * última etapa → APROVADO; no sequencial, a próxima AGUARDANDO vira PENDENTE.
 */
export function aplicarDecisao(etapas: readonly EtapaEstado[], usuarioId: string, decisao: Decisao): ResultadoDecisao {
  const minha = etapas.find((e) => e.aprovadorId === usuarioId && e.status === "PENDENTE");
  if (!minha) throw new ErroNegocio("Não há etapa pendente de decisão sua neste fluxo.");
  const mudancas: ResultadoDecisao["mudancas"] = [];
  if (decisao === "REJEITAR") {
    mudancas.push({ id: minha.id, status: "REJEITADA" });
    for (const e of etapas) {
      if (e.id !== minha.id && (e.status === "PENDENTE" || e.status === "AGUARDANDO")) mudancas.push({ id: e.id, status: "IGNORADA" });
    }
    return { etapaId: minha.id, mudancas, statusFluxo: "REJEITADO", novasPendentes: [] };
  }
  mudancas.push({ id: minha.id, status: "APROVADA" });
  const restantes = etapas.filter((e) => e.id !== minha.id && e.status !== "APROVADA");
  if (restantes.length === 0) return { etapaId: minha.id, mudancas, statusFluxo: "APROVADO", novasPendentes: [] };
  const aindaPendentes = restantes.filter((e) => e.status === "PENDENTE");
  const novasPendentes: EtapaEstado[] = [];
  if (aindaPendentes.length === 0) {
    const proxima = [...restantes].filter((e) => e.status === "AGUARDANDO").sort((x, y) => x.ordem - y.ordem)[0];
    if (proxima) {
      mudancas.push({ id: proxima.id, status: "PENDENTE" });
      novasPendentes.push({ ...proxima, status: "PENDENTE" });
    }
  }
  return { etapaId: minha.id, mudancas, statusFluxo: "PENDENTE", novasPendentes };
}
