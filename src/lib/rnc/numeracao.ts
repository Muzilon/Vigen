import type { TipoSequencia } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

/** PREFIXO-001-26 (INSP, AUD...). */
export function formatarCodigoAnual(prefixo: string, sequencia: number, ano: number): string {
  if (!Number.isInteger(sequencia) || sequencia < 1) throw new ErroNegocio("Sequência inválida");
  return `${prefixo}-${String(sequencia).padStart(3, "0")}-${String(ano % 100).padStart(2, "0")}`;
}

/** RNC-001-26 */
export function formatarCodigoRnc(sequencia: number, ano: number): string {
  if (!Number.isInteger(sequencia) || sequencia < 1) throw new ErroNegocio("Sequência inválida");
  return `RNC-${String(sequencia).padStart(3, "0")}-${String(ano % 100).padStart(2, "0")}`;
}

interface ExecutorRaw {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>;
}

/**
 * Próximo valor de um ContadorSequencial (atômico: INSERT ... ON CONFLICT DO UPDATE ... RETURNING).
 * `subtipo` subdivide o contador (ex.: DOCUMENTO por tipo de documento); "" = sem subdivisão.
 * SQL cru não passa pela extension de tenant — empresaId é passado explicitamente.
 * Chamar dentro de $transaction: o lock de linha é mantido até o commit.
 */
export async function proximaSequencia(tx: ExecutorRaw, empresaId: string, tipo: TipoSequencia, ano: number, subtipo = ""): Promise<number> {
  const linhas = await tx.$queryRaw<{ ultimo_valor: number }[]>`
    INSERT INTO contador_sequencial (empresa_id, tipo, ano, subtipo, ultimo_valor)
    VALUES (${empresaId}::uuid, ${tipo}::"TipoSequencia", ${ano}, ${subtipo}, 1)
    ON CONFLICT (empresa_id, tipo, ano, subtipo)
    DO UPDATE SET ultimo_valor = contador_sequencial.ultimo_valor + 1
    RETURNING ultimo_valor`;
  const v = linhas[0]?.ultimo_valor;
  if (!v) throw new Error(`Falha ao gerar numeração (${tipo})`);
  return Number(v);
}

export function proximaSequenciaRnc(tx: ExecutorRaw, empresaId: string, ano: number): Promise<number> {
  return proximaSequencia(tx, empresaId, "RNC", ano);
}
