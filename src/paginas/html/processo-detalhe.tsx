import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adicionarIndicadorAcao,
  adicionarInteracaoAcao,
  definirAtivoAcao,
  publicarVersaoAcao,
  removerIndicadorAcao,
  removerInteracaoAcao,
  salvarProcessoAcao,
  solicitarPublicacaoAcao,
} from "@/app/(app)/processos/actions";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { ROTULO_TIPO_PROCESSO, type SnapshotProcesso } from "@/lib/processos/regras";
import { listarProcessos, listarVersoes, obterProcesso, podeGerenciarProcessos } from "@/lib/processos/servico";
import { codigoRisco, ROTULO_STATUS_RISCO } from "@/lib/riscos/regras";
import { listarRiscosDoProcesso, podeGerenciarRiscos } from "@/lib/riscos/servico";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { codigoHira, ROTULO_STATUS_LINHA } from "@/lib/hira/regras";
import { listarHiraDoProcesso, podeGerenciarHira } from "@/lib/hira/servico";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import styles from "@/paginas/css/processo-detalhe.module.css";

const CAMPOS_SIPOC = [
  ["fornecedores", "Fornecedores"],
  ["entradas", "Entradas"],
  ["saidas", "Saídas"],
  ["clientes", "Clientes"],
  ["recursos", "Recursos"],
] as const;

/** Detalhe do processo: dados/SIPOC, indicadores, interações, versões publicadas, anexos e comentários. */
export default async function ProcessoDetalhe({ params }: PageProps<"/processos/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "MAPA_PROCESSOS");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const p = await obterProcesso(a, id);
  if (!p) notFound();
  const alvoAnexo = { tipo: "PROCESSO" as const, entidadeId: p.id };
  const [versoes, outros, usuarios, fuso, anexos, podeAnexar, riscos, linhasHira] = await Promise.all([
    listarVersoes(a, p.id),
    listarProcessos(a),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    fusoDaEmpresa(a),
    listarAnexos(a, alvoAnexo),
    podeEnviarAnexo(a, alvoAnexo),
    listarRiscosDoProcesso(a, id),
    listarHiraDoProcesso(a, id),
  ]);
  const g = podeGerenciarProcessos(a) && p.ativo;
  const candidatos = outros.filter((o) => o.id !== p.id);
  const aprovadores = usuarios.filter((u) => u.id !== a.usuarioId);

  return (
    <div className={styles.pagina}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/processos" className={styles.linkVoltar}>← Mapa de processos</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{p.codigo}</p>
          <h1 className={styles.titulo}>{p.nome}</h1>
          <p className={styles.meta}>
            <span className={styles[`tipo${p.tipo}`]}>{ROTULO_TIPO_PROCESSO[p.tipo]}</span>
            <span>Dono: {p.dono?.nome ?? "—"}</span>
            <span>{p.versao > 0 ? `Versão publicada: ${p.versao}` : "Nunca publicado"}</span>
            {!p.ativo && <span className={styles.inativo}>Inativo</span>}
          </p>
        </div>
        {podeGerenciarProcessos(a) && (
          <FormAcao
            acao={definirAtivoAcao}
            botao={p.ativo ? "Inativar" : "Reativar"}
            variante={p.ativo ? "perigo" : "secundario"}
            tamanho="pequeno"
            confirmar={p.ativo ? `Inativar ${p.codigo}? Ele sai do mapa, mas o histórico de versões é mantido.` : undefined}
          >
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="ativo" value={p.ativo ? "false" : "true"} />
          </FormAcao>
        )}
      </header>

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo="Dados do processo">
            <dl className={styles.dados}>
              <dt>Objetivo</dt>
              <dd>{p.objetivo ?? "—"}</dd>
              {CAMPOS_SIPOC.map(([k, rotulo]) => (
                <LinhaDado key={k} rotulo={rotulo} valor={p[k]} />
              ))}
            </dl>
            {g && (
              <details className={styles.editar}>
                <summary>Editar dados</summary>
                <FormAcao acao={salvarProcessoAcao} botao="Salvar" className={styles.formulario}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="revisao" value={p.revisao} />
                  <label className={styles.campo}>
                    Código <input name="codigo" defaultValue={p.codigo} required maxLength={20} className={styles.entrada} />
                  </label>
                  <label className={styles.campo}>
                    Nome <input name="nome" defaultValue={p.nome} required maxLength={150} className={styles.entrada} />
                  </label>
                  <label className={styles.campo}>
                    Tipo
                    <select name="tipo" defaultValue={p.tipo} className={styles.entrada}>
                      <option value="GESTAO">Gestão</option>
                      <option value="FINALISTICO">Finalístico</option>
                      <option value="APOIO">Apoio</option>
                    </select>
                  </label>
                  <label className={styles.campo}>
                    Dono
                    <select name="donoId" defaultValue={p.donoId ?? ""} className={styles.entrada}>
                      <option value="">— sem dono —</option>
                      {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </label>
                  <label className={styles.campoLargo}>
                    Objetivo <textarea name="objetivo" defaultValue={p.objetivo ?? ""} rows={2} className={styles.entrada} />
                  </label>
                  {CAMPOS_SIPOC.map(([k, rotulo]) => (
                    <label key={k} className={styles.campoLargo}>
                      {rotulo} <textarea name={k} defaultValue={p[k] ?? ""} rows={2} className={styles.entrada} />
                    </label>
                  ))}
                </FormAcao>
              </details>
            )}
          </Cartao>

          <Cartao titulo={`Indicadores · ${p.indicadores.length}`}>
            {p.indicadores.length === 0 ? (
              <p className={styles.vazio}>Nenhum indicador.</p>
            ) : (
              <table className={styles.tabela}>
                <thead>
                  <tr><th>Indicador</th><th>Meta</th><th>Unidade</th><th>Periodicidade</th>{g && <th />}</tr>
                </thead>
                <tbody>
                  {p.indicadores.map((i) => (
                    <tr key={i.id}>
                      <td>{i.nome}</td>
                      <td>{i.meta ?? "—"}</td>
                      <td>{i.unidade ?? "—"}</td>
                      <td>{i.periodicidade ?? "—"}</td>
                      {g && (
                        <td>
                          <FormAcao acao={removerIndicadorAcao} botao="Remover" variante="texto" tamanho="pequeno" confirmar={`Remover o indicador "${i.nome}"?`}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="processoId" value={p.id} />
                          </FormAcao>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {g && (
              <FormAcao acao={adicionarIndicadorAcao} botao="Adicionar indicador" variante="secundario" tamanho="pequeno" className={styles.formLinha}>
                <input type="hidden" name="processoId" value={p.id} />
                <input name="nome" placeholder="Indicador" required aria-label="Nome do indicador" className={styles.entrada} />
                <input name="meta" placeholder="Meta" aria-label="Meta" className={styles.entradaCurta} />
                <input name="unidade" placeholder="Unidade" aria-label="Unidade" className={styles.entradaCurta} />
                <input name="periodicidade" placeholder="Periodicidade" aria-label="Periodicidade" className={styles.entradaCurta} />
              </FormAcao>
            )}
          </Cartao>

          <Cartao titulo="Interações com outros processos">
            <div className={styles.interacoes}>
              <div>
                <h3 className={styles.subtitulo}>Entregas para (saídas →)</h3>
                <ListaInteracoes
                  itens={p.interacoesOrigem.map((x) => ({ id: x.id, outro: x.destino, descricao: x.descricao }))}
                  processoId={p.id}
                  podeRemover={g}
                />
              </div>
              <div>
                <h3 className={styles.subtitulo}>Recebe de (← entradas)</h3>
                <ListaInteracoes
                  itens={p.interacoesDestino.map((x) => ({ id: x.id, outro: x.origem, descricao: x.descricao }))}
                  processoId={p.id}
                  podeRemover={g}
                />
              </div>
            </div>
            {g && candidatos.length > 0 && (
              <FormAcao acao={adicionarInteracaoAcao} botao="Adicionar interação" variante="secundario" tamanho="pequeno" className={styles.formLinha}>
                <input type="hidden" name="processoId" value={p.id} />
                <select name="sentido" aria-label="Sentido" className={styles.entrada} defaultValue="saida">
                  <option value="saida">{p.codigo} entrega para →</option>
                  <option value="entrada">{p.codigo} recebe de ←</option>
                </select>
                <select name="outroId" aria-label="Outro processo" required className={styles.entrada} defaultValue="">
                  <option value="" disabled>Processo...</option>
                  {candidatos.map((o) => <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>)}
                </select>
                <input name="descricao" placeholder="O que flui (opcional)" aria-label="Descrição" className={styles.entrada} />
              </FormAcao>
            )}
          </Cartao>

          {riscos && (
            <Cartao
              titulo={`Riscos e oportunidades · ${riscos.length}`}
              acoes={
                podeGerenciarRiscos(a) ? (
                  <Link href={`/riscos/novo?processo=${p.id}`} className={styles.linkProcesso}>+ Novo</Link>
                ) : undefined
              }
            >
              {riscos.length === 0 ? (
                <p className={styles.vazio}>Nenhum risco ou oportunidade vinculado.</p>
              ) : (
                <table className={styles.tabela}>
                  <thead>
                    <tr><th>Código</th><th>Descrição</th><th>Nível</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {riscos.map((r) => (
                      <tr key={r.id}>
                        <td><Link href={`/riscos/${r.id}`} className={styles.linkProcesso}>{codigoRisco(r)}</Link></td>
                        <td>{r.descricao}</td>
                        <td><BadgeFaixa faixa={r.faixa} score={r.score} /></td>
                        <td>{ROTULO_STATUS_RISCO[r.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className={styles.rodapeCartao}><Link href={`/riscos?processo=${p.id}`} className={styles.linkProcesso}>Ver na matriz de riscos →</Link></p>
            </Cartao>
          )}

          {linhasHira && (
            <Cartao
              titulo={`Perigos e riscos (HIRA) · ${linhasHira.length}`}
              acoes={podeGerenciarHira(a) ? <Link href={`/hira/novo?processo=${p.id}`} className={styles.linkProcesso}>+ Nova linha</Link> : undefined}
            >
              {linhasHira.length === 0 ? (
                <p className={styles.vazio}>Nenhuma linha HIRA vinculada a este processo.</p>
              ) : (
                <table className={styles.tabela}>
                  <thead>
                    <tr><th>Nº</th><th>Atividade / perigo</th><th>Obra</th><th>Nível</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {linhasHira.map((l) => (
                      <tr key={l.id}>
                        <td><Link href={`/hira/${l.id}`} className={styles.linkProcesso}>{codigoHira(l)}</Link></td>
                        <td>{l.atividade} — {l.perigo}</td>
                        <td>{l.obra.nome}</td>
                        <td><BadgeFaixa faixa={l.faixa} score={l.score} /></td>
                        <td>{ROTULO_STATUS_LINHA[l.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className={styles.rodapeCartao}><Link href={`/hira?processo=${p.id}`} className={styles.linkProcesso}>Ver na planilha HIRA →</Link></p>
            </Cartao>
          )}

          <Cartao titulo="Vínculos com outros módulos">
            <ul className={styles.placeholders}>
              {!riscos && <li>Riscos e oportunidades <span className={styles.emBreve}>módulo não contratado</span></li>}
              {!linhasHira && <li>Perigos e riscos (HIRA) <span className={styles.emBreve}>módulo não contratado</span></li>}
              <li>Aspectos e impactos (LAIA) <span className={styles.emBreve}>em breve</span></li>
              <li>Documentos vinculados <span className={styles.emBreve}>em breve</span></li>
            </ul>
          </Cartao>
        </div>

        <div className={styles.coluna}>
          <Cartao titulo={`Versões publicadas · ${versoes.length}`}>
            {g && (
              <div className={styles.publicar}>
                <FormAcao acao={publicarVersaoAcao} botao={`Publicar versão ${p.versao + 1}`} tamanho="pequeno" className={styles.formPublicar}>
                  <input type="hidden" name="processoId" value={p.id} />
                  <input name="observacao" placeholder="O que mudou (opcional)" aria-label="Observação da versão" className={styles.entrada} />
                </FormAcao>
                {aprovadores.length > 0 && (
                  <details className={styles.editar}>
                    <summary>Publicar via aprovação (assinaturas)</summary>
                    <FormAcao acao={solicitarPublicacaoAcao} botao="Enviar para aprovação" variante="secundario" tamanho="pequeno" className={styles.formulario}>
                      <input type="hidden" name="processoId" value={p.id} />
                      <label className={styles.campoLargo}>
                        Observação <input name="observacao" className={styles.entrada} />
                      </label>
                      <label className={styles.campo}>
                        Modo
                        <select name="modo" defaultValue="SEQUENCIAL" className={styles.entrada}>
                          <option value="SEQUENCIAL">Sequencial (em ordem)</option>
                          <option value="PARALELO">Simultâneo</option>
                        </select>
                      </label>
                      <fieldset className={styles.campoLargo}>
                        <legend>Aprovadores</legend>
                        {aprovadores.map((u) => (
                          <label key={u.id} className={styles.opcao}>
                            <input type="checkbox" name="aprovadorIds" value={u.id} /> {u.nome}
                          </label>
                        ))}
                      </fieldset>
                    </FormAcao>
                  </details>
                )}
              </div>
            )}
            {versoes.length === 0 ? (
              <p className={styles.vazio}>Nenhuma versão publicada.</p>
            ) : (
              <ol className={styles.versoes}>
                {versoes.map((v) => {
                  const s = v.snapshot as unknown as SnapshotProcesso;
                  return (
                    <li key={v.id} className={styles.versao}>
                      <div className={styles.cabecalhoVersao}>
                        <strong>Versão {v.versao}</strong>
                        <span>{formatarDataHora(v.publicadoEm, fuso)} · {v.publicadoPor.nome}</span>
                      </div>
                      {v.observacao && <p className={styles.observacao}>{v.observacao}</p>}
                      <details>
                        <summary>Ver conteúdo congelado</summary>
                        <dl className={styles.dados}>
                          <dt>Nome</dt><dd>{s.codigo} — {s.nome}</dd>
                          <dt>Tipo</dt><dd>{ROTULO_TIPO_PROCESSO[s.tipo]}</dd>
                          <dt>Dono</dt><dd>{s.dono?.nome ?? "—"}</dd>
                          <dt>Entradas</dt><dd>{s.entradas ?? "—"}</dd>
                          <dt>Saídas</dt><dd>{s.saidas ?? "—"}</dd>
                          <dt>Indicadores</dt><dd>{s.indicadores.map((i) => i.nome).join("; ") || "—"}</dd>
                          <dt>Interações</dt>
                          <dd>{[...s.interacoes.saida.map((x) => `→ ${x.codigo}`), ...s.interacoes.entrada.map((x) => `← ${x.codigo}`)].join(", ") || "—"}</dd>
                        </dl>
                      </details>
                    </li>
                  );
                })}
              </ol>
            )}
          </Cartao>

          <Cartao titulo={`Anexos${anexos.length ? ` · ${anexos.length}` : ""}`}>
            <GaleriaAnexos anexos={anexos} fuso={fuso} />
            {podeAnexar && <EnviarAnexos tipo="PROCESSO" entidadeId={p.id} />}
          </Cartao>

          <Interacoes a={a} tipo="PROCESSO" entidadeId={p.id} usuarios={usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}

function LinhaDado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{valor ?? "—"}</dd>
    </>
  );
}

function ListaInteracoes({
  itens,
  processoId,
  podeRemover,
}: {
  itens: { id: string; outro: { id: string; codigo: string; nome: string; ativo: boolean }; descricao: string | null }[];
  processoId: string;
  podeRemover: boolean;
}) {
  if (itens.length === 0) return <p className={styles.vazio}>Nenhuma.</p>;
  return (
    <ul className={styles.listaInteracoes}>
      {itens.map((x) => (
        <li key={x.id} className={styles.itemInteracao}>
          <div>
            <Link href={`/processos/${x.outro.id}`} className={styles.linkProcesso}>{x.outro.codigo} — {x.outro.nome}</Link>
            {!x.outro.ativo && <span className={styles.inativo}> (inativo)</span>}
            {x.descricao && <p className={styles.descricaoInteracao}>{x.descricao}</p>}
          </div>
          {podeRemover && (
            <FormAcao acao={removerInteracaoAcao} botao="Remover" variante="texto" tamanho="pequeno" confirmar="Remover esta interação?">
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="processoId" value={processoId} />
            </FormAcao>
          )}
        </li>
      ))}
    </ul>
  );
}
