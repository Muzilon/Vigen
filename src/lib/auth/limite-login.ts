import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

/** Regras de rate limit do login. */
export const LIMITE_LOGIN = {
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 15 * 60 * 1000,
  falhasPorEmail: 5,
  falhasPorIp: 20,
} as const;

/**
 * Bloqueado se as `limite` falhas mais recentes (ordem desc) ocorreram dentro da janela
 * e a mais recente foi há menos de `bloqueioMs`.
 */
export function estaBloqueado(
  falhasDesc: readonly Date[],
  agora: Date,
  limite: number,
  janelaMs: number = LIMITE_LOGIN.janelaMs,
  bloqueioMs: number = LIMITE_LOGIN.bloqueioMs,
) {
  if (falhasDesc.length < limite) return false;
  const ultima = falhasDesc[0];
  const nEsima = falhasDesc[limite - 1];
  return +ultima - +nEsima <= janelaMs && +agora - +ultima < bloqueioMs;
}

type Db = Pick<PrismaClient, "tentativaLogin" | "usuario">;

async function falhasRecentes(db: Db, where: { email: string } | { ip: string }, limite: number, agora: Date) {
  const desde = new Date(+agora - LIMITE_LOGIN.janelaMs - LIMITE_LOGIN.bloqueioMs);
  let corte = desde;
  if ("email" in where) {
    // Sucesso zera a contagem do e-mail.
    const ok = await db.tentativaLogin.findFirst({
      where: { email: where.email, sucesso: true, criadoEm: { gte: desde } },
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true },
    });
    if (ok) corte = ok.criadoEm;
  }
  const falhas = await db.tentativaLogin.findMany({
    where: { ...where, sucesso: false, bloqueada: false, criadoEm: { gt: corte } },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: { criadoEm: true },
  });
  return falhas.map((f) => f.criadoEm);
}

export async function loginBloqueado(db: Db, email: string, ip: string, agora = new Date()) {
  const [porEmail, porIp] = await Promise.all([
    falhasRecentes(db, { email }, LIMITE_LOGIN.falhasPorEmail, agora),
    falhasRecentes(db, { ip }, LIMITE_LOGIN.falhasPorIp, agora),
  ]);
  return estaBloqueado(porEmail, agora, LIMITE_LOGIN.falhasPorEmail) || estaBloqueado(porIp, agora, LIMITE_LOGIN.falhasPorIp);
}

// Hash fixo para igualar tempo de resposta quando o e-mail não existe.
const HASH_DUMMY = bcrypt.hashSync("vigen-dummy", 10);

export type ResultadoLogin = { ok: true; usuarioId: string } | { ok: false; motivo: "credenciais" | "bloqueado" };

/** Autentica com rate limit (e-mail + IP), registrando todas as tentativas. */
export async function autenticar(db: Db, email: string, senha: string, ip: string): Promise<ResultadoLogin> {
  email = email.trim().toLowerCase();
  ip = ip.slice(0, 100) || "desconhecido";
  if (await loginBloqueado(db, email, ip)) {
    await db.tentativaLogin.create({ data: { email, ip, sucesso: false, bloqueada: true } });
    return { ok: false, motivo: "bloqueado" };
  }
  const u = await db.usuario.findUnique({
    where: { email },
    select: { id: true, senhaHash: true, ativo: true, empresa: { select: { ativo: true } } },
  });
  const senhaOk = await bcrypt.compare(senha, u?.senhaHash ?? HASH_DUMMY);
  const ok = !!u && senhaOk && u.ativo && u.empresa.ativo;
  await db.tentativaLogin.create({ data: { email, ip, sucesso: ok } });
  if (!ok) return { ok: false, motivo: "credenciais" };
  await db.usuario.update({ where: { id: u.id }, data: { ultimoLogin: new Date() } });
  return { ok: true, usuarioId: u.id };
}

/** IP do cliente a partir dos cabeçalhos do proxy reverso. */
export function ipDaRequisicao(req: Request | undefined) {
  const h = req?.headers;
  return h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip")?.trim() || "desconhecido";
}
