import Link from "next/link";
import { notFound } from "next/navigation";
import { definirAtivoTreinamentoAcao, editarTreinamentoAcao, lancarPresencasAcao, registrarSessaoAcao } from "@/app/(app)/treinamentos/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { ROTULO_STATUS_COMPETENCIA, ROTULO_TIPO_TREINAMENTO, statusCompetencia } from "@/lib/treinamentos/regras";
import { matrizCompetencias, obterTreinamento, opcoesTreinamentos, podeGerenciarTreinamentos } from "@/lib/treinamentos/servico";
import { BadgeStatusCompetencia } from "@/paginas/html/componentes/badge";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { CamposTreinamento } from "@/paginas/html/treinamento-formulario";
import styles from "@/paginas/css/treinamento-detalhe.module.css";

/**
 * Detalhe do treinamento: dados/edição, situação da equipe, registrar sessão e, por sessão, presença em lote com
 * certificado por pessoa (quem gerencia). Os demais veem o catálogo e a própria participação/certificado.
 */
export default async function TreinamentoDetalhe({ params }: PageProps<"/treinamentos/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "TREINAMENTOS");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const t = await obterTreinamento(a, id);
  if (!t) notFound();
  const g = podeGerenciarTreinamentos(a);
  const [op, fuso, matriz] = await Promise.all([opcoesTreinamentos(a), fusoDaEmpresa(a), g ? matrizCompetencias(a, { treinamentoId: id }) : null]);
  const hoje = hojeNoFuso(fuso);
  const nomeSetor = new Map(op.setores.map((s) => [s.id, s.nome]));
  const pendentes = matriz
    ? matriz.linhas.map((l) => ({ usuario: l.usuario, celula: l.celulas[0] })).filter((x) => x.celula && (x.celula.status === "VENCIDO" || x.celula.status === "A_VENCER" || x.celula.status === "NAO_REALIZADO"))
    : [];

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/treinamentos" className={styles.linkVoltar}>← Treinamentos</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{ROTULO_TIPO_TREINAMENTO[t.tipo]}{t.cargaHoraria ? ` · ${t.cargaHoraria} h` : ""} · {t.validadeMeses ? `validade de ${t.validadeMeses} meses` : "não vence"}</p>
          <h1 className={styles.titulo}>{t.nome}</h1>
          <p className={styles.meta}>
            <span>
              Obrigatório para:{" "}
              {t.obrigatorioTodos ? "todos" : t.obrigatorioSetorIds.length ? t.obrigatorioSetorIds.map((s) => nomeSetor.get(s) ?? "?").join(", ") : "ninguém (opcional)"}
            </span>
            <span>{t.sessoes.length} sessão(ões)</span>
            {!t.ativo && <span className={styles.inativo}>Inativo</span>}
          </p>
        </div>
        {g && (
          <FormAcao acao={definirAtivoTreinamentoAcao} botao={t.ativo ? "Inativar" : "Reativar"} variante={t.ativo ? "perigo" : "secundario"} tamanho="pequeno" confirmar={t.ativo ? "Inativar o treinamento? Sessões e certificados são preservados." : undefined}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="ativo" value={t.ativo ? "0" : "1"} />
          </FormAcao>
        )}
      </header>

      <div className={styles.grade}>
        <div className={styles.coluna}>
          {g && t.ativo && (
            <Cartao titulo="Registrar sessão realizada">
              <FormAcao acao={registrarSessaoAcao} botao="Registrar sessão" tamanho="pequeno" className={styles.formulario}>
                <input type="hidden" name="treinamentoId" value={t.id} />
                <div className={styles.linhaCampos}>
                  <label className={styles.campo}>Data de realização
                    <input type="date" name="dataRealizacao" required max={hoje} defaultValue={hoje} className={styles.entrada} />
                  </label>
                  <label className={styles.campo}>Instrutor
                    <input name="instrutor" required maxLength={200} placeholder="Nome / empresa" className={styles.entrada} />
                  </label>
                  <label className={styles.campo}>Unidade (opcional)
                    <select name="obraId" defaultValue="" className={styles.entrada}>
                      <option value="">— Empresa —</option>
                      {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </label>
                  <label className={styles.campo}>Carga horária (h)
                    <input type="number" name="cargaHoraria" min={1} max={1000} defaultValue={t.cargaHoraria ?? ""} className={styles.entrada} />
                  </label>
                </div>
                <label className={styles.campo}>Observação
                  <input name="observacao" maxLength={2000} className={styles.entrada} />
                </label>
              </FormAcao>
            </Cartao>
          )}

          {t.sessoes.length === 0 && <Cartao titulo="Sessões"><p className={styles.vazio}>Nenhuma sessão registrada.</p></Cartao>}

          {t.sessoes.map((s) => {
            const porUsuario = new Map(s.participacoes.map((p) => [p.usuarioId, p]));
            const presentes = s.participacoes.filter((p) => p.presente).length;
            return (
              <section key={s.id} id={`sessao-${s.id}`}>
                <Cartao titulo={`Sessão de ${formatarData(s.dataRealizacao)} · ${s.instrutor}`}>
                  <p className={styles.infoSessao}>
                    {s.obra ? `${s.obra.nome} · ` : ""}{s.cargaHoraria ? `${s.cargaHoraria} h · ` : ""}{g ? `${presentes} presente(s), ${s.participacoes.length - presentes} ausente(s)` : ""}
                    {s.observacao ? ` · ${s.observacao}` : ""}
                  </p>
                  {g ? (
                    <FormAcao acao={lancarPresencasAcao} botao="Salvar presença e certificados" tamanho="pequeno" className={styles.formulario}>
                      <input type="hidden" name="sessaoId" value={s.id} />
                      <input type="hidden" name="treinamentoId" value={t.id} />
                      <div className={styles.quadro}>
                        <table className={styles.tabela}>
                          <thead>
                            <tr><th scope="col">Participante</th><th scope="col">Presença</th><th scope="col">Aproveitamento</th><th scope="col">Certificado</th></tr>
                          </thead>
                          <tbody>
                            {op.usuarios.map((u) => {
                              const p = porUsuario.get(u.id);
                              return (
                                <tr key={u.id} className={p ? styles.linhaMarcada : undefined}>
                                  <td>
                                    <input type="hidden" name="usuarios" value={u.id} />
                                    {u.nome}
                                  </td>
                                  <td>
                                    <select name={`presenca_${u.id}`} defaultValue={p ? (p.presente ? "P" : "A") : ""} aria-label={`Presença de ${u.nome}`} className={styles.entradaPequena}>
                                      <option value="">—</option>
                                      <option value="P">Presente</option>
                                      <option value="A">Ausente</option>
                                    </select>
                                  </td>
                                  <td>
                                    <input name={`aproveitamento_${u.id}`} maxLength={60} defaultValue={p?.aproveitamento ?? ""} placeholder="Ex.: 9,0 / apto" aria-label={`Aproveitamento de ${u.nome}`} className={styles.entradaPequena} />
                                  </td>
                                  <td className={styles.certificado}>
                                    {p?.certificado && <a href={`/api/anexos/${p.certificado.id}`} className={styles.link}>{p.certificado.nomeArquivo}</a>}
                                    <input type="file" name={`certificado_${u.id}`} accept="application/pdf,image/png,image/jpeg" aria-label={`Certificado de ${u.nome}`} className={styles.arquivo} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className={styles.dica}>&quot;—&quot; = não convocado para esta sessão. A validade é calculada: data da sessão + validade do treinamento.</p>
                    </FormAcao>
                  ) : s.participacoes.length ? (
                    s.participacoes.map((p) => (
                      <p key={p.id} className={styles.infoSessao}>
                        Você: {p.presente ? "presente" : "ausente"}
                        {p.dataValidade ? ` · válido até ${formatarData(p.dataValidade)}` : ""}
                        {p.certificado && <> · <a href={`/api/anexos/${p.certificado.id}`} className={styles.link}>certificado</a></>}
                      </p>
                    ))
                  ) : (
                    <p className={styles.vazio}>Você não participou desta sessão.</p>
                  )}
                </Cartao>
              </section>
            );
          })}
        </div>

        <div className={styles.coluna}>
          {matriz && (
            <Cartao titulo="Situação da equipe">
              <p className={styles.resumo}>
                <strong className={styles.numero}>{matriz.resumo.percentualEmDia === null ? "—" : `${matriz.resumo.percentualEmDia}%`}</strong> em dia entre os obrigados ·{" "}
                {matriz.resumo.aVencer} a vencer · {matriz.resumo.vencidos} vencido(s) · {matriz.resumo.naoRealizados} não realizado(s)
              </p>
              {pendentes.length === 0 ? (
                <p className={styles.vazio}>Ninguém pendente neste treinamento.</p>
              ) : (
                <ul className={styles.pendentes}>
                  {pendentes.map((x) => (
                    <li key={x.usuario.id}>
                      <span>{x.usuario.nome}</span>
                      <span className={styles.vazio}>{x.celula.dataValidade ? formatarData(x.celula.dataValidade) : ""}</span>
                      <BadgeStatusCompetencia status={x.celula.status!} rotulo={ROTULO_STATUS_COMPETENCIA[x.celula.status!]} />
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.dica}><Link href={`/treinamentos/matriz?treinamento=${t.id}`} className={styles.link}>Ver na matriz de competências →</Link></p>
            </Cartao>
          )}

          {!g && (
            <Cartao titulo="Sua situação">
              {(() => {
                const minhas = t.sessoes.flatMap((s) => s.participacoes.filter((p) => p.presente).map((p) => ({ data: dataIso(s.dataRealizacao), validade: p.dataValidade ? dataIso(p.dataValidade) : null })));
                const ultima = minhas.sort((x, y) => y.data.localeCompare(x.data))[0] ?? null;
                const st = statusCompetencia(ultima ? { dataValidade: ultima.validade } : null, hoje);
                return <p className={styles.resumo}><BadgeStatusCompetencia status={st} rotulo={ROTULO_STATUS_COMPETENCIA[st]} /> {ultima ? `realizado em ${formatarData(ultima.data)}${ultima.validade ? `, válido até ${formatarData(ultima.validade)}` : ""}` : ""}</p>;
              })()}
            </Cartao>
          )}

          <Cartao titulo="Dados do treinamento">
            <dl className={styles.dados}>
              <dt>Descrição</dt>
              <dd>{t.descricao ?? "—"}</dd>
              <dt>Cadastro</dt>
              <dd>{t.criadoPor.nome} · {formatarDataHora(t.criadoEm, fuso)}</dd>
            </dl>
            {g && (
              <details className={styles.editar}>
                <summary>Editar treinamento</summary>
                <FormAcao acao={editarTreinamentoAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="versao" value={t.versao} />
                  <CamposTreinamento
                    v={{
                      nome: t.nome,
                      tipo: t.tipo,
                      descricao: t.descricao ?? "",
                      cargaHoraria: t.cargaHoraria ? String(t.cargaHoraria) : "",
                      validadeMeses: t.validadeMeses ? String(t.validadeMeses) : "",
                      obrigatorioTodos: t.obrigatorioTodos,
                      obrigatorioSetorIds: t.obrigatorioSetorIds,
                    }}
                    setores={op.setores}
                  />
                </FormAcao>
                <p className={styles.dica}>Mudar a validade recalcula a validade de todas as participações já lançadas.</p>
              </details>
            )}
          </Cartao>

          <Interacoes a={a} tipo="TREINAMENTO" entidadeId={t.id} usuarios={op.usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}
