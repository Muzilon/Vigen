import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ItemAcoes } from "@/components/item-acoes";
import { Badge, Cabecalho, cls } from "@/components/ui";
import { atorTem, fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, hojeNoFuso, paraDataDb, somarDias } from "@/lib/datas";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { cicloAtual } from "@/lib/rnc/estados";
import { COR_STATUS_ITEM, ROTULO_STATUS_ITEM } from "@/lib/rnc/rotulos";
import { filtroAcessoRnc, podeGerenciarPlanoRnc } from "@/lib/rnc/servico";

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function PlanoAcao({ searchParams }: PageProps<"/plano-acao">) {
  const sp = await searchParams;
  const a = await getAtor();
  const podeTodos = atorTem(a, "PLANO_GERENCIAR");
  const f = {
    escopo: podeTodos && um(sp.escopo) === "todos" ? "todos" : "meus",
    status: um(sp.status),
    responsavel: um(sp.responsavel),
    prazo: um(sp.prazo),
  };
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const hojeDb = paraDataDb(hoje);
  const em7 = paraDataDb(somarDias(hoje, 7));
  const abertos: Prisma.ItemAcaoWhereInput = { status: { in: ["PENDENTE", "EM_ANDAMENTO"] } };

  const where: Prisma.ItemAcaoWhereInput = {
    AND: [
      f.escopo === "meus" ? { quemId: a.usuarioId } : {},
      // Itens de RNC só se a RNC for visível ao usuário (quem do item sempre é envolvido).
      { planoAcao: { OR: [{ rnc: { is: null } }, { rnc: { is: filtroAcessoRnc(a) } }] } },
      f.status === "ATRASADO"
        ? { ...abertos, quando: { lt: hojeDb } }
        : f.status
          ? { status: f.status as Prisma.EnumStatusItemAcaoFilter["equals"] }
          : f.escopo === "meus"
            ? abertos
            : {},
      f.responsavel && f.escopo === "todos" ? { quemId: f.responsavel } : {},
      f.prazo === "vencidos" ? { quando: { lt: hojeDb } } : {},
      f.prazo === "7dias" ? { quando: { gte: hojeDb, lte: em7 } } : {},
    ],
  };

  const [itens, usuarios] = await Promise.all([
    a.db.itemAcao.findMany({
      where,
      orderBy: [{ quando: "asc" }],
      take: 300,
      include: {
        quem: { select: { nome: true } },
        planoAcao: {
          select: {
            titulo: true,
            origemTipo: true,
            rnc: { select: { id: true, codigo: true, status: true, responsavelId: true, verificacoes: { select: { resultado: true } } } },
          },
        },
      },
    }),
    a.db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const link = (p: Record<string, string>) => `?${new URLSearchParams({ ...f, ...p }).toString()}`;

  return (
    <div>
      <Cabecalho titulo="Plano de Ação" subtitulo="Todos os itens de ação, independente da origem." />

      <div className="mb-3 inline-flex rounded-md border border-slate-300 bg-white p-0.5">
        <Link href={link({ escopo: "meus" })} className={`rounded px-3 py-1 text-sm ${f.escopo === "meus" ? "bg-emerald-700 text-white" : "text-slate-600"}`}>Meus itens</Link>
        {podeTodos && (
          <Link href={link({ escopo: "todos" })} className={`rounded px-3 py-1 text-sm ${f.escopo === "todos" ? "bg-emerald-700 text-white" : "text-slate-600"}`}>Todos</Link>
        )}
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input type="hidden" name="escopo" value={f.escopo} />
        <select name="status" defaultValue={f.status} className={`${cls.input} w-auto`}>
          <option value="">{f.escopo === "meus" ? "Em aberto" : "Todos os status"}</option>
          {Object.entries(ROTULO_STATUS_ITEM).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        {f.escopo === "todos" && (
          <select name="responsavel" defaultValue={f.responsavel} className={`${cls.input} w-auto`}>
            <option value="">Todos os responsáveis</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
        <select name="prazo" defaultValue={f.prazo} className={`${cls.input} w-auto`}>
          <option value="">Qualquer prazo</option>
          <option value="vencidos">Prazo vencido</option>
          <option value="7dias">Próximos 7 dias</option>
        </select>
        <button className={cls.btnSec}>Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>{["Origem", "O quê", "Quem", "Quando", "Status", "Ações"].map((h) => <th key={h} className={cls.th}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map((i) => {
              const st = statusEfetivoItem(i, hoje);
              const rnc = i.planoAcao.rnc;
              const atual = !rnc || i.ciclo === cicloAtual(rnc.verificacoes);
              return (
                <tr key={i.id} className="align-top hover:bg-slate-50">
                  <td className={`${cls.td} whitespace-nowrap`}>
                    {rnc ? (
                      <Link href={`/rncs/${rnc.id}?aba=plano`} className="font-mono text-xs font-medium text-emerald-700 hover:underline">{rnc.codigo}</Link>
                    ) : (
                      <span className="text-xs text-slate-500">{i.planoAcao.titulo}</span>
                    )}
                  </td>
                  <td className={`${cls.td} text-slate-900`}>{i.oQue}</td>
                  <td className={`${cls.td} whitespace-nowrap`}>{i.quem.nome}</td>
                  <td className={`${cls.td} whitespace-nowrap`}>{formatarData(i.quando)}</td>
                  <td className={cls.td}><Badge cor={COR_STATUS_ITEM[st]}>{ROTULO_STATUS_ITEM[st]}</Badge></td>
                  <td className={cls.td}>
                    {atual ? (
                      <ItemAcoes
                        item={i}
                        rncId={rnc?.id}
                        hoje={hoje}
                        usuarios={usuarios}
                        podeExecutar={i.quemId === a.usuarioId && (!rnc || rnc.status === "PLANO_EM_EXECUCAO")}
                        podeGerenciar={
                          rnc
                            ? podeGerenciarPlanoRnc(a, rnc) && (rnc.status === "EM_ANALISE" || rnc.status === "PLANO_EM_EXECUCAO")
                            : podeTodos
                        }
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {itens.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">Nenhum item encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
