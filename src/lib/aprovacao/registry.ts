/**
 * Registro de handlers por tipo de entidade. Cada módulo (HIRA, LAIA, Documentos...) registra
 * o seu ao ser carregado; o motor chama aoAprovar na MESMA transação da última aprovação.
 */
import type { FluxoAprovacao, TipoEntidadeAprovacao } from "@prisma/client";
import type { Ator, Tx } from "@/lib/ator";

export interface HandlerAprovacao {
  /** Aplica a alteração aprovada (fluxo.payload). Erro aqui desfaz a aprovação inteira. */
  aoAprovar(tx: Tx, fluxo: FluxoAprovacao, ator: Ator): Promise<void>;
  /** Opcional: após uma assinatura que não encerra o fluxo (mesma transação) — ex.: Documentos passa de EM_REVISAO para EM_APROVACAO. */
  aoAvancar?(tx: Tx, fluxo: FluxoAprovacao, ator: Ator): Promise<void>;
  /** Opcional: reação à rejeição (mesma transação). */
  aoRejeitar?(tx: Tx, fluxo: FluxoAprovacao, ator: Ator): Promise<void>;
  /** Opcional: reação ao cancelamento pelo solicitante (mesma transação). */
  aoCancelar?(tx: Tx, fluxo: FluxoAprovacao, ator: Ator): Promise<void>;
  /** Opcional: quem além de solicitante/aprovadores pode ver o fluxo (ex.: gestor do módulo). */
  podeVer?(ator: Ator, fluxo: FluxoAprovacao): boolean | Promise<boolean>;
}

const handlers = new Map<TipoEntidadeAprovacao, HandlerAprovacao>();

export function registrarHandlerAprovacao(tipo: TipoEntidadeAprovacao, h: HandlerAprovacao) {
  handlers.set(tipo, h);
}

export function removerHandlerAprovacao(tipo: TipoEntidadeAprovacao) {
  handlers.delete(tipo);
}

export function obterHandlerAprovacao(tipo: TipoEntidadeAprovacao): HandlerAprovacao | undefined {
  return handlers.get(tipo);
}
