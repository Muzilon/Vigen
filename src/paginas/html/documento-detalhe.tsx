import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelarDocumentoAcao,
  enviarAprovacaoAcao,
  novaRevisaoAcao,
  obsoletarDocumentoAcao,
  publicarAcao,
  registrarCienciaAcao,
  substituirArquivoAcao,
} from "@/app/(app)/documentos/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import { podeElaborarDocumentos, podeGerenciarDocumentos } from "@/lib/documentos/acesso";
import { formatarRevisao, revisaoVencida, ROTULO_ACAO_DOCUMENTO, ROTULO_STATUS_DOCUMENTO, ROTULO_STATUS_VERSAO, rotuloRevisao } from "@/lib/documentos/regras";
import {
  listarHistorico,
  listarVersoes,
  meusDocumentos,
  obterDocumento,
  opcoesDocumentos,
  situacaoCienciasDocumento,
} from "@/lib/documentos/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { AprovacoesDaEntidade } from "@/paginas/html/componentes/aprovacoes-da-entidade";
import { BadgeAtrasado, BadgeStatusDocumento } from "@/paginas/html/componentes/badge";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { TrilhaAssinaturas } from "@/paginas/html/componentes/trilha-assinaturas";
import { ACEITAR_DOCUMENTO } from "@/paginas/html/documento-novo-formulario";
import { DocumentoEnvio } from "@/paginas/html/documento-envio";
import styles from "@/paginas/css/documento-detalhe.module.css";

const tamanho = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Detalhe do documento: dados, revisão em trabalho (envio, trilha, publicação), versões, publicação, ciências, aprovações e histórico. */
export default async function DocumentoDetalhe({ params }: PageProps<"/documentos/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "DOCUMENTOS");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const d = await obterDocumento(a, id);
  if (!d) notFound();
  const [versoes, historico, ciencias, op, fuso, meus] = await Promise.all([
    listarVersoes(a, id),
    listarHistorico(a, id),
    situacaoCienciasDocumento(a, id),
    opcoesDocumentos(a),
    fusoDaEmpresa(a),
    meusDocumentos(a),
  ]);
  const hoje = hojeNoFuso(fuso);
  const meu = meus.find((m) => m.id === id);
  const vigente = d.versaoVigente;
  const pub = vigente?.publicacao ?? null;
  const vencida = !!vigente && revisaoVencida(d.proximaRevisaoEm ? dataIso(d.proximaRevisaoEm) : null, hoje);
  const trabalho = versoes.find((v) => v.status === "RASCUNHO" || v.status === "EM_APROVACAO" || v.status === "APROVADA") ?? null;
  const elabora = podeElaborarDocumentos(a);
  const gerencia = podeGerenciarDocumentos(a);
  const finalizado = d.status === "OBSOLETO" || d.status === "CANCELADO";
  const nome = (lista: { id: string; nome: string }[]) => new Map(lista.map((x) => [x.id, x.nome]));
  const [nSetor, nObra, nPerfil, nUsuario] = [nome(op.setores), nome(op.obras), nome(op.perfis), nome(op.usuarios)];
  const descreverPublico = (p: NonNullable<typeof pub>) =>
    p.publicoTodos
      ? ["Todos os usuários da empresa"]
      : [
          ...p.setorIds.map((x) => `Setor: ${nSetor.get(x) ?? "?"}`),
          ...p.obraIds.map((x) => `Obra/unidade: ${nObra.get(x) ?? "?"}`),
          ...p.perfilIds.map((x) => `Perfil: ${nPerfil.get(x) ?? "?"}`),
          ...p.usuarioIds.map((x) => nUsuario.get(x) ?? "?"),
        ];
  const podeCiencia = !!meu && meu.exigirCiencia && !meu.cienciaEm;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href={d.acessoCompleto && elabora ? "/documentos" : "/documentos/meus"} className={styles.linkVoltar}>
          ← {d.acessoCompleto && elabora ? "Lista mestra de documentos" : "Meus documentos"}
        </Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{d.codigo} · {d.tipo.nome}</p>
          <h1 className={styles.titulo}>{d.titulo}</h1>
          <p className={styles.meta}>
            <BadgeStatusDocumento status={d.status} rotulo={ROTULO_STATUS_DOCUMENTO[d.status]} />
            <span>Revisão vigente: <strong>{vigente ? formatarRevisao(vigente.numero) : "—"}</strong></span>
            <span>Responsável: {d.responsavel.nome}</span>
            {vencida && <BadgeAtrasado>Revisão periódica vencida em {formatarData(d.proximaRevisaoEm)}</BadgeAtrasado>}
          </p>
        </div>
        {vigente?.anexo && !vigente.anexo.excluidoEm && (
          <a href={`/api/anexos/${vigente.anexo.id}`} className={styles.botaoBaixar}>Baixar {rotuloRevisao(vigente.numero)}</a>
        )}
      </header>

      {meu?.exigirCiencia && (
        <div className={meu.cienciaEm ? styles.cienciaOk : styles.cienciaPendente}>
          {meu.cienciaEm ? (
            <span>Você registrou ciência desta revisão em {formatarDataHora(meu.cienciaEm, fuso)}.</span>
          ) : (
            <>
              <span>Esta revisão exige ciência: leia o documento e confirme.</span>
              {podeCiencia && (
                <FormAcao acao={registrarCienciaAcao} botao="Li e estou ciente" tamanho="pequeno">
                  <input type="hidden" name="id" value={d.id} />
                </FormAcao>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo="Dados">
            <dl className={styles.dados}>
              <dt>Tipo</dt>
              <dd>{d.tipo.sigla} — {d.tipo.nome}</dd>
              {d.descricao && (
                <>
                  <dt>Descrição</dt>
                  <dd>{d.descricao}</dd>
                </>
              )}
              <dt>Processo</dt>
              <dd>{d.processo ? <Link href={`/processos/${d.processo.id}`}>{d.processo.codigo} — {d.processo.nome}</Link> : "—"}</dd>
              <dt>Obra / setor</dt>
              <dd>{d.obra?.nome ?? "Toda a empresa"}{d.setor ? ` · ${d.setor.nome}` : ""}</dd>
              <dt>Revisão periódica</dt>
              <dd>
                A cada {d.periodicidadeRevisaoMeses} {d.periodicidadeRevisaoMeses === 1 ? "mês" : "meses"} · próxima em{" "}
                <span className={vencida ? styles.vencida : undefined}>{formatarData(d.proximaRevisaoEm)}{vencida ? " (vencida)" : ""}</span>
              </dd>
              {vigente && (
                <>
                  <dt>Vigente</dt>
                  <dd>{rotuloRevisao(vigente.numero)} — {vigente.motivo} · publicada em {formatarData(vigente.publicadoEm)}</dd>
                </>
              )}
              {d.chavePlanilha && (
                <>
                  <dt>Origem</dt>
                  <dd>Planilha controlada gerada pela tramitação das aprovações ({d.chavePlanilha.split(":")[0]}).</dd>
                </>
              )}
              <dt>Cadastro</dt>
              <dd>{d.criadoPor.nome} · {formatarDataHora(d.criadoEm, fuso)}</dd>
            </dl>
          </Cartao>

          {d.acessoCompleto && trabalho && (
            <Cartao titulo={`${rotuloRevisao(trabalho.numero)} em trabalho · ${ROTULO_STATUS_VERSAO[trabalho.status]}`}>
              <p className={styles.texto}><strong>Motivo:</strong> {trabalho.motivo}</p>
              <p className={styles.texto}>
                <strong>Arquivo:</strong>{" "}
                {trabalho.anexo ? <a href={`/api/anexos/${trabalho.anexo.id}`}>{trabalho.anexo.nomeArquivo}</a> : "—"}
                {trabalho.anexo && <span className={styles.suave}> · {tamanho(trabalho.anexo.tamanhoBytes)} · elaborado por {trabalho.elaborador.nome}</span>}
              </p>

              {trabalho.fluxoAprovacao && trabalho.status !== "RASCUNHO" && (
                <div className={styles.bloco}>
                  <p className={styles.subtitulo}>
                    Trilha de revisão/aprovação — <Link href={`/aprovacoes/${trabalho.fluxoAprovacao.id}`}>abrir em Aprovações</Link>
                  </p>
                  <TrilhaAssinaturas
                    etapas={trabalho.fluxoAprovacao.etapas}
                    modo={trabalho.fluxoAprovacao.modo}
                    fuso={fuso}
                    solicitante={{ nome: trabalho.fluxoAprovacao.solicitante.nome, em: trabalho.criadoEm }}
                  />
                  <PapeisFluxo payload={trabalho.fluxoAprovacao.payload} nomes={nUsuario} />
                </div>
              )}

              {trabalho.status === "RASCUNHO" && elabora && (
                <>
                  <details className={styles.editar}>
                    <summary>Trocar o arquivo da revisão</summary>
                    <FormAcao acao={substituirArquivoAcao} botao="Substituir arquivo" tamanho="pequeno" className={styles.formulario}>
                      <input type="hidden" name="id" value={d.id} />
                      <label className={styles.campoLargo}>
                        Novo arquivo <input type="file" name="arquivo" required accept={ACEITAR_DOCUMENTO} />
                      </label>
                      <label className={styles.campoLargo}>
                        Motivo (opcional, substitui o atual) <input name="motivo" maxLength={1000} className={styles.entrada} />
                      </label>
                    </FormAcao>
                  </details>
                  <div className={styles.bloco}>
                    <p className={styles.subtitulo}>Enviar para revisão e aprovação</p>
                    <DocumentoEnvio
                      acao={enviarAprovacaoAcao}
                      documentoId={d.id}
                      versao={d.versao}
                      usuarios={op.usuarios.filter((u) => u.id !== a.usuarioId)}
                      resumo={`${d.codigo} ${rotuloRevisao(trabalho.numero)} — ${d.titulo}`.slice(0, 300)}
                    />
                  </div>
                </>
              )}

              {trabalho.status === "APROVADA" && gerencia && (
                <div className={styles.bloco}>
                  <p className={styles.subtitulo}>Publicar {rotuloRevisao(trabalho.numero)}{vigente ? ` (a ${rotuloRevisao(vigente.numero)} ficará obsoleta)` : ""}</p>
                  <FormAcao acao={publicarAcao} botao="Publicar" className={styles.formPublicar}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="versao" value={d.versao} />
                    <label className={styles.opcaoDestaque}>
                      <input type="checkbox" name="publicoTodos" /> Todos os usuários da empresa
                    </label>
                    <p className={styles.suave}>Ou escolha o público (união dos critérios marcados):</p>
                    <GrupoMarcar titulo="Setores" nome="setorIds" itens={op.setores} />
                    <GrupoMarcar titulo="Obras / unidades" nome="obraIds" itens={op.obras} />
                    <GrupoMarcar titulo="Perfis" nome="perfilIds" itens={op.perfis} />
                    <GrupoMarcar titulo="Usuários" nome="usuarioIds" itens={op.usuarios} />
                    <label className={styles.opcao}><input type="checkbox" name="notificar" defaultChecked /> Notificar o público (sino e e-mail)</label>
                    <label className={styles.opcao}><input type="checkbox" name="exigirCiencia" /> Exigir ciência (&quot;Li e estou ciente&quot;)</label>
                  </FormAcao>
                </div>
              )}
              {trabalho.status === "APROVADA" && !gerencia && <p className={styles.suave}>Aprovada — aguardando publicação por um gestor de documentos.</p>}

              {(trabalho.status === "RASCUNHO" || trabalho.status === "APROVADA") && elabora && (
                <details className={styles.editar}>
                  <summary>{vigente ? "Cancelar esta revisão" : "Cancelar o documento"}</summary>
                  <FormAcao
                    acao={cancelarDocumentoAcao}
                    botao={vigente ? "Cancelar revisão" : "Cancelar documento"}
                    variante="perigo"
                    tamanho="pequeno"
                    className={styles.formLinha}
                    confirmar={vigente ? "Cancelar esta revisão? A revisão vigente continua valendo." : "Cancelar o documento? Esta ação é definitiva."}
                  >
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="versao" value={d.versao} />
                    <input name="motivo" required minLength={3} placeholder="Motivo" aria-label="Motivo do cancelamento" className={styles.entrada} />
                  </FormAcao>
                </details>
              )}
            </Cartao>
          )}

          {d.acessoCompleto && !trabalho && d.status === "PUBLICADO" && elabora && !d.chavePlanilha && (
            <Cartao titulo="Nova revisão">
              <p className={styles.suave}>A nova revisão parte da vigente ({vigente ? rotuloRevisao(vigente.numero) : "—"}), que continua valendo até a publicação da próxima.</p>
              <FormAcao acao={novaRevisaoAcao} botao="Criar nova revisão" tamanho="pequeno" className={styles.formulario}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="versao" value={d.versao} />
                <label className={styles.campoLargo}>
                  Motivo / descrição da alteração <input name="motivo" required minLength={3} maxLength={1000} className={styles.entrada} />
                </label>
                <label className={styles.campoLargo}>
                  Arquivo revisado <input type="file" name="arquivo" required accept={ACEITAR_DOCUMENTO} />
                </label>
              </FormAcao>
            </Cartao>
          )}

          {d.acessoCompleto && (
            <Cartao titulo={`Versões · ${versoes.length}`}>
              <div className={styles.quadro}>
                <table className={styles.tabela}>
                  <thead>
                    <tr><th>Rev.</th><th>Motivo</th><th>Status</th><th>Arquivo</th><th>Elaborada</th><th>Aprovada</th><th>Publicada</th><th>Obsoleta</th></tr>
                  </thead>
                  <tbody>
                    {versoes.map((v) => (
                      <tr key={v.id} className={v.status === "PUBLICADA" ? styles.linhaVigente : undefined}>
                        <td className={styles.mono}>{formatarRevisao(v.numero)}</td>
                        <td>{v.motivo}</td>
                        <td>{ROTULO_STATUS_VERSAO[v.status]}</td>
                        <td>
                          {v.anexo ? (
                            <a href={`/api/anexos/${v.anexo.id}`}>{v.anexo.nomeArquivo}</a>
                          ) : v.conteudo ? (
                            <a href={`/documentos/${d.id}/versoes/${v.id}/conteudo`}>snapshot.json</a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{v.elaborador.nome}<br /><span className={styles.suave}>{formatarData(v.criadoEm)}</span></td>
                        <td>{formatarData(v.aprovadoEm)}</td>
                        <td>{v.publicadoEm ? <>{formatarData(v.publicadoEm)}<br /><span className={styles.suave}>{v.publicadoPor?.nome}</span></> : "—"}</td>
                        <td>{formatarData(v.obsoletoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {gerencia && vigente && !finalizado && d.status !== "EM_REVISAO" && d.status !== "EM_APROVACAO" && (
                <details className={styles.editar}>
                  <summary>Retirar de uso (tornar obsoleto)</summary>
                  <FormAcao
                    acao={obsoletarDocumentoAcao}
                    botao="Tornar obsoleto"
                    variante="perigo"
                    tamanho="pequeno"
                    className={styles.formLinha}
                    confirmar="Tornar o documento obsoleto? A revisão vigente deixa de valer para todos."
                  >
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="versao" value={d.versao} />
                    <input name="motivo" required minLength={3} placeholder="Motivo" aria-label="Motivo da obsolescência" className={styles.entrada} />
                  </FormAcao>
                </details>
              )}
            </Cartao>
          )}
        </div>

        <div className={styles.coluna}>
          {pub && (
            <Cartao titulo="Publicação vigente">
              <ul className={styles.publico}>
                {descreverPublico(pub).map((x) => <li key={x}>{x}</li>)}
              </ul>
              <p className={styles.suave}>
                {formatarDataHora(pub.publicadoEm, fuso)} · {pub.notificar ? "público notificado" : "sem notificação"} · {pub.exigirCiencia ? "exige ciência" : "sem ciência obrigatória"}
              </p>
            </Cartao>
          )}

          {d.acessoCompleto && ciencias?.exigirCiencia && (
            <Cartao titulo={`Ciências · ${ciencias.confirmaram.length} de ${ciencias.total}`}>
              <progress className={styles.progresso} max={Math.max(ciencias.total, 1)} value={ciencias.confirmaram.length} aria-label="Ciências confirmadas" />
              <div className={styles.ciencias}>
                <div>
                  <p className={styles.subtitulo}>Confirmaram</p>
                  {ciencias.confirmaram.length === 0 ? <p className={styles.suave}>Ninguém ainda.</p> : (
                    <ul className={styles.listaPessoas}>
                      {ciencias.confirmaram.map((c) => <li key={c.id}>✓ {c.nome} <span className={styles.suave}>{formatarDataHora(c.em, fuso)}</span></li>)}
                    </ul>
                  )}
                </div>
                <div>
                  <p className={styles.subtitulo}>Faltam</p>
                  {ciencias.faltam.length === 0 ? <p className={styles.suave}>Todos confirmaram.</p> : (
                    <ul className={styles.listaPessoas}>
                      {ciencias.faltam.map((c) => <li key={c.id}>○ {c.nome}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </Cartao>
          )}

          {d.acessoCompleto && <AprovacoesDaEntidade entidadeTipo="DOCUMENTO" entidadeId={d.id} titulo="Aprovações (trilha)" />}

          {d.acessoCompleto && (
            <Cartao titulo={`Histórico · ${historico.length}`}>
              <ol className={styles.historico}>
                {historico.map((h) => (
                  <li key={h.id} className={styles.eventoHistorico}>
                    <div className={styles.cabecalhoEvento}>
                      <strong>{ROTULO_ACAO_DOCUMENTO[h.acao]}{h.versao ? ` · ${rotuloRevisao(h.versao.numero)}` : ""}</strong>
                      <span>{formatarDataHora(h.criadoEm, fuso)} · {h.usuario.nome}</span>
                    </div>
                    {h.observacao && <p className={styles.observacao}>{h.observacao}</p>}
                  </li>
                ))}
              </ol>
            </Cartao>
          )}

          {d.acessoCompleto && <Interacoes a={a} tipo="DOCUMENTO" entidadeId={d.id} usuarios={op.usuarios} fuso={fuso} />}
        </div>
      </div>
    </div>
  );
}

function GrupoMarcar({ titulo, nome, itens }: { titulo: string; nome: string; itens: { id: string; nome: string }[] }) {
  if (itens.length === 0) return null;
  return (
    <fieldset className={styles.grupoMarcar}>
      <legend>{titulo}</legend>
      <div className={styles.opcoes}>
        {itens.map((i) => (
          <label key={i.id} className={styles.opcao}>
            <input type="checkbox" name={nome} value={i.id} /> {i.nome}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PapeisFluxo({ payload, nomes }: { payload: unknown; nomes: Map<string, string> }) {
  const p = (payload ?? {}) as { revisorIds?: string[]; aprovadorIds?: string[] };
  if (!p.revisorIds && !p.aprovadorIds) return null;
  const lista = (ids?: string[]) => (ids?.length ? ids.map((x) => nomes.get(x) ?? "?").join(", ") : "—");
  return (
    <p className={styles.suave}>
      Revisores: {lista(p.revisorIds)} · Aprovadores: {lista(p.aprovadorIds)}
    </p>
  );
}
