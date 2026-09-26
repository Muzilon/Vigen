import Link from "next/link";
import { atorTem, fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { linkThread, listarNaoLidas } from "@/lib/interacoes/servico";
import { filtroAcessoItem, filtroAcessoRnc } from "@/lib/rnc/servico";
import { getContexto } from "@/lib/tenant";

export default async function Inicio() {
  const ctx = await getContexto();
  const a = await getAtor();
  const fuso = await fusoDaEmpresa(a);
  const hoje = paraDataDb(hojeNoFuso(fuso));
  const gestor = atorTem(a, "PLANO_GERENCIAR");
  const abertos = { status: { in: ["PENDENTE" as const, "EM_ANDAMENTO" as const] } };

  const [rncsAbertas, atrasados, meus, mensagens] = await Promise.all([
    // B7: mesma regra de acesso do detalhe e da lista.
    a.db.rnc.count({ where: { AND: [filtroAcessoRnc(a), { status: { notIn: ["ENCERRADO", "CANCELADO"] } }] } }),
    a.db.itemAcao.count({ where: { AND: [gestor ? filtroAcessoItem(a) : { quemId: a.usuarioId }, abertos, { quando: { lt: hoje } }] } }),
    a.db.itemAcao.count({ where: { AND: [abertos, { quemId: a.usuarioId }] } }),
    listarNaoLidas(a, 5),
  ]);

  const cards = [
    { rotulo: "RNCs abertas", valor: rncsAbertas, href: "/rncs", cor: "text-sky-700" },
    { rotulo: "Itens atrasados", valor: atrasados, href: `/plano-acao?escopo=${gestor ? "todos" : "meus"}&status=ATRASADO`, cor: "text-red-700" },
    { rotulo: "Meus itens pendentes", valor: meus, href: "/plano-acao", cor: "text-amber-700" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Olá, {ctx.usuario.nome}</h1>
      <p className="mt-1 text-slate-600">{ctx.usuario.empresaNome}</p>
      <div className="mt-6 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.rotulo} href={c.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300">
            <p className="text-sm font-medium text-slate-600">{c.rotulo}</p>
            <p className={`mt-2 text-3xl font-semibold ${c.valor > 0 ? c.cor : "text-slate-400"}`}>{c.valor}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 max-w-4xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Mensagens não lidas</h2>
          <Link href="/mensagens" className="text-sm text-emerald-700 hover:underline">Ver todas</Link>
        </div>
        {mensagens.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nenhuma mensagem nova.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {mensagens.map((m) => (
              <li key={m.id} className="py-2 text-sm">
                <Link href={linkThread(m)} className="block hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{m.autor.nome}</span>
                  <span className="ml-2 text-xs text-slate-500">{formatarDataHora(m.criadoEm, fuso)}</span>
                  <p className="line-clamp-1 text-slate-700">{m.mensagem}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
