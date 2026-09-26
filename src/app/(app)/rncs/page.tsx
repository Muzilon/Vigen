import Link from "next/link";
import type { Gravidade, Prisma, StatusRnc, TipoRnc } from "@prisma/client";
import { Badge, Cabecalho, cls } from "@/components/ui";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, hojeNoFuso, paraDataDb } from "@/lib/datas";
import {
  COR_GRAVIDADE,
  COR_STATUS_RNC,
  ROTULO_GRAVIDADE,
  ROTULO_STATUS_RNC,
  ROTULO_TIPO,
} from "@/lib/rnc/rotulos";
import { filtroRestricaoRnc } from "@/lib/rnc/servico";
import { filtroObras, getContexto, temPermissao } from "@/lib/tenant";

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function ListaRncs({ searchParams }: PageProps<"/rncs">) {
  const sp = await searchParams;
  const f = {
    status: um(sp.status),
    obra: um(sp.obra),
    tipo: um(sp.tipo),
    responsavel: um(sp.responsavel),
    gravidade: um(sp.gravidade),
    q: um(sp.q).trim(),
  };
  const ctx = await getContexto();
  const a = await getAtor();
  const fuso = await fusoDaEmpresa(a);
  const hoje = paraDataDb(hojeNoFuso(fuso));

  const where: Prisma.RncWhereInput = {
    AND: [
      filtroObras(ctx),
      filtroRestricaoRnc(a),
      f.status ? { status: f.status as StatusRnc } : {},
      f.obra ? { obraId: f.obra } : {},
      f.tipo ? { tipo: f.tipo as TipoRnc } : {},
      f.responsavel ? { responsavelId: f.responsavel } : {},
      f.gravidade ? { gravidade: f.gravidade as Gravidade } : {},
      f.q
        ? { OR: [{ codigo: { contains: f.q, mode: "insensitive" } }, { titulo: { contains: f.q, mode: "insensitive" } }] }
        : {},
    ],
  };

  const [rncs, obras, usuarios] = await Promise.all([
    a.db.rnc.findMany({
      where,
      orderBy: [{ ano: "desc" }, { sequencia: "desc" }],
      take: 200,
      include: {
        obra: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        planoAcao: {
          select: {
            itens: { where: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] }, quando: { lt: hoje } }, select: { id: true } },
          },
        },
      },
    }),
    a.db.obraUnidade.findMany({ where: { ativo: true, ...(ctx.obrasPermitidas ? { id: { in: ctx.obrasPermitidas } } : {}) }, orderBy: { nome: "asc" } }),
    a.db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const sel = (name: keyof typeof f, opcoes: [string, string][], todos: string) => (
    <select name={name} defaultValue={f[name]} className={`${cls.input} w-auto`}>
      <option value="">{todos}</option>
      {opcoes.map(([v, r]) => (
        <option key={v} value={v}>{r}</option>
      ))}
    </select>
  );

  return (
    <div>
      <Cabecalho
        titulo="Não conformidades"
        subtitulo={`${rncs.length} registro(s)`}
        acoes={temPermissao(ctx, "RNC_ABRIR") && <Link href="/rncs/nova" className={cls.btn}>Nova RNC</Link>}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input name="q" defaultValue={f.q} placeholder="Buscar código ou título" className={`${cls.input} w-56`} />
        {sel("status", Object.entries(ROTULO_STATUS_RNC), "Todos os status")}
        {sel("obra", obras.map((o) => [o.id, o.nome]), "Todas as obras")}
        {sel("tipo", Object.entries(ROTULO_TIPO), "Todos os tipos")}
        {sel("gravidade", Object.entries(ROTULO_GRAVIDADE), "Todas as gravidades")}
        {sel("responsavel", usuarios.map((u) => [u.id, u.nome]), "Todos os responsáveis")}
        <button className={cls.btnSec}>Filtrar</button>
        <Link href="/rncs" className="text-sm text-slate-500 hover:text-slate-800">Limpar</Link>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className={cls.th}>Código</th>
              <th className={cls.th}>Título</th>
              <th className={cls.th}>Tipo</th>
              <th className={cls.th}>Obra</th>
              <th className={cls.th}>Gravidade</th>
              <th className={cls.th}>Responsável</th>
              <th className={cls.th}>Abertura</th>
              <th className={cls.th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rncs.map((r) => {
              const atrasados = r.planoAcao?.itens.length ?? 0;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className={`${cls.td} font-mono text-xs`}>
                    <Link href={`/rncs/${r.id}`} className="font-medium text-emerald-700 hover:underline">{r.codigo}</Link>
                  </td>
                  <td className={`${cls.td} max-w-md`}>
                    <Link href={`/rncs/${r.id}`} className="line-clamp-1 text-slate-900 hover:underline">{r.titulo}</Link>
                    {r.restrita && <span className="ml-1 text-xs text-slate-400">(restrita)</span>}
                  </td>
                  <td className={cls.td}>{ROTULO_TIPO[r.tipo]}</td>
                  <td className={cls.td}>{r.obra.nome}</td>
                  <td className={cls.td}><Badge cor={COR_GRAVIDADE[r.gravidade]}>{ROTULO_GRAVIDADE[r.gravidade]}</Badge></td>
                  <td className={cls.td}>{r.responsavel?.nome ?? <span className="text-slate-400">—</span>}</td>
                  <td className={cls.td}>{formatarData(hojeNoFuso(fuso, r.dataAbertura))}</td>
                  <td className={cls.td}>
                    <div className="flex flex-wrap gap-1">
                      <Badge cor={COR_STATUS_RNC[r.status]}>{ROTULO_STATUS_RNC[r.status]}</Badge>
                      {atrasados > 0 && <Badge cor="bg-red-50 text-red-700 ring-red-600/20">{atrasados} atrasado(s)</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rncs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">Nenhuma RNC encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
