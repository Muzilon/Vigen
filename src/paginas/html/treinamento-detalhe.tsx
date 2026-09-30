import Link from "next/link";
import { notFound } from "next/navigation";
import {
  avaliarEficaciaAcao,
  definirAtivoTreinamentoAcao,
  editarTreinamentoAcao,
  excluirGatilhoAcao,
  lancarPresencasAcao,
  registrarGatilhoAcao,
  registrarSessaoAcao,
} from "@/app/(app)/treinamentos/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import {
  MODALIDADES,
  MOTIVOS_GATILHO,
  pendenciasNr1,
  ROTULO_MODALIDADE,
  ROTULO_MOTIVO_GATILHO,
  ROTULO_SITUACAO_EFICACIA,
  ROTULO_STATUS_COMPETENCIA,
  ROTULO_TIPO_TREINAMENTO,
  situacaoEficacia,
  statusCompetencia,
  STATUS_PENDENTES,
} from "@/lib/treinamentos/regras";
import { matrizCompetencias, obterTreinamento, opcoesTreinamentos, podeGerenciarTreinamentos } from "@/lib/treinamentos/servico";
import { BadgeEficacia, BadgeStatusCompetencia } from "@/paginas/html/componentes/badge";
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
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Treinamentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "TREINAMENTOS");
  // `id`: o identificador do treinamento, tirado do endereço.
  const { id } = await params;
  // Id em formato inválido → página 404.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca o treinamento com sessões, participações, gatilhos e documento de conscientização.
  const t = await obterTreinamento(a, id);
  // Treinamento inexistente ou sem acesso → 404.
  if (!t) notFound();
  // `g`: pode gerenciar treinamentos (registrar sessões, lançar presença, avaliar eficácia). Os demais só veem a própria participação.
  const g = podeGerenciarTreinamentos(a);
  // Busca em paralelo as opções, o fuso horário e (só para quem gerencia) a situação da equipe neste treinamento.
  const [op, fuso, matriz] = await Promise.all([opcoesTreinamentos(a), fusoDaEmpresa(a), g ? matrizCompetencias(a, { treinamentoId: id }) : null]);
  // Data de hoje no fuso da empresa.
  const hoje = hojeNoFuso(fuso);
  // Dicionário id do setor → nome.
  const nomeSetor = new Map(op.setores.map((s) => [s.id, s.nome]));
  // Dicionário id da função → nome.
  const nomeFuncao = new Map(op.funcoes.map((f) => [f.id, f.nome]));
  // Texto do público obrigatório ("setor X", "função Y") para o cabeçalho.
  const publicoObrigatorio = [...t.obrigatorioSetorIds.map((s) => `setor ${nomeSetor.get(s) ?? "?"}`), ...t.obrigatorioFuncaoIds.map((f) => `função ${nomeFuncao.get(f) ?? "?"}`)];
  // Pessoas com este treinamento a vencer, vencido ou não realizado (só para quem gerencia).
  const pendentes = matriz
    ? matriz.linhas.map((l) => ({ usuario: l.usuario, celula: l.celulas[0] })).filter((x) => x.celula?.status && (x.celula.status === "A_VENCER" || STATUS_PENDENTES.includes(x.celula.status)))
    : [];
  // O treinamento é do tipo NR ou reciclagem? Então os campos da NR-1 (qualificação, conteúdo) ficam destacados.
  const nr1 = t.tipo === "NR" || t.tipo === "RECICLAGEM";

  return (
    <div className={`${styles.pagina} fonteBase`}>
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
              {t.obrigatorioTodos ? "todos" : publicoObrigatorio.length ? publicoObrigatorio.join(", ") : "ninguém (opcional)"}
            </span>
            <span>{t.sessoes.length} sessão(ões)</span>
            {t.critico && <span className={styles.critico}>Crítico para aptidão</span>}
            {t.documento && <span>Conscientização: ciência de <Link href={`/documentos/${t.documento.id}`} className={styles.link}>{t.documento.codigo}</Link></span>}
            {t.diasAvaliacaoEficacia && <span>Eficácia avaliada {t.diasAvaliacaoEficacia} dias após a sessão</span>}
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
                <div className={styles.linhaCampos}>
                  <label className={styles.campo}>Modalidade
                    <select name="modalidade" defaultValue="PRESENCIAL" className={styles.entrada}>
                      {MODALIDADES.map((m) => <option key={m} value={m}>{ROTULO_MODALIDADE[m]}</option>)}
                    </select>
                  </label>
                  <label className={`${styles.campo} ${styles.campoTriplo}`}>Qualificação do instrutor{nr1 ? " (NR-1)" : ""}
                    <input name="qualificacaoInstrutor" maxLength={500} placeholder="Ex.: Téc. Segurança do Trabalho, registro MTE 12345" className={styles.entrada} />
                  </label>
                </div>
                <label className={styles.campo}>Conteúdo programático{nr1 ? " (NR-1)" : ""}
                  <textarea name="conteudoProgramatico" rows={2} maxLength={4000} defaultValue={t.descricao ?? ""} className={styles.entrada} />
                </label>
                <label className={styles.campo}>Observação
                  <input name="observacao" maxLength={2000} className={styles.entrada} />
                </label>
              </FormAcao>
            </Cartao>
          )}

          {t.sessoes.length === 0 && <Cartao titulo="Sessões"><p className={styles.vazio}>Nenhuma sessão registrada.</p></Cartao>}

          {t.sessoes.map((s) => {
            // Dicionário usuário → participação nesta sessão.
            const porUsuario = new Map(s.participacoes.map((p) => [p.usuarioId, p]));
            // Quantas pessoas estiveram presentes na sessão.
            const presentes = s.participacoes.filter((p) => p.presente).length;
            // Pendências da sessão frente à NR-1 (lista vazia = conforme; vazio/nulo = não se aplica).
            const pend = pendenciasNr1(t, s);
            // Data da sessão em texto AAAA-MM-DD.
            const dataSessao = dataIso(s.dataRealizacao);
            // Participantes presentes cuja eficácia já pode (ou poderia) ser avaliada, com a situação de cada um.
            const avaliaveis = s.participacoes
              .filter((p) => p.presente)
              .map((p) => ({ p, situacao: situacaoEficacia(p, dataSessao, t.diasAvaliacaoEficacia, hoje) }))
              .filter((x) => x.situacao);
            return (
              <section key={s.id} id={`sessao-${s.id}`}>
                <Cartao titulo={`Sessão de ${formatarData(s.dataRealizacao)} · ${s.instrutor}`}>
                  <p className={styles.infoSessao}>
                    {s.obra ? `${s.obra.nome} · ` : ""}{s.cargaHoraria ? `${s.cargaHoraria} h · ` : ""}{g ? `${presentes} presente(s), ${s.participacoes.length - presentes} ausente(s)` : ""}
                    {s.observacao ? ` · ${s.observacao}` : ""}
                  </p>
                  <p className={styles.infoSessao}>
                    {ROTULO_MODALIDADE[s.modalidade]}{s.qualificacaoInstrutor ? ` · ${s.qualificacaoInstrutor}` : ""}
                  </p>
                  {pend && (
                    pend.length === 0 ? (
                      <p className={styles.nr1Ok}>Conforme NR-1 (conteúdo, instrutor qualificado e carga horária)</p>
                    ) : (
                      <ul className={styles.nr1Pendente} aria-label="Pendências NR-1">
                        {pend.map((x) => <li key={x}>{x}</li>)}
                      </ul>
                    )
                  )}
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
                  {g && avaliaveis.length > 0 && (
                    <details className={styles.eficacia} open={avaliaveis.some((x) => x.situacao === "PENDENTE")}>
                      <summary>
                        Avaliação de eficácia · {avaliaveis.filter((x) => x.situacao === "PENDENTE").length} pendente(s)
                      </summary>
                      <ul className={styles.listaEficacia}>
                        {avaliaveis.map(({ p, situacao }) => (
                          <li key={p.id}>
                            <div className={styles.cabecalhoEficacia}>
                              <strong>{p.usuario.nome}</strong>
                              <BadgeEficacia situacao={situacao!} rotulo={ROTULO_SITUACAO_EFICACIA[situacao!]} />
                            </div>
                            {p.eficaciaResultado && (
                              <p className={styles.dica}>
                                {p.avaliadorEficacia?.nome} · {p.eficaciaAvaliadaEm ? formatarDataHora(p.eficaciaAvaliadaEm, fuso) : ""}
                                {p.eficaciaObservacao ? ` · ${p.eficaciaObservacao}` : ""}
                              </p>
                            )}
                            <FormAcao acao={avaliarEficaciaAcao} botao={p.eficaciaResultado ? "Corrigir" : "Avaliar"} tamanho="pequeno" variante="secundario" className={styles.formEficacia}>
                              <input type="hidden" name="participacaoId" value={p.id} />
                              <input type="hidden" name="treinamentoId" value={t.id} />
                              <select name="resultado" required defaultValue={p.eficaciaResultado ?? ""} aria-label={`Resultado de ${p.usuario.nome}`} className={styles.entradaPequena}>
                                <option value="" disabled>Resultado…</option>
                                <option value="EFICAZ">Eficaz</option>
                                <option value="NAO_EFICAZ">Não eficaz</option>
                              </select>
                              <input name="observacao" maxLength={2000} defaultValue={p.eficaciaObservacao ?? ""} placeholder="Evidência / ação (obrigatória se não eficaz)" aria-label={`Observação de ${p.usuario.nome}`} className={styles.entradaPequena} />
                            </FormAcao>
                          </li>
                        ))}
                      </ul>
                    </details>
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

          {g && (
            <Cartao titulo={`Gatilhos de reciclagem · ${t.gatilhos.length}`}>
              {t.ativo && (
                <FormAcao acao={registrarGatilhoAcao} botao="Registrar gatilho" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="treinamentoId" value={t.id} />
                  <label className={styles.campo}>Pessoa
                    <select name="usuarioId" required defaultValue="" className={styles.entrada}>
                      <option value="" disabled>Selecione…</option>
                      {op.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </label>
                  <div className={styles.linhaCampos2}>
                    <label className={styles.campo}>Motivo
                      <select name="motivo" required defaultValue="RETORNO_AFASTAMENTO" className={styles.entrada}>
                        {MOTIVOS_GATILHO.map((m) => <option key={m} value={m}>{ROTULO_MOTIVO_GATILHO[m]}</option>)}
                      </select>
                    </label>
                    <label className={styles.campo}>Data do evento
                      <input type="date" name="dataEvento" required max={hoje} defaultValue={hoje} className={styles.entrada} />
                    </label>
                  </div>
                  <label className={styles.campo}>Descrição (opcional)
                    <input name="descricao" maxLength={2000} placeholder="Ex.: afastamento de 120 dias" className={styles.entrada} />
                  </label>
                </FormAcao>
              )}
              <p className={styles.dica}>A pessoa fica com &quot;Reciclagem pendente&quot; até ser marcada presente numa sessão a partir da data do evento.</p>
              {t.gatilhos.length > 0 && (
                <ul className={styles.pendentes}>
                  {t.gatilhos.map((x) => (
                    <li key={x.id}>
                      <span>
                        {x.usuario.nome}
                        <span className={styles.subLinha}>{ROTULO_MOTIVO_GATILHO[x.motivo]}{x.descricao ? ` · ${x.descricao}` : ""}</span>
                      </span>
                      <span className={styles.vazio}>{formatarData(x.dataEvento)}</span>
                      <FormAcao acao={excluirGatilhoAcao} botao="Excluir" tamanho="pequeno" variante="secundario" confirmar="Excluir este gatilho (lançado por engano)?">
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="treinamentoId" value={t.id} />
                      </FormAcao>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          )}

          {!g && (
            <Cartao titulo="Sua situação">
              {(() => {
                const minhas = t.sessoes.flatMap((s) => s.participacoes.filter((p) => p.presente).map((p) => ({ data: dataIso(s.dataRealizacao), validade: p.dataValidade ? dataIso(p.dataValidade) : null })));
                const ultima = minhas.sort((x, y) => y.data.localeCompare(x.data))[0] ?? null;
                const gatilho = t.gatilhos.map((x) => dataIso(x.dataEvento)).sort().at(-1) ?? null;
                const st = statusCompetencia(ultima ? { dataValidade: ultima.validade, dataRealizacao: ultima.data } : null, hoje, undefined, gatilho);
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
                      obrigatorioFuncaoIds: t.obrigatorioFuncaoIds,
                      documentoId: t.documentoId ?? "",
                      critico: t.critico,
                      diasAvaliacaoEficacia: t.diasAvaliacaoEficacia ? String(t.diasAvaliacaoEficacia) : "",
                    }}
                    setores={op.setores}
                    funcoes={op.funcoes}
                    documentos={op.documentos}
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
