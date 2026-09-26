import type { TipoNotificacao } from "@prisma/client";
import { Cabecalho, cls } from "@/components/ui";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { listarNotificacoes } from "@/lib/notificacoes/servico";
import { abrirNotificacaoAcao, marcarLidaAcao, marcarTodasAcao } from "./actions";

const ROTULO: Record<TipoNotificacao, string> = {
  RNC_ATRIBUIDA: "RNC atribuída",
  ITEM_ATRIBUIDO: "Ação atribuída",
  INTERACAO_NOVA: "Mensagem",
  CANCELAMENTO_SOLICITADO: "Cancelamento",
  CANCELAMENTO_DECIDIDO: "Cancelamento",
  RNC_EM_VERIFICACAO: "Verificação",
  ITEM_PRAZO_PROXIMO: "Prazo",
  ITEM_ATRASADO: "Atraso",
  RESUMO_SEMANAL: "Resumo semanal",
};

export default async function Notificacoes({ searchParams }: PageProps<"/notificacoes">) {
  const sp = await searchParams;
  const somenteNaoLidas = sp.filtro === "nao-lidas";
  const a = await getAtor();
  const [fuso, lista] = await Promise.all([fusoDaEmpresa(a), listarNotificacoes(a, { somenteNaoLidas, take: 100 })]);
  const naoLidas = lista.filter((n) => !n.lidaEm).length;
  const aba = (ativo: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${ativo ? "bg-emerald-50 font-medium text-emerald-800" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <div className="max-w-3xl">
      <Cabecalho
        titulo="Notificações"
        subtitulo={somenteNaoLidas ? `${lista.length} não lida(s)` : "Últimas 100 notificações"}
        acoes={
          naoLidas > 0 ? (
            <form action={marcarTodasAcao}>
              <button type="submit" className={cls.btnSec}>Marcar todas como lidas</button>
            </form>
          ) : null
        }
      />
      <div className="mb-3 flex gap-2">
        <a href="/notificacoes" className={aba(!somenteNaoLidas)}>Todas</a>
        <a href="/notificacoes?filtro=nao-lidas" className={aba(somenteNaoLidas)}>Não lidas</a>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        {lista.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma notificação.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.lidaEm ? "" : "bg-emerald-50/40"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lidaEm ? "bg-transparent" : "bg-emerald-600"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 text-slate-700">{ROTULO[n.tipo]}</span>
                    <span>{formatarDataHora(n.criadoEm, fuso)}</span>
                    {!n.lidaEm && <span className="sr-only">não lida</span>}
                  </div>
                  <form action={abrirNotificacaoAcao}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className={`mt-1 text-left text-sm ${n.lidaEm ? "text-slate-700" : "font-medium text-slate-900"} hover:underline`}>
                      {n.titulo}
                    </button>
                  </form>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{n.corpo}</p>
                </div>
                {!n.lidaEm && (
                  <form action={marcarLidaAcao}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="whitespace-nowrap text-xs text-slate-500 hover:text-emerald-800">Marcar como lida</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
