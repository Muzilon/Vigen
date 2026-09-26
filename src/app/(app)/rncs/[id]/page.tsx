import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { ItemAcoes } from "@/components/item-acoes";
import { Badge, Cabecalho, Campo, Cartao, cls } from "@/components/ui";
import { atorTem, fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import { statusEfetivoItem, statusGeralPlano } from "@/lib/plano-acao/status";
import { avaliarTransicao, cicloAtual, STATUS_FINAIS } from "@/lib/rnc/estados";
import {
  COR_GRAVIDADE,
  COR_STATUS_ITEM,
  COR_STATUS_PLANO,
  COR_STATUS_RNC,
  ROTULO_GRAVIDADE,
  ROTULO_METODO,
  ROTULO_ORIGEM,
  ROTULO_STATUS_ITEM,
  ROTULO_STATUS_PLANO,
  ROTULO_STATUS_RNC,
  ROTULO_TIPO,
  SEIS_M,
} from "@/lib/rnc/rotulos";
import { filtroAcessoRnc, podeGerenciarPlanoRnc, podeTratarRnc, podeVerDadosSensiveis, verificadorExecutouItens } from "@/lib/rnc/servico";
import { Interacoes } from "@/components/interacoes";
import {
  assumirAcao,
  decidirCancelamentoAcao,
  enviarVerificacaoAcao,
  iniciarExecucaoAcao,
  solicitarCancelamentoAcao,
  verificarAcao,
} from "../actions";
import { CausaForm } from "./causa-form";
import { ItensForm } from "./itens-form";

const ABAS = [
  ["resumo", "Resumo"],
  ["causa", "Tratativa / Causa raiz"],
  ["plano", "Plano de ação"],
  ["verificacao", "Verificação de eficácia"],
  ["historico", "Histórico"],
  ["cancelamento", "Cancelamento"],
  ["interacoes", "Interações"],
] as const;
type Aba = (typeof ABAS)[number][0];

const ROTULO_EVENTO: Record<string, string> = {
  CANCELAMENTO_SOLICITADO: "Cancelamento solicitado",
  CANCELAMENTO_REJEITADO: "Cancelamento rejeitado",
  CANCELAMENTO_APROVADO: "Cancelamento aprovado",
};

export default async function DetalheRnc({ params, searchParams }: PageProps<"/rncs/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const aba: Aba = (ABAS.find(([k]) => k === sp.aba)?.[0] ?? "resumo") as Aba;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const a = await getAtor();
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const rnc = await a.db.rnc.findFirst({
    where: { AND: [{ id }, filtroAcessoRnc(a)] },
    include: {
      obra: true,
      setor: true,
      abertoPor: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      // B4: dados sensíveis só são lidos com RNC_VER_RESTRITAS.
      dadosSensiveis: podeVerDadosSensiveis(a),
      planoAcao: { include: { itens: { include: { quem: { select: { nome: true } } }, orderBy: [{ ciclo: "asc" }, { ordem: "asc" }] } } },
      verificacoes: { include: { verificador: { select: { nome: true } } }, orderBy: { tentativa: "asc" } },
      historicoStatus: { include: { usuario: { select: { nome: true } } }, orderBy: { criadoEm: "asc" } },
      solicitacoesCancelamento: {
        include: { solicitante: { select: { nome: true } }, aprovador: { select: { nome: true } } },
        orderBy: { criadoEm: "desc" },
      },
    },
  });
  if (!rnc) notFound();

  const usuarios = await a.db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  const itens = rnc.planoAcao?.itens ?? [];
  const ciclo = cicloAtual(rnc.verificacoes);
  const itensCiclo = itens.filter((i) => i.ciclo === ciclo);
  const gerenciar = podeGerenciarPlanoRnc(a, rnc);
  const tratar = podeTratarRnc(a, rnc);
  const snap = { status: rnc.status, causaRaiz: rnc.causaRaiz, itensCicloAtual: itensCiclo.map((i) => i.status) };
  const podeAssumir =
    avaliarTransicao(snap, "ASSUMIR").ok &&
    atorTem(a, "RNC_TRATAR") &&
    (!rnc.responsavelId || rnc.responsavelId === a.usuarioId || atorTem(a, "PLANO_GERENCIAR"));
  const final = STATUS_FINAIS.includes(rnc.status);
  const editavelPlano = gerenciar && (rnc.status === "EM_ANALISE" || rnc.status === "PLANO_EM_EXECUCAO");
  const pendente = rnc.solicitacoesCancelamento.find((s) => s.status === "PENDENTE");

  const transicao = (acao: typeof assumirAcao, rotulo: string, primario = true) => (
    <FormAcao acao={acao} botao={rotulo} classeBotao={primario ? cls.btn : cls.btnSec}>
      <input type="hidden" name="id" value={rnc.id} />
      <input type="hidden" name="versao" value={rnc.versao} />
    </FormAcao>
  );

  const analise = (rnc.analiseCausa ?? null) as { porques?: string[]; ishikawa?: Record<string, string>; texto?: string } | null;

  return (
    <div className="max-w-6xl">
      <div className="mb-2 text-sm"><Link href="/rncs" className="text-slate-500 hover:text-slate-800">← RNCs</Link></div>
      <Cabecalho
        titulo={<span><span className="font-mono text-lg text-slate-500">{rnc.codigo}</span> {rnc.titulo}</span>}
        subtitulo={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge cor={COR_STATUS_RNC[rnc.status]}>{ROTULO_STATUS_RNC[rnc.status]}</Badge>
            <Badge cor={COR_GRAVIDADE[rnc.gravidade]}>Gravidade {ROTULO_GRAVIDADE[rnc.gravidade].toLowerCase()}</Badge>
            <Badge cor="bg-slate-50 text-slate-700 ring-slate-500/20">{ROTULO_TIPO[rnc.tipo]}</Badge>
            {rnc.restrita && <Badge cor="bg-rose-50 text-rose-700 ring-rose-600/20">Restrita</Badge>}
            {ciclo > 1 && <Badge cor="bg-orange-50 text-orange-700 ring-orange-600/20">Ciclo {ciclo}</Badge>}
          </div>
        }
        acoes={
          <>
            {podeAssumir && transicao(assumirAcao, rnc.status === "REABERTO" ? "Retomar análise" : "Assumir análise")}
            {tratar && rnc.status === "EM_ANALISE" && transicao(iniciarExecucaoAcao, "Iniciar execução do plano")}
            {tratar && rnc.status === "PLANO_EM_EXECUCAO" && transicao(enviarVerificacaoAcao, "Enviar para verificação")}
          </>
        }
      />

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {ABAS.map(([k, r]) => (
          <Link
            key={k}
            href={`?aba=${k}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${aba === k ? "border-emerald-600 font-medium text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {r}
            {k === "plano" && itens.length > 0 && <span className="ml-1 text-xs text-slate-400">({itens.length})</span>}
            {k === "cancelamento" && pendente && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-500" />}
          </Link>
        ))}
      </nav>

      {aba === "resumo" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <Cartao titulo="Descrição">
              <p className="whitespace-pre-wrap text-sm text-slate-800">{rnc.descricao}</p>
            </Cartao>
            {rnc.contemDadosPessoais && (
              <Cartao titulo="Dados sensíveis (LGPD)">
                {podeVerDadosSensiveis(a) ? (
                  rnc.dadosSensiveis ? (
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Campo rotulo="Envolvido">{rnc.dadosSensiveis.nomeEnvolvido ?? "—"}</Campo>
                      <Campo rotulo="Documento">{rnc.dadosSensiveis.documentoEnvolvido ?? "—"}</Campo>
                      <Campo rotulo="Função">{rnc.dadosSensiveis.funcaoEnvolvido ?? "—"}</Campo>
                      <div className="sm:col-span-3"><Campo rotulo="Relato"><span className="whitespace-pre-wrap">{rnc.dadosSensiveis.relato ?? "—"}</span></Campo></div>
                      <div className="sm:col-span-3"><Campo rotulo="Lesão">{rnc.dadosSensiveis.lesaoDescricao ?? "—"}</Campo></div>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum dado sensível registrado.</p>
                  )
                ) : (
                  <p className="text-sm text-slate-500">Conteúdo oculto: você não tem acesso a dados pessoais desta RNC.</p>
                )}
              </Cartao>
            )}
            <Cartao titulo="Anexos">
              <p className="text-sm text-slate-500">Anexos estarão disponíveis em breve.</p>
            </Cartao>
          </div>
          <Cartao titulo="Detalhes">
            <dl className="space-y-3">
              <Campo rotulo="Origem">{ROTULO_ORIGEM[rnc.origem]}</Campo>
              <Campo rotulo="Obra / unidade">{rnc.obra.nome}</Campo>
              <Campo rotulo="Setor">{rnc.setor?.nome ?? "—"}</Campo>
              <Campo rotulo="Processo / área">{rnc.processoArea ?? "—"}</Campo>
              <Campo rotulo="Aberta por">{rnc.abertoPor.nome}</Campo>
              <Campo rotulo="Abertura">{formatarDataHora(rnc.dataAbertura, fuso)}</Campo>
              <Campo rotulo="Responsável">{rnc.responsavel?.nome ?? "—"}</Campo>
              {rnc.encerradoEm && <Campo rotulo="Encerrada em">{formatarDataHora(rnc.encerradoEm, fuso)}</Campo>}
              {rnc.canceladoEm && <Campo rotulo="Cancelada em">{formatarDataHora(rnc.canceladoEm, fuso)}</Campo>}
            </dl>
          </Cartao>
        </div>
      )}

      {aba === "causa" && (
        <Cartao titulo="Análise de causa raiz">
          {tratar && rnc.status === "EM_ANALISE" ? (
            <CausaForm
              rncId={rnc.id}
              versao={rnc.versao}
              metodo={rnc.metodoCausaRaiz}
              analise={analise}
              causaRaiz={rnc.causaRaiz}
            />
          ) : rnc.causaRaiz ? (
            <div className="space-y-4">
              <Campo rotulo="Método">{rnc.metodoCausaRaiz ? ROTULO_METODO[rnc.metodoCausaRaiz] : "—"}</Campo>
              {analise?.porques && (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">
                  {analise.porques.filter(Boolean).map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              )}
              {analise?.ishikawa && (
                <dl className="grid gap-3 sm:grid-cols-3">
                  {SEIS_M.map(([k, r]) => <Campo key={k} rotulo={r}>{analise.ishikawa?.[k] || "—"}</Campo>)}
                </dl>
              )}
              {analise?.texto && <p className="whitespace-pre-wrap text-sm text-slate-800">{analise.texto}</p>}
              <div className="rounded-md bg-slate-50 p-3"><Campo rotulo="Causa raiz">{rnc.causaRaiz}</Campo></div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {rnc.status === "ABERTO" || rnc.status === "REABERTO"
                ? "A análise começa quando o responsável assumir a RNC."
                : "Causa raiz ainda não registrada."}
            </p>
          )}
        </Cartao>
      )}

      {aba === "plano" && (
        <div className="space-y-5">
          <Cartao
            titulo="Plano de ação (5W2H)"
            acoes={
              rnc.planoAcao && (() => {
                const s = statusGeralPlano(itensCiclo, hoje);
                return <Badge cor={COR_STATUS_PLANO[s]}>{ROTULO_STATUS_PLANO[s]}</Badge>;
              })()
            }
          >
            {itens.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum item cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Ciclo", "O quê", "Por quê", "Onde", "Quem", "Quando", "Como", "Quanto", "Status", "Ações"].map((h) => (
                        <th key={h} className={cls.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itens.map((i) => {
                      const st = statusEfetivoItem(i, hoje);
                      const atual = i.ciclo === ciclo;
                      return (
                        <tr key={i.id} className={`align-top ${atual ? "" : "opacity-60"}`}>
                          <td className={cls.td}>{i.ciclo}</td>
                          <td className={`${cls.td} min-w-48 text-slate-900`}>
                            <Link href={`/plano-acao/${i.id}`} className="hover:underline">{i.oQue}</Link>
                            {i.evidenciaConclusao && (
                              <p className="mt-1 text-xs text-emerald-700">Evidência ({formatarData(i.dataConclusao)}): {i.evidenciaConclusao}</p>
                            )}
                          </td>
                          <td className={cls.td}>{i.porQue ?? "—"}</td>
                          <td className={cls.td}>{i.onde ?? "—"}</td>
                          <td className={`${cls.td} whitespace-nowrap`}>{i.quem.nome}</td>
                          <td className={`${cls.td} whitespace-nowrap`}>{formatarData(i.quando)}</td>
                          <td className={cls.td}>{i.como ?? "—"}</td>
                          <td className={`${cls.td} whitespace-nowrap`}>
                            {i.quanto ? Number(i.quanto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                          </td>
                          <td className={cls.td}><Badge cor={COR_STATUS_ITEM[st]}>{ROTULO_STATUS_ITEM[st]}</Badge></td>
                          <td className={cls.td}>
                            {atual ? (
                              <ItemAcoes
                                item={i}
                                rncId={rnc.id}
                                hoje={hoje}
                                usuarios={usuarios}
                                podeExecutar={i.quemId === a.usuarioId && rnc.status === "PLANO_EM_EXECUCAO"}
                                podeGerenciar={editavelPlano}
                              />
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>
          {editavelPlano && (
            <Cartao titulo={`Adicionar itens${ciclo > 1 ? ` (ciclo ${ciclo})` : ""}`}>
              <ItensForm rncId={rnc.id} usuarios={usuarios} />
            </Cartao>
          )}
        </div>
      )}

      {aba === "verificacao" && (
        <div className="space-y-5">
          {rnc.status === "EM_VERIFICACAO" && atorTem(a, "RNC_VERIFICAR_EFICACIA") && (
            <Cartao titulo={`Verificar eficácia (tentativa ${rnc.verificacoes.length + 1})`}>
              {verificadorExecutouItens(a.usuarioId, itens, ciclo) && (
                <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Atenção: você é responsável por itens deste ciclo. Recomenda-se que outra pessoa verifique a eficácia.
                </p>
              )}
              <FormAcao acao={verificarAcao} botao="Registrar verificação" classeBotao={cls.btn} className="space-y-3">
                <input type="hidden" name="id" value={rnc.id} />
                <input type="hidden" name="versao" value={rnc.versao} />
                <div className="flex gap-6 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" name="resultado" value="EFICAZ" required /> Sim, eficaz</label>
                  <label className="flex items-center gap-2"><input type="radio" name="resultado" value="INEFICAZ" /> Não, ineficaz (reabrir)</label>
                </div>
                <textarea name="comentario" rows={3} required placeholder="Comentário / evidências da verificação" className={cls.input} />
              </FormAcao>
            </Cartao>
          )}
          <Cartao titulo="Verificações registradas">
            {rnc.verificacoes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma verificação registrada.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rnc.verificacoes.map((v) => (
                  <li key={v.id} className="py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">Tentativa {v.tentativa}</span>
                      <Badge cor={v.resultado === "EFICAZ" ? COR_STATUS_ITEM.CONCLUIDO : COR_STATUS_ITEM.ATRASADO}>
                        {v.resultado === "EFICAZ" ? "Eficaz" : "Ineficaz"}
                      </Badge>
                      <span className="text-slate-500">{v.verificador.nome} · {formatarDataHora(v.verificadoEm, fuso)}</span>
                    </div>
                    <p className="mt-1 text-slate-700">{v.comentario}</p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      )}

      {aba === "historico" && (
        <Cartao titulo="Histórico">
          <ol className="relative ml-2 border-l border-slate-200">
            {rnc.historicoStatus.map((h) => {
              const evento = (h.metadados as { evento?: string } | null)?.evento;
              return (
                <li key={h.id} className="mb-4 ml-4">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-600" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {evento ? (
                      <span className="font-medium text-slate-900">{ROTULO_EVENTO[evento] ?? evento}</span>
                    ) : (
                      <>
                        {h.statusAnterior && <Badge cor={COR_STATUS_RNC[h.statusAnterior]}>{ROTULO_STATUS_RNC[h.statusAnterior]}</Badge>}
                        {h.statusAnterior && <span className="text-slate-400">→</span>}
                        <Badge cor={COR_STATUS_RNC[h.statusNovo]}>{ROTULO_STATUS_RNC[h.statusNovo]}</Badge>
                      </>
                    )}
                    <span className="text-slate-500">{h.usuario.nome} · {formatarDataHora(h.criadoEm, fuso)}</span>
                  </div>
                  {h.motivo && <p className="mt-1 text-sm text-slate-700">{h.motivo}</p>}
                </li>
              );
            })}
          </ol>
        </Cartao>
      )}

      {aba === "cancelamento" && (
        <div className="space-y-5">
          {pendente && (
            <Cartao titulo="Solicitação pendente">
              <p className="text-sm text-slate-800">
                <span className="font-medium">{pendente.solicitante.nome}</span> solicitou em {formatarDataHora(pendente.criadoEm, fuso)}:
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{pendente.motivo}</p>
              {atorTem(a, "RNC_APROVAR_CANCELAMENTO") && (
                <div className="mt-4 flex flex-wrap gap-4">
                  {(["APROVAR", "REJEITAR"] as const).map((dec) => (
                    <FormAcao
                      key={dec}
                      acao={decidirCancelamentoAcao}
                      botao={dec === "APROVAR" ? "Aprovar cancelamento" : "Rejeitar"}
                      classeBotao={dec === "APROVAR" ? cls.btnPerigo : cls.btnSec}
                      confirmar={dec === "APROVAR" ? "Confirmar o cancelamento desta RNC?" : undefined}
                      className="flex items-start gap-2"
                    >
                      <input type="hidden" name="rncId" value={rnc.id} />
                      <input type="hidden" name="solicitacaoId" value={pendente.id} />
                      <input type="hidden" name="decisao" value={dec} />
                      <input name="comentario" placeholder="Comentário (opcional)" className={`${cls.input} w-56`} />
                    </FormAcao>
                  ))}
                </div>
              )}
            </Cartao>
          )}
          {!pendente && !final && atorTem(a, "RNC_SOLICITAR_CANCELAMENTO") && (
            <Cartao titulo="Solicitar cancelamento">
              <FormAcao acao={solicitarCancelamentoAcao} botao="Solicitar cancelamento" classeBotao={cls.btnPerigo} className="space-y-3">
                <input type="hidden" name="id" value={rnc.id} />
                <textarea name="motivo" rows={3} required placeholder="Motivo do cancelamento (obrigatório)" className={cls.input} />
              </FormAcao>
            </Cartao>
          )}
          <Cartao titulo="Solicitações">
            {rnc.solicitacoesCancelamento.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma solicitação de cancelamento.</p>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>{["Data", "Solicitante", "Motivo", "Status", "Decisão"].map((h) => <th key={h} className={cls.th}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rnc.solicitacoesCancelamento.map((s) => (
                    <tr key={s.id}>
                      <td className={`${cls.td} whitespace-nowrap`}>{formatarDataHora(s.criadoEm, fuso)}</td>
                      <td className={cls.td}>{s.solicitante.nome}</td>
                      <td className={cls.td}>{s.motivo}</td>
                      <td className={cls.td}>
                        <Badge cor={s.status === "APROVADA" ? COR_STATUS_ITEM.ATRASADO : s.status === "REJEITADA" ? COR_STATUS_ITEM.CANCELADO : COR_STATUS_PLANO.PENDENTE}>
                          {s.status === "PENDENTE" ? "Pendente" : s.status === "APROVADA" ? "Aprovada" : "Rejeitada"}
                        </Badge>
                      </td>
                      <td className={cls.td}>
                        {s.aprovador ? `${s.aprovador.nome}${s.comentarioDecisao ? ` — ${s.comentarioDecisao}` : ""}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>
        </div>
      )}

      {aba === "interacoes" && (
        <Interacoes a={a} tipo="RNC" entidadeId={rnc.id} usuarios={usuarios} fuso={fuso} />
      )}
    </div>
  );
}
