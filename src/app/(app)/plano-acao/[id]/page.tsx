import Link from "next/link";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { notFound } from "next/navigation";
import { EnviarAnexos, GaleriaAnexos } from "@/components/anexos";
import { Interacoes } from "@/components/interacoes";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { ItemAcoes } from "@/components/item-acoes";
import { Badge, Cabecalho, Campo, Cartao } from "@/components/ui";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, hojeNoFuso } from "@/lib/datas";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { cicloAtual } from "@/lib/rnc/estados";
import { COR_STATUS_ITEM, ROTULO_STATUS_ITEM } from "@/lib/rnc/rotulos";
import { filtroAcessoItem, filtroAcessoRnc, podeGerenciarPlanoRnc } from "@/lib/rnc/servico";

/**
 * Visão reduzida do item (B4): o "quem" vê o próprio item e sua thread mesmo sem acesso à RNC,
 * sem descrição, causa raiz, outros itens ou dados sensíveis da RNC.
 */
export default async function DetalheItem({ params }: PageProps<"/plano-acao/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const item = await a.db.itemAcao.findFirst({
    where: { AND: [{ id }, filtroAcessoItem(a)] },
    include: {
      quem: { select: { nome: true } },
      planoAcao: {
        select: {
          titulo: true,
          rnc: { select: { id: true, codigo: true, status: true, responsavelId: true, obraId: true, verificacoes: { select: { resultado: true } } } },
        },
      },
    },
  });
  if (!item) notFound();
  const rnc = item.planoAcao.rnc;
  const rncVisivel = !rnc || (await a.db.rnc.count({ where: { AND: [{ id: rnc.id }, filtroAcessoRnc(a)] } })) > 0;
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const st = statusEfetivoItem(item, hoje);
  const atual = !rnc || item.ciclo === cicloAtual(rnc.verificacoes);
  const ativos = (await usuariosAtivos(a.db)).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  const usuarios = ativos.map((u) => ({ id: u.id, nome: u.nome }));
  // "Quem": só usuários ativos com acesso à obra da RNC (mantém o atual na lista).
  const usuariosQuem = ativos
    .filter((u) => !rnc || u.obras === null || u.obras.includes(rnc.obraId) || u.id === item.quemId)
    .map((u) => ({ id: u.id, nome: u.nome }));
  const podeGerenciar =
    atual &&
    (rnc
      ? rncVisivel && podeGerenciarPlanoRnc(a, rnc) && (rnc.status === "EM_ANALISE" || rnc.status === "PLANO_EM_EXECUCAO")
      : a.permissoes.includes("PLANO_GERENCIAR"));
  const podeExecutar = atual && item.quemId === a.usuarioId && (!rnc || rnc.status === "PLANO_EM_EXECUCAO");
  const alvoAnexo = { tipo: "ITEM_ACAO" as const, entidadeId: item.id };
  const [anexos, podeAnexar] = await Promise.all([listarAnexos(a, alvoAnexo), podeEnviarAnexo(a, alvoAnexo)]);

  return (
    <div className="max-w-4xl space-y-5">
      <div className="text-sm"><Link href="/plano-acao" className="text-slate-500 hover:text-slate-800">← Plano de Ação</Link></div>
      <Cabecalho
        titulo={item.oQue}
        subtitulo={
          <div className="flex flex-wrap items-center gap-2">
            <Badge cor={COR_STATUS_ITEM[st]}>{ROTULO_STATUS_ITEM[st]}</Badge>
            {rnc ? (
              rncVisivel ? (
                <Link href={`/rncs/${rnc.id}?aba=plano`} className="font-mono text-xs text-emerald-700 hover:underline">{rnc.codigo}</Link>
              ) : (
                <span className="font-mono text-xs text-slate-500">{rnc.codigo}</span>
              )
            ) : (
              <span className="text-xs text-slate-500">{item.planoAcao.titulo}</span>
            )}
          </div>
        }
      />
      <Cartao titulo="Item de ação (5W2H)">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo rotulo="Por quê">{item.porQue ?? "—"}</Campo>
          <Campo rotulo="Onde">{item.onde ?? "—"}</Campo>
          <Campo rotulo="Quem">{item.quem.nome}</Campo>
          <Campo rotulo="Quando">{formatarData(item.quando)}</Campo>
          <Campo rotulo="Como">{item.como ?? "—"}</Campo>
          <Campo rotulo="Quanto">
            {item.quanto ? Number(item.quanto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          </Campo>
          {item.evidenciaConclusao && (
            <div className="sm:col-span-3">
              <Campo rotulo={`Evidência (${formatarData(item.dataConclusao)})`}>{item.evidenciaConclusao}</Campo>
            </div>
          )}
        </dl>
        <div className="mt-4">
          <ItemAcoes
            item={item}
            rncId={rnc && rncVisivel ? rnc.id : undefined}
            hoje={hoje}
            usuarios={usuariosQuem}
            podeExecutar={podeExecutar}
            podeGerenciar={podeGerenciar}
          />
        </div>
      </Cartao>
      <Cartao titulo={`Evidências / anexos${anexos.length ? ` (${anexos.length})` : ""}`}>
        <GaleriaAnexos anexos={anexos} fuso={fuso} />
        {podeAnexar && <EnviarAnexos tipo="ITEM_ACAO" entidadeId={item.id} />}
      </Cartao>
      <Interacoes a={a} tipo="ITEM_ACAO" entidadeId={item.id} usuarios={usuarios} fuso={fuso} />
    </div>
  );
}
