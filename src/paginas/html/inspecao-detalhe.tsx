import Link from "next/link";
import { notFound } from "next/navigation";
import {
  abrirRncAcao,
  cancelarInspecaoAcao,
  concluirInspecaoAcao,
  criarItemAcaoAcao,
  responderAcao,
} from "@/app/(app)/inspecoes/actions";
import { listarAnexosDe } from "@/lib/anexos/servico";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora, hojeNoFuso, somarDias } from "@/lib/datas";
import {
  classificar,
  contarRespostas,
  OPCOES_POR_TIPO,
  percentualConformidade,
  ROTULO_STATUS_INSPECAO,
  ROTULO_TIPO_CHECKLIST,
  ROTULO_VALOR,
  textoResposta,
} from "@/lib/inspecoes/regras";
import { obterInspecao, opcoesInspecoes, podeExecutarInspecao, sugestaoRnc } from "@/lib/inspecoes/servico";
import { exigirModulo } from "@/lib/modulos";
import { linkPlano } from "@/lib/plano-acao/acesso";
import { ROTULO_GRAVIDADE, ROTULO_STATUS_RNC as ROTULO_STATUS, ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { getContexto } from "@/lib/tenant";
import { GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { CampoArquivos } from "@/paginas/html/componentes/campo-arquivos";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import styles from "@/paginas/css/inspecao-detalhe.module.css";

const ROTULO_CLASSE = { CONFORME: "Conforme", NAO_CONFORME: "Não conforme", NAO_APLICAVEL: "N.A.", INFORMATIVA: "Informativa", PENDENTE: "Pendente" } as const;

/**
 * Execução da inspeção (lista com respostas inline — uma pergunta por cartão, alvos de toque grandes,
 * foto por resposta) e resumo final. Resposta não conforme oferece "Abrir RNC" ou "Criar item de ação".
 */
export default async function InspecaoDetalhe({ params }: PageProps<"/inspecoes/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "INSPECOES");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const i = await obterInspecao(a, id);
  if (!i) notFound();
  const [op, fuso, fotos] = await Promise.all([opcoesInspecoes(a), fusoDaEmpresa(a), listarAnexosDe(a, "RESPOSTA_INSPECAO", i.respostas.map((r) => r.id))]);
  const hoje = hojeNoFuso(fuso);
  const exec = podeExecutarInspecao(a, i);
  const aberta = i.status === "EM_ANDAMENTO";
  const editar = exec && aberta;
  const notaMin = i.modelo.notaMinima;
  const cont = contarRespostas(i.respostas, notaMin);
  const pct = i.percentualConformidade ?? percentualConformidade(i.respostas, notaMin);
  const gerados = i.respostas.filter((r) => r.geradaRnc || r.geradoItemAcao);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/inspecoes">← Inspeções</Link>
      </nav>

      <header className={styles.cabecalho}>
        <p className={styles.codigo}>{i.codigo} · {ROTULO_TIPO_CHECKLIST[i.modelo.tipo]}</p>
        <h1 className={styles.titulo}>{i.modelo.nome}</h1>
        <p className={styles.meta}>
          <span className={`${styles.status} ${styles[`status_${i.status}`]}`}>{ROTULO_STATUS_INSPECAO[i.status]}</span>
          <span>{i.obra.nome}{i.setor ? ` · ${i.setor.nome}` : ""}</span>
          <span>{formatarData(i.dataInspecao)}</span>
          <span>Inspetor: {i.inspetor.nome}</span>
          {i.processo && <Link href={`/processos/${i.processo.id}`}>{i.processo.codigo}</Link>}
        </p>
        <div className={styles.progresso} aria-label={`${cont.respondidas} de ${cont.total} respondidas`}>
          <div className={styles.barra}><span style={{ width: `${cont.total ? Math.round((cont.respondidas / cont.total) * 100) : 0}%` }} /></div>
          <span>{cont.respondidas}/{cont.total} respondidas · <strong>{pct === null ? "—" : `${pct}%`}</strong> conformidade · {cont.naoConformes} NC</span>
        </div>
      </header>

      {i.status !== "EM_ANDAMENTO" && (
        <Cartao titulo="Resumo">
          <div className={styles.resumo}>
            <div className={styles.numeroGrande}>{pct === null ? "—" : `${pct}%`}<small>conformidade</small></div>
            <dl className={styles.contagens}>
              <dt>Conformes</dt><dd>{cont.conformes}</dd>
              <dt>Não conformes</dt><dd>{cont.naoConformes}</dd>
              <dt>N.A.</dt><dd>{cont.naoAplicaveis}</dd>
              <dt>Concluída em</dt><dd>{formatarDataHora(i.concluidaEm, fuso)}</dd>
            </dl>
          </div>
          {i.observacoes && <p className={styles.observacoes}>{i.observacoes}</p>}
          <h3 className={styles.subtitulo}>Gerado a partir desta inspeção</h3>
          {gerados.length === 0 ? (
            <p className={styles.vazio}>Nenhuma RNC ou item de ação.</p>
          ) : (
            <ul className={styles.gerados}>
              {gerados.map((r) => (
                <li key={r.id}>
                  <span className={styles.numeroPergunta}>{r.ordem}.</span> {r.pergunta}
                  {r.geradaRnc && <> — <Link href={`/rncs/${r.geradaRnc.id}`}>{r.geradaRnc.codigo}</Link> ({ROTULO_STATUS[r.geradaRnc.status]})</>}
                  {r.geradoItemAcao && <> — <Link href={`/plano-acao/${r.geradoItemAcao.id}`}>item de ação</Link> ({r.geradoItemAcao.quem.nome}, {formatarData(r.geradoItemAcao.quando)})</>}
                </li>
              ))}
            </ul>
          )}
          {i.planoAcao && <p className={styles.texto}>Plano: <Link href={linkPlano(i.planoAcao.id)}>{i.planoAcao.titulo}</Link></p>}
        </Cartao>
      )}

      <ol className={styles.perguntas}>
        {i.respostas.map((r) => {
          const k = classificar(r, notaMin);
          const nc = k === "NAO_CONFORME";
          const fotosR = fotos.get(r.id) ?? [];
          const sug = sugestaoRnc(i, r);
          return (
            <li key={r.id} id={`p${r.ordem}`} className={`${styles.pergunta} ${nc ? styles.perguntaNc : ""}`}>
              <div className={styles.cabecalhoPergunta}>
                <span className={styles.numeroPergunta}>{r.ordem}</span>
                <div className={styles.textoPergunta}>
                  <p className={styles.enunciado}>{r.pergunta}</p>
                  {r.ajuda && <p className={styles.ajuda}>{r.ajuda}</p>}
                  {r.obrigatorioFoto && <p className={styles.ajuda}>Foto obrigatória se não conforme.</p>}
                </div>
                <span className={`${styles.classe} ${styles[`classe_${k}`]}`}>{k === "PENDENTE" || k === "INFORMATIVA" ? ROTULO_CLASSE[k] : textoResposta(r)}</span>
              </div>

              {editar ? (
                <FormAcao acao={responderAcao} botao="Salvar resposta" tamanho="pequeno" className={styles.formResposta}>
                  <input type="hidden" name="inspecaoId" value={i.id} />
                  <input type="hidden" name="respostaId" value={r.id} />
                  {r.tipoResposta === "NOTA_1A5" ? (
                    <fieldset className={styles.segmentado}>
                      <legend className={styles.oculto}>Nota (abaixo de {notaMin} = não conforme)</legend>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className={n < notaMin ? styles.opcaoRuim : undefined}>
                          <input type="radio" name="nota" value={n} defaultChecked={r.nota === n} required />
                          <span>{n}</span>
                        </label>
                      ))}
                    </fieldset>
                  ) : r.tipoResposta === "TEXTO" ? (
                    <textarea name="texto" rows={2} defaultValue={r.texto ?? ""} required maxLength={4000} aria-label="Resposta" className={styles.area} />
                  ) : (
                    <fieldset className={styles.segmentado}>
                      <legend className={styles.oculto}>Resposta</legend>
                      {OPCOES_POR_TIPO[r.tipoResposta].map((v) => (
                        <label key={v} className={v === "NAO_CONFORME" || v === "NAO" ? styles.opcaoRuim : undefined}>
                          <input type="radio" name="resposta" value={v} defaultChecked={r.resposta === v} required />
                          <span>{ROTULO_VALOR[v]}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <input name="comentario" defaultValue={r.comentario ?? ""} maxLength={4000} placeholder="Comentário (opcional)" aria-label="Comentário" className={styles.entrada} />
                  {r.tipoResposta !== "TEXTO" && (
                    <CampoArquivos nome="fotos" rotulo="Fotos" ajuda="JPG, PNG, WEBP ou HEIC — até 5 por envio." />
                  )}
                </FormAcao>
              ) : (
                r.comentario && <p className={styles.comentario}>{r.comentario}</p>
              )}

              {fotosR.length > 0 && <GaleriaAnexos anexos={fotosR} fuso={fuso} />}

              {nc && (
                <div className={styles.acoesNc}>
                  {r.geradaRnc ? (
                    <p className={styles.gerado}>RNC <Link href={`/rncs/${r.geradaRnc.id}`}>{r.geradaRnc.codigo}</Link> · {ROTULO_STATUS[r.geradaRnc.status]}</p>
                  ) : (
                    exec && i.status !== "CANCELADA" && (
                      <details className={styles.detalhes}>
                        <summary>Abrir RNC</summary>
                        <FormAcao acao={abrirRncAcao} botao="Abrir RNC" tamanho="pequeno" className={styles.formNc}>
                          <input type="hidden" name="inspecaoId" value={i.id} />
                          <input type="hidden" name="respostaId" value={r.id} />
                          <label className={styles.campo}>Título<input name="titulo" defaultValue={sug.titulo} maxLength={200} className={styles.entrada} /></label>
                          <label className={styles.campo}>Descrição<textarea name="descricao" rows={4} defaultValue={sug.descricao} className={styles.area} /></label>
                          <div className={styles.linhaCampos}>
                            <label className={styles.campo}>Tipo
                              <select name="tipo" defaultValue={sug.tipo} className={styles.entrada}>
                                {(["QUALIDADE", "SSO", "MEIO_AMBIENTE"] as const).map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
                              </select>
                            </label>
                            <label className={styles.campo}>Gravidade
                              <select name="gravidade" defaultValue="MEDIA" className={styles.entrada}>
                                {(["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const).map((g) => <option key={g} value={g}>{ROTULO_GRAVIDADE[g]}</option>)}
                              </select>
                            </label>
                            <label className={styles.campo}>Responsável
                              <select name="responsavelId" defaultValue="" className={styles.entrada}>
                                <option value="">— definir depois —</option>
                                {op.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                              </select>
                            </label>
                          </div>
                          <p className={styles.ajuda}>Origem: Inspeção · obra {i.obra.nome}{fotosR.length ? ` · ${fotosR.length} foto(s) vão como evidência` : ""}.</p>
                        </FormAcao>
                      </details>
                    )
                  )}
                  {r.geradoItemAcao ? (
                    <p className={styles.gerado}>Item de ação <Link href={`/plano-acao/${r.geradoItemAcao.id}`}>{r.geradoItemAcao.oQue}</Link> · {r.geradoItemAcao.quem.nome} · {formatarData(r.geradoItemAcao.quando)}</p>
                  ) : (
                    exec && i.status !== "CANCELADA" && (
                      <details className={styles.detalhes}>
                        <summary>Criar apenas item de ação</summary>
                        <FormAcao acao={criarItemAcaoAcao} botao="Criar item" tamanho="pequeno" className={styles.formNc}>
                          <input type="hidden" name="inspecaoId" value={i.id} />
                          <input type="hidden" name="respostaId" value={r.id} />
                          <label className={styles.campo}>O quê<input name="oQue" defaultValue={`Corrigir: ${r.pergunta}`.slice(0, 500)} className={styles.entrada} /></label>
                          <div className={styles.linhaCampos}>
                            <label className={styles.campo}>Quem
                              <select name="quemId" required defaultValue={i.inspetor.id} className={styles.entrada}>
                                {op.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                              </select>
                            </label>
                            <label className={styles.campo}>Quando<input type="date" name="quando" required defaultValue={somarDias(hoje, 7)} className={styles.entrada} /></label>
                          </div>
                          <label className={styles.campo}>Como (opcional)<input name="como" className={styles.entrada} /></label>
                        </FormAcao>
                      </details>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editar && (
        <Cartao titulo="Finalizar">
          <FormAcao acao={concluirInspecaoAcao} botao="Concluir inspeção" className={styles.formFinal}>
            <input type="hidden" name="id" value={i.id} />
            <input type="hidden" name="versao" value={i.versao} />
            <label className={styles.campo}>Observações gerais (opcional)
              <textarea name="observacoes" rows={3} maxLength={4000} defaultValue={i.observacoes ?? ""} className={styles.area} />
            </label>
          </FormAcao>
          {gerados.length === 0 && (
            <details className={styles.detalhes}>
              <summary>Cancelar inspeção</summary>
              <FormAcao acao={cancelarInspecaoAcao} botao="Cancelar inspeção" variante="perigo" tamanho="pequeno" className={styles.formFinal} confirmar="Cancelar esta inspeção?">
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="versao" value={i.versao} />
                <input name="motivo" required minLength={3} placeholder="Motivo" aria-label="Motivo do cancelamento" className={styles.entrada} />
              </FormAcao>
            </details>
          )}
        </Cartao>
      )}

      <Interacoes a={a} tipo="INSPECAO" entidadeId={i.id} usuarios={op.usuarios} fuso={fuso} />
    </div>
  );
}
