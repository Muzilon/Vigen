import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Cliente SEM isolamento de tenant. Use apenas em seed, cron, e no fluxo de
 * autenticação (antes de existir contexto). Em código de aplicação use getDb().
 */
export const prismaAdmin = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaAdmin;
