"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ResultadoAcao } from "@/components/form-acao";
import { ErroNegocio } from "@/lib/erros";
import { MAX_DIAS_ALERTA } from "@/lib/notificacoes/preferencias";
import { salvarPreferencias } from "@/lib/notificacoes/preferencias-servico";
import { ErroPermissao, exigirPermissao } from "@/lib/tenant";

const esquema = z.object({
  diasAlertaPrazo: z.coerce
    .number("Informe a antecedência.")
    .int("Use um número inteiro.")
    .min(0, "Mínimo 0 dias.")
    .max(MAX_DIAS_ALERTA, `Máximo ${MAX_DIAS_ALERTA} dias.`),
  resumoSemanal: z.literal("on").optional(),
  email: z.literal("on").optional(),
});

export async function salvarPreferenciasAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  try {
    const ctx = await exigirPermissao("ADMIN_CONFIG");
    const d = esquema.safeParse(Object.fromEntries(fd.entries()));
    if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
    await salvarPreferencias(ctx.empresaId, {
      diasAlertaPrazo: d.data.diasAlertaPrazo,
      resumoSemanal: !!d.data.resumoSemanal,
      email: !!d.data.email,
    });
    revalidatePath("/configuracoes");
    return { ok: "Preferências salvas." };
  } catch (e) {
    if (e instanceof ErroNegocio || e instanceof ErroPermissao) return { erro: e.message };
    throw e;
  }
}
