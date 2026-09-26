import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ResultadoAcao } from "@/components/form-acao";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/tenant";

/** Utilitários compartilhados pelas server actions (RNC e plano de ação). */

export async function executar(fn: () => Promise<ResultadoAcao | void>, caminhos: string[] = []): Promise<ResultadoAcao> {
  try {
    const r = await fn();
    for (const c of caminhos) revalidatePath(c);
    revalidatePath("/plano-acao");
    revalidatePath("/plano-acao/[id]", "page");
    revalidatePath("/plano-acao/planos/[id]", "page");
    revalidatePath("/");
    return r ?? { ok: "Salvo." };
  } catch (e) {
    if (e instanceof ErroNegocio || e instanceof ErroPermissao) return { erro: e.message };
    // B2: violação de unicidade por concorrência (ex.: duas verificações simultâneas).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { erro: new ErroConflito().message };
    if (e instanceof z.ZodError) return { erro: e.issues.map((i) => i.message).join(" ") };
    throw e;
  }
}

export const opcional = z
  .string()
  .trim()
  .transform((s) => s || null)
  .nullish();
export const uuid = z.uuid("Seleção inválida.");
export const uuidOpcional = z
  .string()
  .transform((s) => s || null)
  .pipe(z.uuid().nullable())
  .nullish();
export const versao = z.coerce.number().int().optional();
export const obj = (fd: FormData) => Object.fromEntries(fd.entries());

export const esquemaItem = z.object({
  oQue: z.string().trim().min(2, "Informe o que será feito."),
  porQue: opcional,
  onde: opcional,
  quemId: uuid,
  quando: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o prazo."),
  como: opcional,
  quanto: z
    .union([z.number(), z.string()])
    .transform((v) => (v === "" || v === null ? null : Number(v)))
    .pipe(z.number().nonnegative("Custo inválido.").nullable())
    .nullish(),
});

/** Campo `itens` (JSON das linhas 5W2H) validado com esquemaItem. */
export const itensJson = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Itens inválidos." });
      return z.NEVER;
    }
  })
  .pipe(z.array(esquemaItem).min(1, "Adicione ao menos um item."));

/** Campos de texto do formulário (sem arquivos/senhas) para repovoar o form após erro. */
export function valoresDoForm(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}
