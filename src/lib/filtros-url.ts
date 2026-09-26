import { z } from "zod";

const um = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/** Campo de filtro de URL: valor ausente ou inválido vira "" (ignorado) em vez de erro 500 (B1). */
function filtroUrl<T extends string>(schema: z.ZodType<T>) {
  return z
    .preprocess(um, schema.optional())
    .catch(undefined)
    .transform((v): T | "" => v ?? "");
}

export const uuidUrl = filtroUrl(z.uuid());
export const textoUrl = filtroUrl(z.string().trim().max(100));
export function enumUrl<const T extends readonly [string, ...string[]]>(valores: T) {
  return filtroUrl<T[number]>(z.enum(valores) as unknown as z.ZodType<T[number]>);
}
