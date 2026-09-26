import { z } from "zod";
import type { MetodoCausaRaiz } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { SEIS_M } from "@/lib/rnc/rotulos";

export const MAX_TEXTO_ANALISE = 2000;
export const MAX_TEXTO_LIVRE = 10000;
export const MAX_CAUSA_RAIZ = 5000;

const texto = (max: number) => z.string().max(max, `Texto da análise excede ${max} caracteres.`);

const chavesSeisM = SEIS_M.map(([k]) => k) as [string, ...string[]];

/** Estrutura aceita de analiseCausa por método (B5): chaves conhecidas e tamanhos limitados. */
export const esquemasAnalise = {
  CINCO_PORQUES: z.object({ porques: z.array(texto(MAX_TEXTO_ANALISE)).max(10, "No máximo 10 porquês.") }).strict(),
  ISHIKAWA: z
    .object({ ishikawa: z.partialRecord(z.enum(chavesSeisM), texto(MAX_TEXTO_ANALISE)) })
    .strict(),
  OUTRO: z.object({ texto: texto(MAX_TEXTO_LIVRE) }).strict(),
} satisfies Record<MetodoCausaRaiz, z.ZodType>;

export function validarAnalise(metodo: MetodoCausaRaiz, analise: unknown) {
  const r = esquemasAnalise[metodo].safeParse(analise);
  if (!r.success) throw new ErroNegocio(r.error.issues[0]?.message ?? "Análise inválida.");
  return r.data;
}
