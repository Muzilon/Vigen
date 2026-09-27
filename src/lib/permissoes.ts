import type { PapelUsuario, Permissao } from "@prisma/client";

export const TODAS_PERMISSOES = [
  "RNC_ABRIR",
  "RNC_TRATAR",
  "RNC_VERIFICAR_EFICACIA",
  "RNC_SOLICITAR_CANCELAMENTO",
  "RNC_APROVAR_CANCELAMENTO",
  "RNC_VER_RESTRITAS",
  "PLANO_GERENCIAR",
  "PROCESSO_GERENCIAR",
  "RISCO_GERENCIAR",
  "RISCO_TRATAR",
  "SWOT_GERENCIAR",
  "HIRA_GERENCIAR",
  "LAIA_GERENCIAR",
  "DOCUMENTO_ELABORAR",
  "DOCUMENTO_GERENCIAR",
  "INSPECAO_GERENCIAR",
  "INSPECAO_REALIZAR",
  "AUDITORIA_GERENCIAR",
  "AUDITORIA_REALIZAR",
  "REQUISITO_LEGAL_GERENCIAR",
  "INCIDENTE_GERENCIAR",
  "INCIDENTE_VER_RESTRITOS",
  "INDICADOR_GERENCIAR",
  "TREINAMENTO_GERENCIAR",
  "ADMIN_CONFIG",
  "VER_TODAS_OBRAS",
] as const satisfies readonly Permissao[];

export const PERMISSOES_POR_PAPEL: Record<PapelUsuario, readonly Permissao[]> = {
  ADMIN: TODAS_PERMISSOES,
  GESTOR_SGI: [
    "RNC_ABRIR",
    "RNC_TRATAR",
    "RNC_VERIFICAR_EFICACIA",
    "RNC_SOLICITAR_CANCELAMENTO",
    "PLANO_GERENCIAR",
    "VER_TODAS_OBRAS",
    "RNC_VER_RESTRITAS",
  ],
  INSPETOR: ["RNC_ABRIR", "RNC_TRATAR", "RNC_SOLICITAR_CANCELAMENTO", "INSPECAO_REALIZAR"],
  COLABORADOR: ["RNC_ABRIR"],
};

/** ADMIN = todas; demais = padrão do papel ∪ permissões do perfil. */
export function permissoesEfetivas(
  papel: PapelUsuario,
  perfilPermissoes: readonly Permissao[] = [],
): Permissao[] {
  if (papel === "ADMIN") return [...TODAS_PERMISSOES];
  return [...new Set([...PERMISSOES_POR_PAPEL[papel], ...perfilPermissoes])];
}
