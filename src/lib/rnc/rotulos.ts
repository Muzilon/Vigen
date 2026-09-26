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

export const COR_STATUS_RNC: Record<StatusRnc, string> = {
  ABERTO: "bg-sky-50 text-sky-700 ring-sky-600/20",
  EM_ANALISE: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  PLANO_EM_EXECUCAO: "bg-amber-50 text-amber-800 ring-amber-600/20",
  EM_VERIFICACAO: "bg-violet-50 text-violet-700 ring-violet-600/20",
  ENCERRADO: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REABERTO: "bg-orange-50 text-orange-700 ring-orange-600/20",
  CANCELADO: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", CRITICA: "Crítica" };
export const COR_GRAVIDADE: Record<Gravidade, string> = {
  BAIXA: "bg-slate-50 text-slate-700 ring-slate-500/20",
  MEDIA: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
  ALTA: "bg-orange-50 text-orange-700 ring-orange-600/20",
  CRITICA: "bg-red-50 text-red-700 ring-red-600/20",
};

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
export const COR_STATUS_ITEM: Record<StatusEfetivoItem, string> = {
  PENDENTE: "bg-slate-50 text-slate-700 ring-slate-500/20",
  EM_ANDAMENTO: "bg-sky-50 text-sky-700 ring-sky-600/20",
  CONCLUIDO: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELADO: "bg-slate-100 text-slate-500 ring-slate-500/20",
  ATRASADO: "bg-red-50 text-red-700 ring-red-600/20",
};

export const ROTULO_STATUS_PLANO: Record<StatusGeralPlano, string> = {
  SEM_ITENS: "Sem itens",
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  ATRASADO: "Atrasado",
  CONCLUIDO: "Concluído",
};
export const COR_STATUS_PLANO: Record<StatusGeralPlano, string> = {
  SEM_ITENS: "bg-slate-50 text-slate-500 ring-slate-500/20",
  PENDENTE: COR_STATUS_ITEM.PENDENTE,
  EM_ANDAMENTO: COR_STATUS_ITEM.EM_ANDAMENTO,
  ATRASADO: COR_STATUS_ITEM.ATRASADO,
  CONCLUIDO: COR_STATUS_ITEM.CONCLUIDO,
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
