import { cronAutorizado, naoAutorizado } from "@/lib/cron/auth";
import { executarCronDiario } from "@/lib/notificacoes/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron diário (vercel.json): alertas de prazo/atraso por empresa e limpeza de tentativa_login. */
export async function GET(req: Request) {
  if (!cronAutorizado(req)) return naoAutorizado();
  const r = await executarCronDiario();
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
