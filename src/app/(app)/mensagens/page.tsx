import Link from "next/link";
import { Cabecalho } from "@/components/ui";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { linkThread, listarNaoLidas } from "@/lib/interacoes/servico";

/** Caixa "Mensagens": interações não lidas endereçadas ao usuário. Abrir a thread marca como lida. */
export default async function Mensagens() {
  const a = await getAtor();
  const fuso = await fusoDaEmpresa(a);
  const msgs = await listarNaoLidas(a, 100);
  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Mensagens" subtitulo={`${msgs.length} não lida(s)`} />
      <div className="rounded-lg border border-slate-200 bg-white">
        {msgs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma mensagem nova.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {msgs.map((m) => (
              <li key={m.id}>
                <Link href={linkThread(m)} className="block px-4 py-3 text-sm hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{m.autor.nome}</span>
                    <span className="text-xs text-slate-500">
                      {m.entidadeTipo === "RNC" ? "RNC" : "Item de ação"} · {formatarDataHora(m.criadoEm, fuso)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-slate-700">{m.mensagem}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
