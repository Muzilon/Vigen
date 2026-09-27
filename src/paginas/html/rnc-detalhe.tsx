import Link from "next/link";
import { notFound } from "next/navigation";
import type { StatusRnc } from "@prisma/client";
import { atorTem, fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { statusEfetivoItem, statusGeralPlano } from "@/lib/plano-acao/status";
import { avaliarTransicao, cicloAtual, STATUS_FINAIS } from "@/lib/rnc/estados";
import {
  ROTULO_GRAVIDADE,
  ROTULO_METODO,
  ROTULO_ORIGEM,
  ROTULO_STATUS_RNC,
  ROTULO_TIPO,
  SEIS_M,
} from "@/lib/rnc/rotulos";
import { filtroAcessoRnc, podeGerenciarPlanoRnc, podeTratarRnc, podeVerDadosSensiveis, verificadorExecutouItens } from "@/lib/rnc/servico";
import { listarAnexos, listarAnexosDe, type AnexoListado } from "@/lib/anexos/servico";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import {
  adicionarItensAcao,
  alterarResponsavelAcao,
  assumirAcao,
  decidirCancelamentoAcao,
  enviarVerificacaoAcao,
  iniciarExecucaoAcao,
  solicitarCancelamentoAcao,
  verificarAcao,
} from "@/app/(app)/rncs/actions";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { ItemAcoes, itemTemAcoes } from "@/paginas/html/componentes/item-acoes";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { CampoArquivos } from "@/paginas/html/componentes/campo-arquivos";
import { ItensForm } from "@/paginas/html/componentes/tabela-5w2h";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { LinkBotao } from "@/paginas/html/componentes/botao";
import { BadgeGravidade, BadgeStatusRnc, type GravidadeBadge, type StatusRncBadge } from "@/paginas/html/componentes/badge";
import { BadgeStatusItem, BadgeStatusPlano } from "@/paginas/html/componentes/badge-status-item";
import { CausaForm } from "@/paginas/html/rnc-detalhe-causa";
import styles from "@/paginas/css/rnc-detalhe.module.css";

const ABAS = [
  ["resumo", "Resumo"],
  ["causa", "Causa raiz"],
  ["plano", "Plano de ação"],
  ["verificacao", "Verificação"],
  ["interacoes", "Interações"],
  ["historico", "Histórico"],
  ["cancelamento", "Cancelamento"],
] as const;
type Aba = (typeof ABAS)[number][0];

const ROTULO_EVENTO: Record<string, string> = {
  CANCELAMENTO_SOLICITADO: "Cancelamento solicitado",
  RESPONSAVEL_ALTERADO: "Responsável alterado",
  CANCELAMENTO_REJEITADO: "Cancelamento rejeitado",
  CANCELAMENTO_APROVADO: "Cancelamento aprovado",
  ANEXO_EXCLUIDO: "Anexo excluído",
};

/** Etapas do ciclo de vida exibidas no stepper (REABERTO volta à etapa 1; CANCELADO interrompe). */
const ETAPAS: readonly [StatusRnc, string][] = [
  ["ABERTO", "Aberto"],
  ["EM_ANALISE", "Em análise"],
  ["PLANO_EM_EXECUCAO", "Plano em execução"],
  ["EM_VERIFICACAO", "Em verificação"],
  ["ENCERRADO", "Encerrado"],
];

/** Etiquetas neutras/semânticas locais (tipo, ciclo, verificação e cancelamento). Status de item/plano usa BadgeStatusItem/BadgeStatusPlano. */
function Etiqueta({ classe, children }: { classe: string; children: React.ReactNode }) {
  return <span className={`${styles.etiqueta} ${classe}`}>{children}</span>;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Detalhe da RNC — Direção A "Campo" (ver A-Detalhe.dc.html e Verificacao.dc.html). */
export default async function RncDetalhe({ params, searchParams }: PageProps<"/rncs/[id]">) {
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

  const ativos = (await usuariosAtivos(a.db)).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  const usuarios = ativos.map((u) => ({ id: u.id, nome: u.nome }));
  // "Quem" dos itens: só usuários ativos com acesso à obra da RNC.
  const usuariosObra = ativos.filter((u) => u.obras === null || u.obras.includes(rnc.obraId)).map((u) => ({ id: u.id, nome: u.nome }));
  // Novo responsável (B2): RNC_TRATAR + obra + (restrita => RNC_VER_RESTRITAS).
  const elegiveisResponsavel = ativos.filter(
    (u) =>
      u.permissoes.includes("RNC_TRATAR") &&
      (u.obras === null || u.obras.includes(rnc.obraId)) &&
      (!rnc.restrita || u.permissoes.includes("RNC_VER_RESTRITAS")),
  );
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
  const sensivelVisivel = rnc.contemDadosPessoais && podeVerDadosSensiveis(a);
  const [anexosRnc, anexosSensiveis, anexosItens, anexosVerif] = await Promise.all([
    aba === "resumo" ? listarAnexos(a, { tipo: "RNC", entidadeId: rnc.id }) : [],
    aba === "resumo" && sensivelVisivel ? listarAnexos(a, { tipo: "RNC_DADOS_SENSIVEIS", entidadeId: rnc.id }) : [],
    aba === "plano" ? listarAnexosDe(a, "ITEM_ACAO", itens.map((i) => i.id)) : new Map<string, AnexoListado[]>(),
    aba === "verificacao" ? listarAnexosDe(a, "VERIFICACAO_EFICACIA", rnc.verificacoes.map((v) => v.id)) : new Map<string, AnexoListado[]>(),
  ]);

  const transicao = (acao: typeof assumirAcao, rotulo: string, primario = true) => (
    <FormAcao acao={acao} botao={rotulo} variante={primario ? "primario" : "secundario"} className={styles.formTransicao}>
      <input type="hidden" name="id" value={rnc.id} />
      <input type="hidden" name="versao" value={rnc.versao} />
    </FormAcao>
  );

  const analise = (rnc.analiseCausa ?? null) as { porques?: string[]; ishikawa?: Record<string, string>; texto?: string } | null;

  // ---------------------------------------------------------------- apresentação (derivados, sem regra nova)
  const diaMes = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit" }).format(d);
  const ultimoHistorico = (s: StatusRnc) => [...rnc.historicoStatus].reverse().find((h) => h.statusNovo === s);
  const statusBaseStepper: StatusRnc =
    rnc.status === "CANCELADO" ? (ultimoHistorico("CANCELADO")?.statusAnterior ?? "ABERTO") : rnc.status;
  const etapaAtual = statusBaseStepper === "REABERTO" ? 0 : Math.max(0, ETAPAS.findIndex(([s]) => s === statusBaseStepper));
  const diasEmAberto = final
    ? null
    : Math.max(0, Math.round((paraDataDb(hoje).getTime() - paraDataDb(hojeNoFuso(fuso, rnc.dataAbertura)).getTime()) / 86_400_000));
  const podeSolicitarCancelamento = !pendente && !final && atorTem(a, "RNC_SOLICITAR_CANCELAMENTO");
  const ciclosPlano = [...new Set([ciclo, ...itens.map((i) => i.ciclo)])].sort((x, y) => y - x);
  const podeVerificar = rnc.status === "EM_VERIFICACAO" && atorTem(a, "RNC_VERIFICAR_EFICACIA");

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      {sp.aviso === "anexos" && (
        <Alerta variante="aviso" role="status">
          A RNC foi registrada, mas os anexos não puderam ser armazenados. Não abra a RNC novamente: anexe os arquivos pela seção de anexos no resumo.
        </Alerta>
      )}

      {/* ======================== 01. CABEÇALHO ======================== */}
      <header className={styles.cabecalho}>
        <div className={styles.blocoTitulo}>
          <Link href="/rncs" className={styles.voltar}>← RNCs</Link>
          <div className={styles.linhaSelos}>
            <span className={styles.codigo}>{rnc.codigo}</span>
            <Etiqueta classe={styles.etiquetaNeutra}>{ROTULO_TIPO[rnc.tipo]}</Etiqueta>
            <BadgeGravidade gravidade={rnc.gravidade as GravidadeBadge} rotulo={`Gravidade ${ROTULO_GRAVIDADE[rnc.gravidade].toLowerCase()}`} />
            <BadgeStatusRnc status={rnc.status as StatusRncBadge} rotulo={ROTULO_STATUS_RNC[rnc.status]} />
            {rnc.restrita && (
              <Etiqueta classe={styles.etiquetaPerigo}>
                <IconeCadeado /> Restrita
              </Etiqueta>
            )}
            {ciclo > 1 && <Etiqueta classe={styles.etiquetaAviso}>Ciclo {ciclo}</Etiqueta>}
          </div>
          <h1 className={styles.titulo}>{rnc.titulo}</h1>
          <p className={styles.meta}>
            Aberta por {rnc.abertoPor.nome} em <span className={styles.mono}>{formatarData(hojeNoFuso(fuso, rnc.dataAbertura))}</span> · {rnc.obra.nome}
            {diasEmAberto !== null && (
              <>
                {" "}· <span className={styles.mono}>{diasEmAberto}</span> dia(s) em aberto
              </>
            )}
          </p>
        </div>
        <div className={styles.acoesCabecalho}>
          {podeSolicitarCancelamento && (
            <LinkBotao href="?aba=cancelamento" variante="secundario">Solicitar cancelamento</LinkBotao>
          )}
          {podeAssumir && transicao(assumirAcao, rnc.status === "REABERTO" ? "Retomar análise" : "Assumir análise")}
          {tratar && rnc.status === "EM_ANALISE" && itensCiclo.some((i) => i.status !== "CANCELADO") && transicao(iniciarExecucaoAcao, "Iniciar execução do plano")}
          {tratar && rnc.status === "PLANO_EM_EXECUCAO" && transicao(enviarVerificacaoAcao, "Enviar para verificação")}
        </div>
      </header>

      {/* ======================== 02. STEPPER ======================== */}
      <ol aria-label="Ciclo de vida da RNC" className={styles.stepper}>
        {ETAPAS.map(([s, rotulo], i) => {
          const encerrada = rnc.status === "ENCERRADO";
          const feita = encerrada ? true : i < etapaAtual;
          const atual = !encerrada && i === etapaAtual;
          const cancelada = atual && rnc.status === "CANCELADO";
          const reaberta = atual && i === 0 && rnc.status === "REABERTO";
          const h = ultimoHistorico(reaberta ? "REABERTO" : s);
          const data = h?.criadoEm ?? (i === 0 ? rnc.dataAbertura : null);
          return (
            <li
              key={s}
              aria-current={atual ? "step" : undefined}
              className={`${styles.etapa} ${feita ? styles.etapaFeita : ""} ${atual ? styles.etapaAtual : ""} ${cancelada ? styles.etapaCancelada : ""}`}
            >
              <span className={styles.marcadorEtapa}>{feita ? <IconeCheck /> : cancelada ? "✕" : i + 1}</span>
              <span className={styles.textoEtapa}>
                <span className={styles.rotuloEtapa}>{reaberta ? "Reaberto" : rotulo}</span>
                <span className={styles.dataEtapa}>
                  {cancelada && rnc.canceladoEm ? (
                    <>cancelada em <span className={styles.mono}>{diaMes(rnc.canceladoEm)}</span></>
                  ) : atual && data ? (
                    <>desde <span className={styles.mono}>{diaMes(data)}</span></>
                  ) : feita && data ? (
                    <span className={styles.mono}>{diaMes(data)}</span>
                  ) : (
                    "—"
                  )}
                </span>
              </span>
              {i < ETAPAS.length - 1 && <span className={styles.conectorEtapa} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className={styles.corpo}>
        <section className={styles.colunaPrincipal}>
          {/* ======================== 03. ABAS ======================== */}
          <nav aria-label="Seções da RNC" className={styles.abas}>
            {ABAS.map(([k, r]) => (
              <Link key={k} href={`?aba=${k}`} aria-current={aba === k ? "page" : undefined} className={`${styles.aba} ${aba === k ? styles.abaAtiva : ""}`}>
                {r}
                {k === "plano" && itens.length > 0 && <span className={styles.contadorAba}>{itens.length}</span>}
                {k === "cancelamento" && pendente && <span className={styles.pontoPendente} role="img" aria-label="solicitação pendente" />}
              </Link>
            ))}
          </nav>

          <div className={styles.painelAba}>
            {/* ======================== 04. RESUMO ======================== */}
            {aba === "resumo" && (
              <>
                <Cartao titulo="Descrição">
                  <p className={styles.textoLongo}>{rnc.descricao}</p>
                </Cartao>
                {rnc.contemDadosPessoais && (
                  <Cartao
                    titulo={
                      <span className={styles.tituloComIcone}>
                        <IconeCadeado /> Dados sensíveis (LGPD)
                      </span>
                    }
                    className={styles.cartaoSensivel}
                  >
                    {podeVerDadosSensiveis(a) ? (
                      rnc.dadosSensiveis ? (
                        <dl className={styles.gradeSensiveis}>
                          <Campo rotulo="Envolvido">{rnc.dadosSensiveis.nomeEnvolvido ?? "—"}</Campo>
                          <Campo rotulo="Documento"><span className={styles.mono}>{rnc.dadosSensiveis.documentoEnvolvido ?? "—"}</span></Campo>
                          <Campo rotulo="Função">{rnc.dadosSensiveis.funcaoEnvolvido ?? "—"}</Campo>
                          <Campo rotulo="Relato" largo><span className={styles.textoLongo}>{rnc.dadosSensiveis.relato ?? "—"}</span></Campo>
                          <Campo rotulo="Lesão" largo>{rnc.dadosSensiveis.lesaoDescricao ?? "—"}</Campo>
                        </dl>
                      ) : (
                        <p className={styles.vazio}>Nenhum dado sensível registrado.</p>
                      )
                    ) : (
                      <p className={styles.vazio}>Conteúdo oculto: você não tem acesso a dados pessoais desta RNC.</p>
                    )}
                    {sensivelVisivel && (
                      <div className={styles.subsecao}>
                        <h3 className={styles.tituloSubsecao}>Anexos sensíveis</h3>
                        <GaleriaAnexos anexos={anexosSensiveis} fuso={fuso} vazio="Nenhum anexo sensível." />
                        {!final && <EnviarAnexos tipo="RNC_DADOS_SENSIVEIS" entidadeId={rnc.id} rotulo="Adicionar anexos sensíveis" />}
                      </div>
                    )}
                  </Cartao>
                )}
              </>
            )}

            {/* ======================== 05. CAUSA RAIZ ======================== */}
            {aba === "causa" && (
              <Cartao titulo="Análise de causa raiz">
                {tratar && rnc.status === "EM_ANALISE" ? (
                  <CausaForm rncId={rnc.id} versao={rnc.versao} metodo={rnc.metodoCausaRaiz} analise={analise} causaRaiz={rnc.causaRaiz} />
                ) : rnc.causaRaiz ? (
                  <div className={styles.pilha}>
                    <dl className={styles.listaCampos}>
                      <Campo rotulo="Método">{rnc.metodoCausaRaiz ? ROTULO_METODO[rnc.metodoCausaRaiz] : "—"}</Campo>
                    </dl>
                    {analise?.porques && (
                      <ol className={styles.listaPorques}>
                        {analise.porques.filter(Boolean).map((p, i) => <li key={i}>{p}</li>)}
                      </ol>
                    )}
                    {analise?.ishikawa && (
                      <dl className={styles.gradeIshikawa}>
                        {SEIS_M.map(([k, r]) => <Campo key={k} rotulo={r}>{analise.ishikawa?.[k] || "—"}</Campo>)}
                      </dl>
                    )}
                    {analise?.texto && <p className={styles.textoLongo}>{analise.texto}</p>}
                    <div className={styles.destaqueCausa}>
                      <span className={styles.rotuloDestaque}>Causa raiz</span>
                      <p className={styles.textoCausa}>{rnc.causaRaiz}</p>
                    </div>
                  </div>
                ) : (
                  <p className={styles.vazio}>
                    {rnc.status === "ABERTO" || rnc.status === "REABERTO"
                      ? "A análise começa quando o responsável assumir a RNC."
                      : "Causa raiz ainda não registrada."}
                  </p>
                )}
              </Cartao>
            )}

            {/* ======================== 06. PLANO DE AÇÃO (5W2H) ======================== */}
            {aba === "plano" && (
              <>
                {itens.length === 0 ? (
                  <Cartao
                    titulo="Plano de ação (5W2H)"
                    acoes={
                      rnc.planoAcao && (() => {
                        const s = statusGeralPlano(itensCiclo, hoje);
                        return <BadgeStatusPlano status={s} />;
                      })()
                    }
                  >
                    <p className={styles.vazio}>Nenhum item cadastrado.</p>
                  </Cartao>
                ) : (
                  ciclosPlano.map((c) => {
                    const doCiclo = itens.filter((i) => i.ciclo === c);
                    const atual = c === ciclo;
                    const validos = doCiclo.filter((i) => i.status !== "CANCELADO");
                    const concluidos = validos.filter((i) => i.status === "CONCLUIDO").length;
                    const pct = validos.length ? Math.round((concluidos / validos.length) * 100) : 0;
                    const custo = validos.reduce((t, i) => t + (i.quanto ? Number(i.quanto) : 0), 0);
                    const sPlano = atual && rnc.planoAcao ? statusGeralPlano(itensCiclo, hoje) : null;
                    return (
                      <section key={c} className={`${styles.painelCiclo} ${atual ? "" : styles.cicloAnterior}`} aria-label={`Ciclo ${c}`}>
                        <div className={styles.cabecalhoCiclo}>
                          <span className={styles.seloCiclo}>Ciclo {c}</span>
                          {!atual && <span className={styles.textoFraco}>anterior</span>}
                          {sPlano && <BadgeStatusPlano status={sPlano} />}
                          <span className={styles.espacador} />
                          {validos.length > 0 && (
                            <>
                              <span className={styles.progressoTexto}>
                                <span className={styles.mono}>{concluidos}</span> de <span className={styles.mono}>{validos.length}</span> concluído(s)
                              </span>
                              <span role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso do ciclo ${c}`} className={styles.barraProgresso}>
                                <span className={styles.preenchimentoProgresso} style={{ width: `${pct}%` }} />
                              </span>
                            </>
                          )}
                          {atual && editavelPlano && (
                            <LinkBotao href="#adicionar-itens" variante="secundario" className={styles.botaoCompacto}>+ Adicionar item</LinkBotao>
                          )}
                        </div>
                        {doCiclo.length === 0 ? (
                          <p className={`${styles.vazio} ${styles.vazioCiclo}`}>Nenhum item neste ciclo.</p>
                        ) : (
                          <table className={styles.tabelaPlano}>
                            {/* Larguras em % (table-layout: fixed): cabe na coluna principal sem rolagem */}
                            <colgroup>
                              <col className={styles.colOQue} />
                              <col className={styles.colPorQue} />
                              <col className={styles.colOnde} />
                              <col className={styles.colQuem} />
                              <col className={styles.colQuando} />
                              <col className={styles.colComo} />
                              <col className={styles.colQuanto} />
                              <col className={styles.colStatus} />
                            </colgroup>
                            <thead>
                              <tr>
                                {["O quê", "Por quê", "Onde", "Quem", "Quando", "Como", "Quanto", "Status"].map((h) => (
                                  <th key={h} scope="col" className={h === "Quanto" ? styles.thDireita : undefined}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            {doCiclo.map((i) => {
                              const st = statusEfetivoItem(i, hoje);
                              const podeExecutar = i.quemId === a.usuarioId && rnc.status === "PLANO_EM_EXECUCAO";
                              const comAcoes = atual && itemTemAcoes(i.status, podeExecutar, editavelPlano);
                              return (
                                // Um <tbody> por item: linha de dados + (opcional) linha de ações abaixo, formando um bloco
                                <tbody key={i.id} className={styles.grupoItem}>
                                  <tr>
                                    <td data-rotulo="O quê" className={styles.celulaOQue}>
                                      <Link href={`/plano-acao/${i.id}`} className={styles.linkItem}>{i.oQue}</Link>
                                      {i.evidenciaConclusao && (
                                        <p className={styles.evidencia}>Evidência ({formatarData(i.dataConclusao)}): {i.evidenciaConclusao}</p>
                                      )}
                                      {(anexosItens.get(i.id) ?? []).map((x) => (
                                        <a key={x.id} href={`/api/anexos/${x.id}`} className={styles.linkAnexoItem}>
                                          Anexo: {x.nomeArquivo}
                                        </a>
                                      ))}
                                    </td>
                                    <td data-rotulo="Por quê" className={styles.tdSecundario}>{i.porQue ?? "—"}</td>
                                    <td data-rotulo="Onde" className={styles.tdSecundario}>{i.onde ?? "—"}</td>
                                    <td data-rotulo="Quem">{i.quem.nome}</td>
                                    <td data-rotulo="Quando" className={`${styles.tdMono} ${st === "ATRASADO" ? styles.dataAtrasada : ""}`}>{formatarData(i.quando)}</td>
                                    <td data-rotulo="Como" className={styles.tdSecundario}>{i.como ?? "—"}</td>
                                    <td data-rotulo="Quanto" className={`${styles.tdMono} ${styles.tdDireita}`}>{i.quanto ? moeda(Number(i.quanto)) : "—"}</td>
                                    <td data-rotulo="Status"><BadgeStatusItem status={st} /></td>
                                  </tr>
                                  {comAcoes && (
                                    <tr className={styles.linhaAcoes}>
                                      <td colSpan={8}>
                                        <ItemAcoes
                                          item={i}
                                          rncId={rnc.id}
                                          hoje={hoje}
                                          usuarios={usuariosObra.some((u) => u.id === i.quemId) ? usuariosObra : [...usuariosObra, { id: i.quemId, nome: i.quem.nome }]}
                                          podeExecutar={podeExecutar}
                                          podeGerenciar={editavelPlano}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              );
                            })}
                          </table>
                        )}
                        <div className={styles.rodapeCiclo}>
                          {atual && (
                            <>
                              <IconeInfo />
                              <span className={styles.espacador}>Se a verificação de eficácia for ineficaz, um novo ciclo é aberto mantendo este histórico.</span>
                            </>
                          )}
                          {!atual && <span className={styles.espacador} />}
                          <span>
                            Custo total do ciclo <span className={styles.valorCusto}>{moeda(custo)}</span>
                          </span>
                        </div>
                      </section>
                    );
                  })
                )}
                {editavelPlano && (
                  <div id="adicionar-itens" className={styles.ancora}>
                    <Cartao titulo={`Adicionar itens${ciclo > 1 ? ` (ciclo ${ciclo})` : ""}`}>
                      <ItensForm acao={adicionarItensAcao} ocultos={{ rncId: rnc.id }} usuarios={usuariosObra} />
                    </Cartao>
                  </div>
                )}
              </>
            )}

            {/* ======================== 07. VERIFICAÇÃO DE EFICÁCIA ======================== */}
            {aba === "verificacao" && (
              <div className={`${styles.gradeVerificacao} ${podeVerificar ? "" : styles.gradeVerificacaoUnica}`}>
                <div className={styles.pilha}>
                  <section className={styles.cartaoCausa} aria-labelledby="t-causa">
                    <h2 id="t-causa" className={styles.rotuloDestaque}>Causa raiz</h2>
                    <p className={styles.textoCausa}>{rnc.causaRaiz ?? "Causa raiz ainda não registrada."}</p>
                  </section>

                  <Cartao
                    titulo={`Ações do ciclo ${ciclo}`}
                    acoes={
                      itensCiclo.length > 0 && (
                        <span className={styles.contagemConcluidas}>
                          <IconeCheck />
                          <span className={styles.mono}>
                            {itensCiclo.filter((i) => i.status === "CONCLUIDO").length}/{itensCiclo.filter((i) => i.status !== "CANCELADO").length}
                          </span>
                        </span>
                      )
                    }
                  >
                    {itensCiclo.length === 0 ? (
                      <p className={styles.vazio}>Nenhum item neste ciclo.</p>
                    ) : (
                      <ul className={styles.listaAcoesCiclo}>
                        {itensCiclo.map((i) => {
                          const st = statusEfetivoItem(i, hoje);
                          return (
                            <li key={i.id} className={styles.acaoCiclo}>
                              <div className={styles.linhaAcaoCiclo}>
                                <Link href={`/plano-acao/${i.id}`} className={styles.tituloAcaoCiclo}>{i.oQue}</Link>
                                <span className={styles.metaAcaoCiclo}>
                                  {i.quem.nome} · <span className={styles.mono}>{formatarData(i.dataConclusao ?? i.quando)}</span>
                                </span>
                              </div>
                              <div className={styles.linhaAcaoCiclo}>
                                <BadgeStatusItem status={st} />
                                {i.evidenciaConclusao && <span className={styles.evidencia}>{i.evidenciaConclusao}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className={styles.linkRodape}>
                      <Link href="?aba=plano">Ver plano de ação completo</Link>
                    </p>
                  </Cartao>

                  <Cartao titulo="Verificações registradas">
                    {rnc.verificacoes.length === 0 ? (
                      <p className={styles.vazio}>Nenhuma verificação registrada.</p>
                    ) : (
                      <ul className={styles.listaVerificacoes}>
                        {rnc.verificacoes.map((v) => {
                          const eficaz = v.resultado === "EFICAZ";
                          return (
                            <li key={v.id} className={styles.verificacao}>
                              <span className={`${styles.iconeResultado} ${eficaz ? styles.resultadoEficaz : styles.resultadoIneficaz}`} aria-hidden="true">
                                {eficaz ? <IconeCheck /> : "✕"}
                              </span>
                              <div className={styles.corpoVerificacao}>
                                <div className={styles.cabecalhoVerificacao}>
                                  <span className={styles.tentativa}>Tentativa {v.tentativa}</span>
                                  <Etiqueta classe={eficaz ? styles.etiquetaSucesso : styles.etiquetaPerigo}>{eficaz ? "Eficaz" : "Ineficaz"}</Etiqueta>
                                  <span className={styles.textoFraco}>
                                    {v.verificador.nome} · <span className={styles.mono}>{formatarDataHora(v.verificadoEm, fuso)}</span>
                                  </span>
                                </div>
                                <p className={styles.comentario}>{v.comentario}</p>
                                {(anexosVerif.get(v.id)?.length ?? 0) > 0 && (
                                  <div className={styles.anexosVerificacao}><GaleriaAnexos anexos={anexosVerif.get(v.id)!} fuso={fuso} /></div>
                                )}
                                {v.verificadorId === a.usuarioId && <EnviarAnexos tipo="VERIFICACAO_EFICACIA" entidadeId={v.id} rotulo="Adicionar evidências" />}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Cartao>
                </div>

                {podeVerificar && (
                  <section className={styles.painelDecisao} aria-label={`Verificar eficácia (tentativa ${rnc.verificacoes.length + 1})`}>
                    <span className={styles.seloTentativa}>
                      Tentativa {rnc.verificacoes.length + 1} · Ciclo {ciclo}
                    </span>
                    <FormAcao acao={verificarAcao} botao="Registrar verificação" className={styles.formDecisao} classeBotao={styles.botaoRegistrar} variante="primario">
                      <input type="hidden" name="id" value={rnc.id} />
                      <input type="hidden" name="versao" value={rnc.versao} />
                      <fieldset className={styles.grupoDecisao}>
                        <legend className={styles.perguntaDecisao}>A causa foi eliminada?</legend>
                        <div className={styles.opcoesDecisao}>
                          <label className={`${styles.opcaoDecisao} ${styles.opcaoEficaz}`}>
                            <span className={styles.linhaOpcao}>
                              <input type="radio" name="resultado" value="EFICAZ" required className={styles.radioDecisao} />
                              Sim, eficaz
                            </span>
                            <span className={styles.descricaoOpcao}>Encerra a <span className={styles.codigoSemQuebra}>{rnc.codigo}</span></span>
                          </label>
                          <label className={`${styles.opcaoDecisao} ${styles.opcaoIneficaz}`}>
                            <span className={styles.linhaOpcao}>
                              <input type="radio" name="resultado" value="INEFICAZ" className={styles.radioDecisao} />
                              Não, ineficaz — reabrir
                            </span>
                            <span className={styles.descricaoOpcao}>Reabre a RNC e inicia o ciclo {ciclo + 1}</span>
                          </label>
                        </div>
                      </fieldset>
                      <div className={styles.campoFormulario}>
                        <label htmlFor="verif-comentario" className={styles.rotuloCampo}>
                          Comentário <span className={styles.obrigatorio}>*</span>
                        </label>
                        <textarea
                          id="verif-comentario"
                          name="comentario"
                          rows={4}
                          required
                          placeholder="Comentário / evidências da verificação"
                          className={styles.areaTexto}
                        />
                      </div>
                      <CampoArquivos rotulo="Evidências da verificação (opcional)" />
                      {verificadorExecutouItens(a.usuarioId, itens, ciclo) && (
                        <p role="note" className={styles.notaVerificador}>
                          <IconeInfo />
                          <span>Atenção: você é responsável por itens deste ciclo. Recomenda-se que outra pessoa verifique a eficácia.</span>
                        </p>
                      )}
                    </FormAcao>
                  </section>
                )}
              </div>
            )}

            {/* ======================== 08. HISTÓRICO ======================== */}
            {aba === "historico" && (
              <Cartao titulo="Histórico">
                <ol className={styles.linhaTempo}>
                  {rnc.historicoStatus.map((h) => {
                    const evento = (h.metadados as { evento?: string } | null)?.evento;
                    return (
                      <li key={h.id} className={styles.eventoTempo}>
                        <span className={styles.pontoTempo} aria-hidden="true" />
                        <div className={styles.linhaEvento}>
                          {evento ? (
                            <span className={styles.nomeEvento}>{ROTULO_EVENTO[evento] ?? evento}</span>
                          ) : (
                            <>
                              {h.statusAnterior && <BadgeStatusRnc status={h.statusAnterior as StatusRncBadge} rotulo={ROTULO_STATUS_RNC[h.statusAnterior]} />}
                              {h.statusAnterior && <span className={styles.textoFraco} aria-hidden="true">→</span>}
                              <BadgeStatusRnc status={h.statusNovo as StatusRncBadge} rotulo={ROTULO_STATUS_RNC[h.statusNovo]} />
                            </>
                          )}
                          <span className={styles.textoFraco}>
                            {h.usuario.nome} · <span className={styles.mono}>{formatarDataHora(h.criadoEm, fuso)}</span>
                          </span>
                        </div>
                        {h.motivo && <p className={styles.motivoEvento}>{h.motivo}</p>}
                      </li>
                    );
                  })}
                </ol>
              </Cartao>
            )}

            {/* ======================== 09. CANCELAMENTO ======================== */}
            {aba === "cancelamento" && (
              <>
                {pendente && (
                  <Cartao titulo="Solicitação pendente" className={styles.cartaoPendente}>
                    <p className={styles.textoCorpo}>
                      <strong>{pendente.solicitante.nome}</strong> solicitou em <span className={styles.mono}>{formatarDataHora(pendente.criadoEm, fuso)}</span>:
                    </p>
                    <p className={`${styles.textoLongo} ${styles.motivoPendente}`}>{pendente.motivo}</p>
                    {atorTem(a, "RNC_APROVAR_CANCELAMENTO") && pendente.solicitanteId === a.usuarioId && (
                      <p className={styles.observacao}>Você solicitou este cancelamento: a aprovação cabe a outro usuário.</p>
                    )}
                    {atorTem(a, "RNC_APROVAR_CANCELAMENTO") && (
                      <div className={styles.decisoesCancelamento}>
                        {(pendente.solicitanteId === a.usuarioId ? (["REJEITAR"] as const) : (["APROVAR", "REJEITAR"] as const)).map((dec) => (
                          <FormAcao
                            key={dec}
                            acao={decidirCancelamentoAcao}
                            botao={dec === "APROVAR" ? "Aprovar cancelamento" : "Rejeitar"}
                            variante={dec === "APROVAR" ? "perigo" : "secundario"}
                            confirmar={dec === "APROVAR" ? "Confirmar o cancelamento desta RNC?" : undefined}
                            className={styles.formDecisaoCancelamento}
                          >
                            <input type="hidden" name="rncId" value={rnc.id} />
                            <input type="hidden" name="solicitacaoId" value={pendente.id} />
                            <input type="hidden" name="decisao" value={dec} />
                            <input name="comentario" placeholder="Comentário (opcional)" aria-label="Comentário (opcional)" className={styles.entradaComentario} />
                          </FormAcao>
                        ))}
                      </div>
                    )}
                  </Cartao>
                )}
                {podeSolicitarCancelamento && (
                  <Cartao titulo="Solicitar cancelamento">
                    <FormAcao acao={solicitarCancelamentoAcao} botao="Solicitar cancelamento" variante="perigo" className={styles.formEmPilha}>
                      <input type="hidden" name="id" value={rnc.id} />
                      <label htmlFor="cancel-motivo" className={styles.rotuloCampo}>
                        Motivo do cancelamento <span className={styles.obrigatorio}>*</span>
                      </label>
                      <textarea id="cancel-motivo" name="motivo" rows={3} required placeholder="Motivo do cancelamento (obrigatório)" className={styles.areaTexto} />
                    </FormAcao>
                  </Cartao>
                )}
                <Cartao titulo="Solicitações">
                  {rnc.solicitacoesCancelamento.length === 0 ? (
                    <p className={styles.vazio}>Nenhuma solicitação de cancelamento.</p>
                  ) : (
                    <div className={styles.rolagemTabela}>
                      <table className={styles.tabelaSimples}>
                        <thead>
                          <tr>{["Data", "Solicitante", "Motivo", "Status", "Decisão"].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rnc.solicitacoesCancelamento.map((s) => (
                            <tr key={s.id}>
                              <td className={styles.tdMono}>{formatarDataHora(s.criadoEm, fuso)}</td>
                              <td>{s.solicitante.nome}</td>
                              <td>{s.motivo}</td>
                              <td>
                                <Etiqueta classe={s.status === "APROVADA" ? styles.etiquetaPerigo : s.status === "REJEITADA" ? styles.etiquetaApagada : styles.etiquetaNeutra}>
                                  {s.status === "PENDENTE" ? "Pendente" : s.status === "APROVADA" ? "Aprovada" : "Rejeitada"}
                                </Etiqueta>
                              </td>
                              <td className={styles.tdSecundario}>
                                {s.aprovador ? `${s.aprovador.nome}${s.comentarioDecisao ? ` — ${s.comentarioDecisao}` : ""}` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Cartao>
              </>
            )}

            {/* ======================== 10. INTERAÇÕES ======================== */}
            {aba === "interacoes" && <Interacoes a={a} tipo="RNC" entidadeId={rnc.id} usuarios={usuarios} fuso={fuso} />}
          </div>
        </section>

        {/* ======================== 11. PAINEL LATERAL (detalhes + anexos) ======================== */}
        <aside className={styles.lateral}>
          <Cartao titulo="Detalhes">
            <dl className={styles.listaDetalhes}>
              <dt>Unidade</dt>
              <dd>{rnc.obra.nome}</dd>
              <dt>Setor</dt>
              <dd>{rnc.setor?.nome ?? "—"}</dd>
              <dt>Processo / área</dt>
              <dd>{rnc.processoArea ?? "—"}</dd>
              <dt>Origem</dt>
              <dd>{ROTULO_ORIGEM[rnc.origem]}</dd>
              <dt>Aberta por</dt>
              <dd className={styles.pessoa}>
                <span className={styles.avatar} aria-hidden="true">{iniciais(rnc.abertoPor.nome)}</span>
                {rnc.abertoPor.nome}
              </dd>
              <dt>Responsável</dt>
              <dd className={styles.pessoa}>
                {rnc.responsavel ? (
                  <>
                    <span className={`${styles.avatar} ${styles.avatarResponsavel}`} aria-hidden="true">{iniciais(rnc.responsavel.nome)}</span>
                    {rnc.responsavel.nome}
                  </>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Abertura</dt>
              <dd className={styles.mono}>{formatarDataHora(rnc.dataAbertura, fuso)}</dd>
              {rnc.encerradoEm && (
                <>
                  <dt>Encerrada em</dt>
                  <dd className={styles.mono}>{formatarDataHora(rnc.encerradoEm, fuso)}</dd>
                </>
              )}
              {rnc.canceladoEm && (
                <>
                  <dt>Cancelada em</dt>
                  <dd className={styles.mono}>{formatarDataHora(rnc.canceladoEm, fuso)}</dd>
                </>
              )}
            </dl>
            {!final && atorTem(a, "PLANO_GERENCIAR") && (
              <FormAcao acao={alterarResponsavelAcao} botao="Alterar responsável" variante="secundario" tamanho="pequeno" className={styles.formResponsavel}>
                <input type="hidden" name="id" value={rnc.id} />
                <input type="hidden" name="versao" value={rnc.versao} />
                <select name="responsavelId" required defaultValue="" aria-label="Novo responsável" className={styles.selecao}>
                  <option value="" disabled>Novo responsável…</option>
                  {elegiveisResponsavel.filter((u) => u.id !== rnc.responsavelId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </FormAcao>
            )}
          </Cartao>
          {aba === "resumo" && (
            <Cartao
              titulo={
                <>
                  Anexos {anexosRnc.length > 0 && <span className={styles.contagemTitulo}>{anexosRnc.length}</span>}
                </>
              }
            >
              <GaleriaAnexos anexos={anexosRnc} fuso={fuso} />
              {!final && <EnviarAnexos tipo="RNC" entidadeId={rnc.id} />}
            </Cartao>
          )}
        </aside>
      </div>
    </div>
  );
}

function Campo({ rotulo, largo, children }: { rotulo: string; largo?: boolean; children: React.ReactNode }) {
  return (
    <div className={largo ? styles.campoLargo : undefined}>
      <dt className={styles.rotuloDado}>{rotulo}</dt>
      <dd className={styles.valorDado}>{children}</dd>
    </div>
  );
}

function IconeCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l4.5 4.5L19 7" />
    </svg>
  );
}

function IconeCadeado() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function IconeInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.iconeInfo}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}
