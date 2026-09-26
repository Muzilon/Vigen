/**
 * Filtro de escopo por obra para modelos com `obraId` obrigatório (RNC, HIRA, LAIA). Puro (sem
 * Next/Auth) para ser usado pelos serviços, scripts e testes; `src/lib/tenant.ts` o reexporta.
 * `obrasPermitidas` null = todas as obras da empresa.
 */
export function filtroObras(a: { obrasPermitidas: readonly string[] | null }): { obraId?: { in: string[] } } {
  return a.obrasPermitidas === null ? {} : { obraId: { in: [...a.obrasPermitidas] } };
}

/** true se o ator enxerga a obra. */
export function obraNoEscopo(a: { obrasPermitidas: readonly string[] | null }, obraId: string) {
  return a.obrasPermitidas === null || a.obrasPermitidas.includes(obraId);
}
