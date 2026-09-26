import type { Prisma } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { prismaAdmin } from "@/lib/prisma";
import { lerPreferencias, MAX_DIAS_ALERTA, mesclarConfig, type PreferenciasNotificacao } from "./preferencias";

/** Lê as preferências da empresa (chamador já autenticado e com empresaId do contexto). */
export async function obterPreferencias(empresaId: string) {
  const e = await prismaAdmin.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { config: true, diasAlertaPrazo: true } });
  return lerPreferencias(e);
}

/**
 * Salva as preferências. Empresa não é gravável via getDb() (DbTenant bloqueia), por isso usa
 * prismaAdmin restrito ao id da empresa do contexto. Exigir ADMIN_CONFIG no chamador.
 */
export async function salvarPreferencias(empresaId: string, p: PreferenciasNotificacao) {
  if (!Number.isInteger(p.diasAlertaPrazo) || p.diasAlertaPrazo < 0 || p.diasAlertaPrazo > MAX_DIAS_ALERTA) {
    throw new ErroNegocio(`Antecedência deve estar entre 0 e ${MAX_DIAS_ALERTA} dias.`);
  }
  await prismaAdmin.$transaction(async (tx) => {
    const e = await tx.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { config: true } });
    await tx.empresa.update({
      where: { id: empresaId },
      data: { diasAlertaPrazo: p.diasAlertaPrazo, config: mesclarConfig(e.config, p) as Prisma.InputJsonValue },
    });
  });
}
