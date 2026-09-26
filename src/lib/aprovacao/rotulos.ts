/**
 * Rótulos de exibição do motor de aprovação (sem dependência de runtime do Prisma — pode ser
 * importado por componentes client).
 */
import type {
  ModoAprovacao,
  StatusEtapaAprovacao,
  StatusFluxoAprovacao,
  TipoAlteracaoAprovacao,
  TipoEntidadeAprovacao,
} from "@prisma/client";

export const ROTULO_ENTIDADE_APROVACAO: Record<TipoEntidadeAprovacao, string> = {
  PROCESSO: "Processo",
  HIRA: "HIRA",
  LAIA: "LAIA",
  DOCUMENTO: "Documento",
  RISCO_OPORTUNIDADE: "Risco/oportunidade",
  TESTE: "Teste",
};

export const ROTULO_TIPO_ALTERACAO: Record<TipoAlteracaoAprovacao, string> = {
  INCLUSAO: "Inclusão",
  ALTERACAO: "Alteração",
  EXCLUSAO: "Exclusão",
  PUBLICACAO: "Publicação",
};

export const ROTULO_MODO_APROVACAO: Record<ModoAprovacao, string> = {
  SEQUENCIAL: "Sequencial",
  PARALELO: "Paralelo",
};

export const ROTULO_STATUS_FLUXO: Record<StatusFluxoAprovacao, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  CANCELADO: "Cancelado",
};

export const ROTULO_STATUS_ETAPA: Record<StatusEtapaAprovacao, string> = {
  AGUARDANDO: "Aguardando vez",
  PENDENTE: "Aguardando assinatura",
  APROVADA: "Aprovou",
  REJEITADA: "Rejeitou",
  IGNORADA: "Não decidiu",
};

export const STATUS_FLUXO: StatusFluxoAprovacao[] = ["PENDENTE", "APROVADO", "REJEITADO", "CANCELADO"];
