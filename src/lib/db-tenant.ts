import { Prisma, type PrismaClient } from "@prisma/client";
import { prismaAdmin } from "@/lib/prisma";

/** Modelos com coluna empresaId (derivado do DMMF — novos modelos entram automaticamente). */
export const MODELOS_TENANT = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "empresaId"))
    .map((m) => m.name),
);

const OPS_WHERE = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

export class ErroTenant extends Error {}

type Dados = Record<string, unknown>;

/** Adiciona a condição via AND: filtro explícito para outra empresa resulta em vazio. */
function comFiltro(where: Dados | undefined, cond: Dados): Dados {
  const w = { ...where };
  const and = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  w.AND = [...and, cond];
  return w;
}

function forcarEmpresa(model: string, data: unknown, empresaId: string): Dados {
  const d = { ...(data as Dados) };
  if ("empresa" in d) {
    throw new ErroTenant(`${model}: não use a relação 'empresa' em create; empresaId é injetado.`);
  }
  if (d.empresaId !== undefined && d.empresaId !== empresaId) {
    throw new ErroTenant(`${model}: tentativa de gravar em outra empresa.`);
  }
  d.empresaId = empresaId;
  return d;
}

function bloquearTrocaEmpresa(model: string, data: unknown, empresaId: string) {
  const d = (data ?? {}) as Dados;
  if ("empresa" in d || (d.empresaId !== undefined && d.empresaId !== empresaId)) {
    throw new ErroTenant(`${model}: não é permitido alterar empresaId.`);
  }
}

/** Cliente Prisma com isolamento por empresa. */
export function criarDbTenant(empresaId: string, base: PrismaClient = prismaAdmin) {
  if (!empresaId) throw new ErroTenant("empresaId obrigatório");
  return base.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELOS_TENANT.has(model)) {
            if (model === "Empresa" && operation !== "findUnique" && operation !== "findFirst" && operation !== "findUniqueOrThrow" && operation !== "findFirstOrThrow") {
              throw new ErroTenant(`Empresa.${operation} não permitido via getDb(); use prismaAdmin.`);
            }
            if (model === "Empresa") {
              const a = (args ?? {}) as { where?: Dados };
              a.where = comFiltro(a.where, { id: empresaId });
              return query(a);
            }
            return query(args);
          }
          const a = { ...(args as Dados) } as Dados & {
            where?: Dados;
            data?: unknown;
            create?: unknown;
            update?: unknown;
          };

          if (OPS_WHERE.has(operation)) {
            a.where = comFiltro(a.where, { empresaId });
          }
          switch (operation) {
            case "create":
              a.data = forcarEmpresa(model, a.data, empresaId);
              break;
            case "createMany":
            case "createManyAndReturn":
              a.data = Array.isArray(a.data)
                ? a.data.map((d) => forcarEmpresa(model, d, empresaId))
                : forcarEmpresa(model, a.data, empresaId);
              break;
            case "upsert":
              a.create = forcarEmpresa(model, a.create, empresaId);
              bloquearTrocaEmpresa(model, a.update, empresaId);
              break;
            case "update":
            case "updateMany":
            case "updateManyAndReturn":
              bloquearTrocaEmpresa(model, a.data, empresaId);
              break;
          }
          return query(a as typeof args);
        },
      },
    },
  });
}

export type DbTenant = ReturnType<typeof criarDbTenant>;
