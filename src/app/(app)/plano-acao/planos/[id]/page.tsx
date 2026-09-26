import Link from "next/link";
import { notFound } from "next/navigation";
import { EnviarAnexos, GaleriaAnexos } from "@/components/anexos";
import { ItemAcoes } from "@/components/item-acoes";
import { ItensForm } from "@/components/tabela-5w2h";
import { Badge, Cabecalho, Campo, Cartao, cls } from "@/components/ui";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { obterPlanoManual } from "@/lib/plano-acao/servico";
import { COR_STATUS_ITEM, COR_STATUS_PLANO, ROTULO_STATUS_ITEM, ROTULO_STATUS_PLANO } from "@/lib/rnc/rotulos";
import { adicionarItensPlanoAcao } from "../../actions";
import { EditarPlanoForm } from "./editar-form";

/** Detalhe de um plano de ação avulso (sem RNC de origem). */
export default async function DetalhePlano({ params }: PageProps<"/plano-acao/planos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const plano = await obterPlanoManual(a, id);
  if (!plano) notFound();
  const fuso = await fusoDaEmpresa(a);
  const ativos = (await usuariosAtivos(a.db)).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  // "Quem": ativos com acesso à obra do plano (o serviço valida de novo).
  const usuariosQuem = ativos
    .filter((u) => !plano.obraId || u.obras === null || u.obras.includes(plano.obraId))
    .map((u) => ({ id: u.id, nome: u.nome }));
  const alvoAnexo = { tipo: "PLANO_ACAO" as const, entidadeId: plano.id };
  const [anexos, podeAnexar] = plano.visaoCompleta
    ? await Promise.all([listarAnexos(a, alvoAnexo), podeEnviarAnexo(a, alvoAnexo)])
    : [[], false];
  const ativosNoPlano = plano.itens.filter((i) => i.status !== "CANCELADO");
  const concluidos = ativosNoPlano.filter((i) => i.status === "CONCLUIDO").length;

  return (
    <div className="space-y-5">
      <div className="text-sm"><Link href="/plano-acao" className="text-slate-500 hover:text-slate-800">← Plano de Ação</Link></div>
      <Cabecalho
        titulo={plano.titulo}
        subtitulo={
          <div className="flex flex-wrap items-center gap-2">
            <Badge cor="bg-slate-50 text-slate-700 ring-slate-600/20">Manual</Badge>
            <Badge cor={COR_STATUS_PLANO[plano.statusGeral]}>{ROTULO_STATUS_PLANO[plano.statusGeral]}</Badge>
            {plano.visaoCompleta && (
              <span className="text-xs text-slate-500">{concluidos}/{ativosNoPlano.length} item(ns) concluído(s)</span>
            )}
          </div>
        }
      />

      <Cartao titulo="Plano de ação">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Campo rotulo="Objetivo"><span className="whitespace-pre-wrap">{plano.descricao ?? "—"}</span></Campo>
          </div>
          <Campo rotulo="Obra / unidade">{plano.obra?.nome ?? "Toda a empresa"}</Campo>
          <Campo rotulo="Criado por">{plano.criadoPor.nome}</Campo>
          <Campo rotulo="Criado em">{formatarDataHora(plano.criadoEm, fuso)}</Campo>
        </dl>
        {plano.podeGerenciar && (
          <details className="mt-4">
            <summary className={`${cls.btnSec} cursor-pointer list-none px-2 py-1 text-xs`}>Editar título / objetivo</summary>
            <EditarPlanoForm planoId={plano.id} versao={plano.versao} titulo={plano.titulo} descricao={plano.descricao ?? ""} />
          </details>
        )}
      </Cartao>

      <Cartao titulo={plano.visaoCompleta ? `Itens (${plano.itens.length})` : "Seus itens neste plano"}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>{["O quê", "Quem", "Quando", "Status", "Ações"].map((h) => <th key={h} className={cls.th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plano.itens.map((i) => {
                const st = statusEfetivoItem(i, plano.hoje);
                return (
                  <tr key={i.id} className="align-top">
                    <td className={`${cls.td} text-slate-900`}>
                      <Link href={`/plano-acao/${i.id}`} className="hover:underline">{i.oQue}</Link>
                      {(i.porQue || i.onde || i.como) && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          {[i.porQue && `Por quê: ${i.porQue}`, i.onde && `Onde: ${i.onde}`, i.como && `Como: ${i.como}`].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {i.evidenciaConclusao && (
                        <div className="mt-0.5 text-xs text-emerald-800">Evidência ({formatarData(i.dataConclusao)}): {i.evidenciaConclusao}</div>
                      )}
                      <Link href={`/plano-acao/${i.id}`} className="mt-1 inline-block text-xs text-emerald-700 hover:underline">Anexos e mensagens →</Link>
                    </td>
                    <td className={`${cls.td} whitespace-nowrap`}>{i.quem.nome}</td>
                    <td className={`${cls.td} whitespace-nowrap`}>{formatarData(i.quando)}</td>
                    <td className={cls.td}><Badge cor={COR_STATUS_ITEM[st]}>{ROTULO_STATUS_ITEM[st]}</Badge></td>
                    <td className={cls.td}>
                      <ItemAcoes
                        item={i}
                        hoje={plano.hoje}
                        usuarios={usuariosQuem.some((u) => u.id === i.quemId) ? usuariosQuem : [...usuariosQuem, { id: i.quemId, nome: i.quem.nome }]}
                        podeExecutar={i.quemId === a.usuarioId}
                        podeGerenciar={plano.podeGerenciar}
                      />
                    </td>
                  </tr>
                );
              })}
              {plano.itens.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">Nenhum item.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Cartao>

      {plano.podeGerenciar && (
        <Cartao titulo="Adicionar itens (5W2H)">
          <ItensForm acao={adicionarItensPlanoAcao} ocultos={{ planoId: plano.id }} usuarios={usuariosQuem} />
        </Cartao>
      )}

      {plano.visaoCompleta && (
        <Cartao titulo={`Anexos do plano${anexos.length ? ` (${anexos.length})` : ""}`}>
          <GaleriaAnexos anexos={anexos} fuso={fuso} />
          {podeAnexar && <EnviarAnexos tipo="PLANO_ACAO" entidadeId={plano.id} />}
        </Cartao>
      )}
    </div>
  );
}
