import { createHash, timingSafeEqual } from "node:crypto";

/** Confere "Authorization: Bearer <CRON_SECRET>" (comparação em tempo constante). */
export function cronAutorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = req.headers.get("authorization") ?? "";
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(recebido), h(`Bearer ${segredo}`));
}

export function naoAutorizado() {
  return new Response("Não autorizado", { status: 401, headers: { "Cache-Control": "no-store" } });
}
