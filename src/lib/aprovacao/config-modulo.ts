/**
 * Configuração do fluxo de aprovação por módulo de planilha (HIRA/LAIA — decisão 5 do dono,
 * docs/06-desenho-modulos.md). Fica em Empresa.config.aprovacao.<modulo>:
 *   { exigir: boolean, aprovadorIds: string[], modo: "SEQUENCIAL" | "PARALELO" }
 * Se `exigir` for false, inclusão/alteração/exclusão são aplicadas direto (com histórico).
 *
 * PONTO DE EXTENSÃO (P4 — Tramitação de Documentos): `canalAprovacao()` decide por onde a
 * aprovação passa. Hoje sempre "MOTOR" (motor de aprovação multi-assinante). Quando o módulo
 * DOCUMENTOS for entregue e estiver ativo na empresa, ele passa a devolver "TRAMITACAO" e os
 * serviços de HIRA/LAIA encaminham a solicitação para a tramitação de documentos (a planilha
 * vira um documento controlado com versão), mantendo o mesmo payload { antes, depois, dados }.
 */
import type { Modulo, ModoAprovacao, Prisma } from "@prisma/client";
import { z } from "zod";
import { atorTem, type Ator, type Tx } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";

export type ModuloAprovavel = "hira" | "laia";

export interface ConfigAprovacaoModulo {
  exigir: boolean;
  aprovadorIds: string[];
  modo: ModoAprovacao;
}

export const CONFIG_APROVACAO_PADRAO: ConfigAprovacaoModulo = { exigir: false, aprovadorIds: [], modo: "SEQUENCIAL" };

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const esquema = z.object({
  exigir: z.boolean().catch(false),
  aprovadorIds: z.array(z.string()).catch([]),
  modo: z.enum(["SEQUENCIAL", "PARALELO"]).catch("SEQUENCIAL"),
});

/** Lê a configuração do módulo a partir de Empresa.config (tolerante a JSON incompleto). */
export function lerConfigAprovacao(config: unknown, modulo: ModuloAprovavel): ConfigAprovacaoModulo {
  const bruto = objeto(objeto(config).aprovacao)[modulo];
  if (!bruto) return { ...CONFIG_APROVACAO_PADRAO };
  const r = esquema.safeParse({ ...CONFIG_APROVACAO_PADRAO, ...objeto(bruto) });
  return r.success ? r.data : { ...CONFIG_APROVACAO_PADRAO };
}

/** Novo Empresa.config com a configuração do módulo substituída (demais chaves preservadas). */
export function mesclarConfigAprovacao(config: unknown, modulo: ModuloAprovavel, c: ConfigAprovacaoModulo) {
  const base = objeto(config);
  return { ...base, aprovacao: { ...objeto(base.aprovacao), [modulo]: { exigir: c.exigir, aprovadorIds: c.aprovadorIds, modo: c.modo } } };
}

type DbEmpresa = Pick<Ator["db"], "empresa"> | Tx;

export async function obterConfigAprovacao(db: DbEmpresa, empresaId: string, modulo: ModuloAprovavel) {
  const e = await db.empresa.findFirst({ where: { id: empresaId }, select: { config: true } });
  return lerConfigAprovacao(e?.config, modulo);
}

/** Salva a configuração (ADMIN_CONFIG). Aprovadores precisam ser usuários ativos da empresa. */
export async function salvarConfigAprovacao(a: Ator, modulo: ModuloAprovavel, c: ConfigAprovacaoModulo) {
  if (!atorTem(a, "ADMIN_CONFIG")) throw new ErroNegocio("Sem permissão para alterar configurações.");
  const ids = [...new Set(c.aprovadorIds)];
  if (ids.length > 10) throw new ErroNegocio("No máximo 10 aprovadores padrão.");
  if (c.exigir && ids.length === 0) throw new ErroNegocio("Para exigir aprovação, escolha ao menos um aprovador padrão.");
  await a.db.$transaction(async (tx) => {
    if ((await tx.usuario.count({ where: { id: { in: ids }, ativo: true } })) !== ids.length) throw new ErroNegocio("Aprovador inválido ou inativo.");
    const e = await tx.empresa.findFirstOrThrow({ where: { id: a.empresaId }, select: { config: true } });
    await tx.empresa.updateMany({
      where: { id: a.empresaId },
      data: { config: mesclarConfigAprovacao(e.config, modulo, { ...c, aprovadorIds: ids }) as Prisma.InputJsonValue },
    });
  });
}

/**
 * Aprovadores efetivos de uma solicitação: os padrões da configuração sem o próprio solicitante
 * (ninguém aprova o próprio pedido). Lista vazia → erro orientando a configurar.
 */
export function aprovadoresEfetivos(c: ConfigAprovacaoModulo, solicitanteId: string): string[] {
  const ids = c.aprovadorIds.filter((id) => id !== solicitanteId);
  if (ids.length === 0) {
    throw new ErroNegocio("A empresa exige aprovação, mas não há aprovador padrão disponível além de você. Peça ao administrador para configurar os aprovadores em Configurações → Aprovações.");
  }
  return ids;
}

/** Canal da aprovação — ver PONTO DE EXTENSÃO no topo do arquivo. */
export function canalAprovacao(modulosAtivos: readonly Modulo[]): "MOTOR" | "TRAMITACAO" {
  void modulosAtivos;
  // P4: return modulosAtivos.includes("DOCUMENTOS") && tramitacaoDisponivel() ? "TRAMITACAO" : "MOTOR";
  return "MOTOR";
}
