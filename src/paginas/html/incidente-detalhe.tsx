import Link from "next/link";
import { notFound } from "next/navigation";
import {
  concluirIncidenteAcao,
  definirResponsavelAcao,
  editarIncidenteAcao,
  gerarPlanoIncidenteAcao,
  iniciarInvestigacaoAcao,
  salvarInvestigacaoAcao,
} from "@/app/(app)/incidentes/actions";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import {
  GRAVIDADES_INCIDENTE,
  permitido,
  ROTULO_ACAO_INCIDENTE,
  ROTULO_GRAVIDADE_INCIDENTE,
  ROTULO_STATUS_INCIDENTE,
  ROTULO_TIPO_INCIDENTE,
  TIPOS_INCIDENTE,
} from "@/lib/incidentes/regras";
import {
  dataHoraLocal,
  listarHistoricoIncidente,
  obterIncidente,
  opcoesIncidentes,
  podeGerenciarIncidentes,
  podeTratarIncidente,
  podeVerRestritosIncidente,
} from "@/lib/incidentes/servico";
import { exigirModulo } from "@/lib/modulos";
import { linkPlano } from "@/lib/plano-acao/acesso";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { ROTULO_METODO, SEIS_M } from "@/lib/rnc/rotulos";
import { getContexto } from "@/lib/tenant";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { BadgeGravidadeIncidente, BadgeStatusIncidente } from "@/paginas/html/componentes/badge";
import { BadgeStatusItem } from "@/paginas/html/componentes/badge-status-item";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { ItensForm } from "@/paginas/html/componentes/tabela-5w2h";
import { CausaForm } from "@/paginas/html/rnc-detalhe-causa";
import styles from "@/paginas/css/incidente-detalhe.module.css";

type Analise = { porques?: string[]; ishikawa?: Record<string, string>; texto?: string };

/** Detalhe do incidente: registro, envolvidos (LGPD), investigação/causa raiz, plano, evidências, comentários e histórico. */
export default async function IncidenteDetalhe({ params }: PageProps<"/incidentes/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "INCIDENTES");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const i = await obterIncidente(a, id);
  if (!i) notFound();
  const verRestritos = podeVerRestritosIncidente(a);
  const alvo = { tipo: "INCIDENTE" as const, entidadeId: i.id };
  const alvoSensivel = { tipo: "INCIDENTE_DADOS_SENSIVEIS" as const, entidadeId: i.id };
  const [historico, op, fuso, anexos, podeAnexar, anexosSensiveis, podeAnexarSensivel] = await Promise.all([
    listarHistoricoIncidente(a, i.id),
    opcoesIncidentes(a),
    fusoDaEmpresa(a),
    listarAnexos(a, alvo),
    podeEnviarAnexo(a, alvo),
    verRestritos && i.contemDadosPessoais ? listarAnexos(a, alvoSensivel) : Promise.resolve([]),
    verRestritos && i.contemDadosPessoais ? podeEnviarAnexo(a, alvoSensivel) : Promise.resolve(false),
  ]);
  const hoje = hojeNoFuso(fuso);
  const trata = podeTratarIncidente(a, i);
  const gerencia = podeGerenciarIncidentes(a);
  const analise = (i.analiseCausa ?? null) as Analise | null;
  const temEnvolvidos = !!(i.envolvido || i.terceiroNome || i.testemunhas);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/incidentes" className={styles.linkVoltar}>← Incidentes e acidentes</Link>
      </nav>

      <header className={styles.cabecalho}>
        <p className={styles.codigo}>{i.codigo} · {ROTULO_TIPO_INCIDENTE[i.tipo]}</p>
        <h1 className={styles.titulo}>{ROTULO_TIPO_INCIDENTE[i.tipo]} em {i.obra.nome} — {formatarDataHora(i.dataHora, fuso)}</h1>
        <p className={styles.meta}>
          <BadgeStatusIncidente status={i.status} rotulo={ROTULO_STATUS_INCIDENTE[i.status]} />
          <BadgeGravidadeIncidente gravidade={i.gravidade} rotulo={ROTULO_GRAVIDADE_INCIDENTE[i.gravidade]} />
          {i.restrita && <span className={styles.restrito}>Restrito (LGPD)</span>}
          {i.geraCat && <span>CAT{i.numeroCat ? ` nº ${i.numeroCat}` : ""}</span>}
          <span>Investigação: {i.responsavel?.nome ?? "sem responsável"}</span>
        </p>
      </header>

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo="Registro">
            <dl className={styles.dados}>
              <dt>Data/hora</dt>
              <dd>{formatarDataHora(i.dataHora, fuso)}</dd>
              <dt>Unidade / setor</dt>
              <dd>{i.obra.nome}{i.setor ? ` · ${i.setor.nome}` : ""}</dd>
              <dt>Local</dt>
              <dd>{i.local ?? "—"}</dd>
              <dt>Descrição dos fatos</dt>
              <dd>{i.descricaoFatos}</dd>
              <dt>Dias perdidos</dt>
              <dd>{i.diasPerdidos ?? "—"}</dd>
              <dt>CAT</dt>
              <dd>{i.geraCat ? `Sim${i.numeroCat ? ` — nº ${i.numeroCat}` : " (número pendente)"}` : "Não"}</dd>
              <dt>Registrado por</dt>
              <dd>{i.registradoPor.nome} · {formatarDataHora(i.criadoEm, fuso)}</dd>
            </dl>
            {trata && permitido(i.status, "EDITAR") && (
              <details className={styles.editar}>
                <summary>Editar registro</summary>
                <FormAcao acao={editarIncidenteAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="versao" value={i.versao} />
                  <label className={styles.campo}>Tipo
                    <select name="tipo" defaultValue={i.tipo} className={styles.entrada}>
                      {TIPOS_INCIDENTE.map((t) => <option key={t} value={t}>{ROTULO_TIPO_INCIDENTE[t]}</option>)}
                    </select>
                  </label>
                  <label className={styles.campo}>Gravidade
                    <select name="gravidade" defaultValue={i.gravidade} className={styles.entrada}>
                      {GRAVIDADES_INCIDENTE.map((g) => <option key={g} value={g}>{ROTULO_GRAVIDADE_INCIDENTE[g]}</option>)}
                    </select>
                  </label>
                  <label className={styles.campo}>Data e hora
                    <input type="datetime-local" name="dataHora" required defaultValue={dataHoraLocal(i.dataHora, fuso)} className={styles.entrada} />
                  </label>
                  <label className={styles.campo}>Unidade
                    <select name="obraId" defaultValue={i.obraId} className={styles.entrada}>
                      {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </label>
                  <label className={styles.campo}>Setor
                    <select name="setorId" defaultValue={i.setorId ?? ""} className={styles.entrada}>
                      <option value="">—</option>
                      {op.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </label>
                  <label className={styles.campo}>Local<input name="local" defaultValue={i.local ?? ""} maxLength={300} className={styles.entrada} /></label>
                  <label className={styles.campoLargo}>Descrição dos fatos<textarea name="descricaoFatos" rows={4} defaultValue={i.descricaoFatos} className={styles.entrada} /></label>
                  <label className={styles.campo}>Dias perdidos<input type="number" min={0} name="diasPerdidos" defaultValue={i.diasPerdidos ?? ""} className={styles.entrada} /></label>
                  <label className={styles.caixa}><input type="checkbox" name="geraCat" defaultChecked={i.geraCat} /> Gera CAT</label>
                  <label className={styles.campo}>Número da CAT<input name="numeroCat" defaultValue={i.numeroCat ?? ""} maxLength={60} className={styles.entrada} /></label>
                </FormAcao>
              </details>
            )}
          </Cartao>

          {verRestritos && (temEnvolvidos || i.dadosSensiveis) && (
            <Cartao titulo="Envolvidos e dados sensíveis (acesso restrito)" className={styles.cartaoSensivel}>
              <dl className={styles.dados}>
                <dt>Envolvido</dt>
                <dd>{i.envolvido ? `${i.envolvido.nome} (colaborador)` : i.terceiroNome ? `${i.terceiroNome}${i.terceiroFuncao ? ` — ${i.terceiroFuncao}` : ""} (terceiro)` : "—"}</dd>
                <dt>Testemunhas</dt>
                <dd>{i.testemunhas ?? "—"}</dd>
                {i.dadosSensiveis && (
                  <>
                    <dt>Nome</dt>
                    <dd>{i.dadosSensiveis.nomeEnvolvido ?? "—"}</dd>
                    <dt>Documento</dt>
                    <dd className={styles.mono}>{i.dadosSensiveis.documentoEnvolvido ?? "—"}</dd>
                    <dt>Função</dt>
                    <dd>{i.dadosSensiveis.funcaoEnvolvido ?? "—"}</dd>
                    <dt>Relato</dt>
                    <dd>{i.dadosSensiveis.relato ?? "—"}</dd>
                    <dt>Lesão</dt>
                    <dd>{i.dadosSensiveis.lesaoDescricao ?? "—"}</dd>
                    <dt>Relato das testemunhas</dt>
                    <dd>{i.dadosSensiveis.testemunhasRelato ?? "—"}</dd>
                  </>
                )}
              </dl>
              {i.contemDadosPessoais && (
                <div className={styles.blocoAnexos}>
                  <GaleriaAnexos anexos={anexosSensiveis} fuso={fuso} vazio="Nenhum anexo sensível." />
                  {podeAnexarSensivel && <EnviarAnexos tipo="INCIDENTE_DADOS_SENSIVEIS" entidadeId={i.id} rotulo="Anexar documento sensível" />}
                </div>
              )}
            </Cartao>
          )}

          <Cartao titulo="Investigação">
            <dl className={styles.dados}>
              <dt>Responsável</dt>
              <dd>{i.responsavel?.nome ?? "—"}</dd>
              <dt>Método</dt>
              <dd>{i.metodoCausaRaiz ? ROTULO_METODO[i.metodoCausaRaiz] : "—"}</dd>
              <dt>Causa raiz</dt>
              <dd>{i.causaRaiz ?? "Ainda não registrada."}</dd>
              {analise?.porques && analise.porques.some(Boolean) && (
                <>
                  <dt>5 porquês</dt>
                  <dd><ol className={styles.lista}>{analise.porques.filter(Boolean).map((p, n) => <li key={n}>{p}</li>)}</ol></dd>
                </>
              )}
              {analise?.ishikawa && (
                <>
                  <dt>Ishikawa (6M)</dt>
                  <dd>
                    <ul className={styles.lista}>
                      {SEIS_M.filter(([k]) => analise.ishikawa?.[k]).map(([k, r]) => <li key={k}><strong>{r}:</strong> {analise.ishikawa?.[k]}</li>)}
                    </ul>
                  </dd>
                </>
              )}
              {analise?.texto && (
                <>
                  <dt>Análise</dt>
                  <dd>{analise.texto}</dd>
                </>
              )}
              {i.conclusao && (
                <>
                  <dt>Conclusão</dt>
                  <dd>{i.conclusao}{i.concluidoEm ? ` (${formatarDataHora(i.concluidoEm, fuso)})` : ""}</dd>
                </>
              )}
            </dl>

            {gerencia && permitido(i.status, "EDITAR") && (
              <FormAcao acao={definirResponsavelAcao} botao={i.responsavel ? "Trocar responsável" : "Designar responsável"} variante="secundario" tamanho="pequeno" className={styles.formLinha}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="versao" value={i.versao} />
                <select name="responsavelId" required defaultValue="" aria-label="Responsável pela investigação" className={styles.entrada}>
                  <option value="">Responsável pela investigação…</option>
                  {op.usuarios.filter((u) => u.id !== i.responsavelId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </FormAcao>
            )}
            {trata && i.status === "ABERTO" && (
              <FormAcao acao={iniciarInvestigacaoAcao} botao="Iniciar investigação" tamanho="pequeno" className={styles.formLinha}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="versao" value={i.versao} />
              </FormAcao>
            )}
            {trata && permitido(i.status, "INVESTIGAR") && (
              <details className={styles.editar} open={!i.causaRaiz && i.status === "EM_INVESTIGACAO"}>
                <summary>{i.causaRaiz ? "Revisar análise de causa raiz" : "Registrar análise de causa raiz"}</summary>
                <CausaForm acao={salvarInvestigacaoAcao} rncId={i.id} versao={i.versao} metodo={i.metodoCausaRaiz} analise={analise} causaRaiz={i.causaRaiz} />
              </details>
            )}
            {trata && i.status === "EM_INVESTIGACAO" && (
              <details className={styles.editar}>
                <summary>Concluir investigação</summary>
                <FormAcao acao={concluirIncidenteAcao} botao="Concluir incidente" tamanho="pequeno" className={styles.formulario} confirmar="Concluir o incidente? Depois disso o registro não pode ser alterado.">
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="versao" value={i.versao} />
                  <label className={styles.campoLargo}>Conclusão / lições aprendidas
                    <textarea name="conclusao" required rows={3} maxLength={8000} className={styles.entrada} />
                  </label>
                  {i.gravidade !== "SEM_AFASTAMENTO" && (
                    <label className={styles.campo}>Dias perdidos
                      <input type="number" min={0} name="diasPerdidos" defaultValue={i.diasPerdidos ?? ""} className={styles.entrada} />
                    </label>
                  )}
                </FormAcao>
              </details>
            )}
          </Cartao>

          <Cartao titulo="Plano de ação da investigação">
            {i.planoAcao ? (
              <>
                <p className={styles.texto}><Link href={linkPlano(i.planoAcao.id)} className={styles.linkForte}>{i.planoAcao.titulo}</Link></p>
                <ul className={styles.itensPlano}>
                  {i.planoAcao.itens.map((x) => (
                    <li key={x.id} className={styles.itemPlano}>
                      <span>{x.oQue}</span>
                      <span className={styles.detalhe}>{x.quem.nome} · {formatarData(x.quando)}</span>
                      <BadgeStatusItem status={statusEfetivoItem(x, hoje)} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className={styles.vazio}>Nenhum plano vinculado.</p>
                {trata && permitido(i.status, "GERAR_PLANO") && (
                  <details className={styles.editar}>
                    <summary>Gerar plano de ação (5W2H)</summary>
                    <ItensForm acao={gerarPlanoIncidenteAcao} ocultos={{ id: i.id }} usuarios={op.usuarios} />
                  </details>
                )}
              </>
            )}
          </Cartao>
        </div>

        <div className={styles.coluna}>
          <Cartao titulo={`Evidências${anexos.length ? ` · ${anexos.length}` : ""}`}>
            <GaleriaAnexos anexos={anexos} fuso={fuso} vazio="Nenhuma foto ou evidência." />
            {podeAnexar && <EnviarAnexos tipo="INCIDENTE" entidadeId={i.id} rotulo="Anexar foto/evidência" />}
          </Cartao>

          <Interacoes a={a} tipo="INCIDENTE" entidadeId={i.id} usuarios={op.usuarios} fuso={fuso} />

          <Cartao titulo={`Histórico · ${historico.length}`}>
            <ol className={styles.historico}>
              {historico.map((h) => (
                <li key={h.id} className={styles.eventoHistorico}>
                  <div className={styles.cabecalhoEvento}>
                    <strong>{ROTULO_ACAO_INCIDENTE[h.acao]}</strong>
                    <span>{formatarDataHora(h.criadoEm, fuso)} · {h.usuario.nome}</span>
                  </div>
                  <div className={styles.linhaEvento}>
                    {h.statusAnterior && h.statusAnterior !== h.statusNovo ? (
                      <span>{ROTULO_STATUS_INCIDENTE[h.statusAnterior]} → <strong>{ROTULO_STATUS_INCIDENTE[h.statusNovo]}</strong></span>
                    ) : (
                      <span>{ROTULO_STATUS_INCIDENTE[h.statusNovo]}</span>
                    )}
                  </div>
                  {h.observacao && <p className={styles.observacao}>{h.observacao}</p>}
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
