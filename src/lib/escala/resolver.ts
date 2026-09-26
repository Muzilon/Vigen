import { PADROES_SISTEMA } from "@/lib/escala/padrao";
import type { ConfigEscala, ConfiguracaoEscalaRegistro } from "@/lib/escala/tipos";

/**
 * Resolve a configuração de escala aplicável: sobrescrita da obra (se existir e `obraId`
 * for informado) → padrão da empresa (obraId nulo) → padrão do sistema (código).
 * Recebe todos os registros da empresa+tipo já carregados (uma query simples no chamador)
 * para manter esta função pura e testável sem banco.
 */
export function resolverConfiguracaoEscala(
  registros: readonly ConfiguracaoEscalaRegistro[],
  tipo: ConfiguracaoEscalaRegistro["tipo"],
  obraId: string | null,
): ConfigEscala {
  const doTipo = registros.filter((r) => r.tipo === tipo);
  const daObra = obraId ? doTipo.find((r) => r.obraId === obraId) : undefined;
  const daEmpresa = doTipo.find((r) => r.obraId === null);
  const registro = daObra ?? daEmpresa;
  if (!registro) return PADROES_SISTEMA[tipo];
  return {
    tamanho: registro.tamanho === 3 ? 3 : 5,
    eixos: registro.eixos as ConfigEscala["eixos"],
    faixas: registro.faixas as ConfigEscala["faixas"],
    criteriosExtras: registro.criteriosExtras as ConfigEscala["criteriosExtras"],
  };
}
