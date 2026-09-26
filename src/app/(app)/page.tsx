import Link from "next/link";
import { atorTem, fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { hojeNoFuso, paraDataDb } from "@/lib/datas";
import { filtroAcessoRnc, filtroRestricaoRnc } from "@/lib/rnc/servico";
import { filtroObras, getContexto } from "@/lib/tenant";

export default async function Inicio() {
  const ctx = await getContexto();
  const a = await getAtor();
  const hoje = paraDataDb(hojeNoFuso(await fusoDaEmpresa(a)));
  const itensVisiveis = { planoAcao: { OR: [{ rnc: { is: null } }, { rnc: { is: filtroAcessoRnc(a) } }] } };
  const gestor = atorTem(a, "PLANO_GERENCIAR");
  const abertos = { status: { in: ["PENDENTE" as const, "EM_ANDAMENTO" as const] } };

  const [rncsAbertas, atrasados, meus] = await Promise.all([
    a.db.rnc.count({
      where: { AND: [filtroObras(ctx), filtroRestricaoRnc(a), { status: { notIn: ["ENCERRADO", "CANCELADO"] } }] },
    }),
    a.db.itemAcao.count({ where: { AND: [itensVisiveis, abertos, { quando: { lt: hoje } }, gestor ? {} : { quemId: a.usuarioId }] } }),
    a.db.itemAcao.count({ where: { AND: [abertos, { quemId: a.usuarioId }] } }),
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
    </div>
  );
}
