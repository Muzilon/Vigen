import { ErroNegocio } from "@/lib/erros";

/** RNC-001-26 */
export function formatarCodigoRnc(sequencia: number, ano: number): string {
  if (!Number.isInteger(sequencia) || sequencia < 1) throw new ErroNegocio("Sequência inválida");
  return `RNC-${String(sequencia).padStart(3, "0")}-${String(ano % 100).padStart(2, "0")}`;
}

interface ExecutorRaw {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<T>;
}

/**
 * Próximo valor do contador (atômico: INSERT ... ON CONFLICT DO UPDATE ... RETURNING).
 * SQL cru não passa pela extension de tenant — empresaId é passado explicitamente.
 * Chamar dentro de $transaction: o lock de linha é mantido até o commit.
 */
export async function proximaSequenciaRnc(tx: ExecutorRaw, empresaId: string, ano: number): Promise<number> {
  const linhas = await tx.$queryRaw<{ ultimo_valor: number }[]>`
    INSERT INTO contador_sequencial (empresa_id, tipo, ano, ultimo_valor)
    VALUES (${empresaId}::uuid, 'RNC'::"TipoSequencia", ${ano}, 1)
    ON CONFLICT (empresa_id, tipo, ano)
    DO UPDATE SET ultimo_valor = contador_sequencial.ultimo_valor + 1
    RETURNING ultimo_valor`;
  const v = linhas[0]?.ultimo_valor;
  if (!v) throw new Error("Falha ao gerar numeração da RNC");
  return Number(v);
}
