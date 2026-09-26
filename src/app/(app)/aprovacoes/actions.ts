"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelar, decidir } from "@/lib/aprovacao";
import "@/lib/aprovacao/handler-teste";
import { getAtor } from "@/lib/ator-servidor";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/tenant";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";

const MSG_CONFLITO = "Alguém decidiu este fluxo antes de você. Recarregue a página para ver a situação atual.";

async function executarAprovacao(fn: () => Promise<string>): Promise<ResultadoAcao> {
  try {
    const ok = await fn();
    revalidatePath("/", "layout"); // contador do menu + listas + páginas dos módulos
    return { ok };
  } catch (e) {
    if (e instanceof ErroConflito) return { erro: MSG_CONFLITO };
    if (e instanceof ErroNegocio || e instanceof ErroPermissao) return { erro: e.message };
    if (e instanceof z.ZodError) return { erro: e.issues.map((i) => i.message).join(" ") };
    throw e;
  }
}

const esquemaDecisao = z.object({
  id: z.uuid("Fluxo inválido."),
  decisao: z.enum(["APROVAR", "REJEITAR"], "Escolha aprovar ou rejeitar."),
  comentario: z.string().optional(),
  versao: z.coerce.number().int().optional(),
});

export async function decidirAcao(_prev: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  return executarAprovacao(async () => {
    const d = esquemaDecisao.parse(Object.fromEntries(fd.entries()));
    const r = await decidir(await getAtor(), d.id, { decisao: d.decisao, comentario: d.comentario, versao: d.versao });
    if (d.decisao === "REJEITAR") return "Rejeição registrada.";
    return r.status === "APROVADO" ? "Aprovação registrada. Fluxo concluído e alteração aplicada." : "Aprovação registrada.";
  });
}

const esquemaCancelar = z.object({
  id: z.uuid("Fluxo inválido."),
  motivo: z.string().optional(),
  versao: z.coerce.number().int().optional(),
});

export async function cancelarAcao(_prev: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  return executarAprovacao(async () => {
    const d = esquemaCancelar.parse(Object.fromEntries(fd.entries()));
    await cancelar(await getAtor(), d.id, d.motivo, d.versao);
    return "Solicitação cancelada.";
  });
}
