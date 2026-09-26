import type { Gravidade, OrigemRnc, StatusRnc, TipoRnc } from "@prisma/client";
import type { StatusEfetivoItem, StatusGeralPlano } from "@/lib/plano-acao/status";

export const ROTULO_STATUS_RNC: Record<StatusRnc, string> = {
  ABERTO: "Aberto",
  EM_ANALISE: "Em análise",
  PLANO_EM_EXECUCAO: "Plano em execução",
  EM_VERIFICACAO: "Em verificação",
  ENCERRADO: "Encerrado",
  REABERTO: "Reaberto",
  CANCELADO: "Cancelado",
};

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", CRITICA: "Crítica" };

export const ROTULO_TIPO: Record<TipoRnc, string> = { QUALIDADE: "Qualidade", MEIO_AMBIENTE: "Meio ambiente", SSO: "SSO" };

export const ROTULO_ORIGEM: Record<OrigemRnc, string> = {
  AUDITORIA_INTERNA: "Auditoria interna",
  INSPECAO: "Inspeção",
  RECLAMACAO_CLIENTE: "Reclamação de cliente",
  AUTO_IDENTIFICADA: "Auto identificada",
  AUDITORIA_EXTERNA: "Auditoria externa",
};

export const ROTULO_STATUS_ITEM: Record<StatusEfetivoItem, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  ATRASADO: "Atrasado",
};

export const ROTULO_STATUS_PLANO: Record<StatusGeralPlano, string> = {
  SEM_ITENS: "Sem itens",
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  ATRASADO: "Atrasado",
  CONCLUIDO: "Concluído",
};

export const ROTULO_METODO = { CINCO_PORQUES: "5 Porquês", ISHIKAWA: "Ishikawa (6M)", OUTRO: "Texto livre" } as const;

export const SEIS_M = [
  ["metodo", "Método"],
  ["maoDeObra", "Mão de obra"],
  ["material", "Material"],
  ["maquina", "Máquina"],
  ["medida", "Medida"],
  ["meioAmbiente", "Meio ambiente"],
] as const;
