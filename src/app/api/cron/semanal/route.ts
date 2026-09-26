import { cronAutorizado, naoAutorizado } from "@/lib/cron/auth";
import { executarCronSemanal } from "@/lib/notificacoes/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron semanal (segunda 8h BRT): resumo para gestores. */
export async function GET(req: Request) {
  if (!cronAutorizado(req)) return naoAutorizado();
  const r = await executarCronSemanal();
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
