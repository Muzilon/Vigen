import Link from "next/link";
import { notFound } from "next/navigation";
import { alterarLaiaAcao, excluirLaiaAcao, gerarPlanoLaiaAcao, reavaliarLaiaAcao } from "@/app/(app)/laia/actions";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { ROTULO_TIPO_ALTERACAO } from "@/lib/aprovacao/rotulos";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import {
  codigoLaia,
  eixoLaia,
  EIXOS_LAIA,
  ROTULO_ACAO_HISTORICO,
  ROTULO_FAIXA,
  ROTULO_INCIDENCIA,
  ROTULO_SITUACAO,
  ROTULO_STATUS_LINHA,
  ROTULO_TEMPORALIDADE,
} from "@/lib/laia/regras";
import { infoAprovacaoLaia, listarHistoricoLaia, obterLaia, opcoesLaia, pendenciasLaia, podeGerenciarLaia, podeTratarLaia } from "@/lib/laia/servico";
import { exigirModulo } from "@/lib/modulos";
import { linkPlano } from "@/lib/plano-acao/acesso";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { getContexto } from "@/lib/tenant";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { AprovacoesDaEntidade } from "@/paginas/html/componentes/aprovacoes-da-entidade";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { BadgeStatusItem } from "@/paginas/html/componentes/badge-status-item";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { ItensForm } from "@/paginas/html/componentes/tabela-5w2h";
import { LaiaFormulario } from "@/paginas/html/laia-formulario";
import styles from "@/paginas/css/laia-detalhe.module.css";

// Formato do "retrato" (snapshot) guardado em cada evento do histórico: só os campos que a tela mostra.
type Snapshot = {
  severidade?: number;
  frequencia?: number;
  abrangencia?: number;
  score?: number;
  faixa?: keyof typeof ROTULO_FAIXA;
  significativo?: boolean;
  status?: keyof typeof ROTULO_STATUS_LINHA;
};

/**
 * Página de detalhe de uma linha LAIA: dados, pontuação de significância, reavaliação, plano de ação,
 * histórico, aprovações, anexos e comentários. Se houver pedido de aprovação em andamento, a linha fica bloqueada para alteração.
 */
/** Detalhe da linha LAIA: dados, significância, reavaliação, plano, histórico, aprovações, anexos e comentários. */
export default async function LaiaDetalhe({ params }: PageProps<"/laia/[id]">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de LAIA, a página responde "404 - não encontrada".
  exigirModulo(ctx, "LAIA");
  // `id`: o identificador da linha LAIA, tirado do endereço.
  const { id } = await params;
  // Id em formato inválido → página 404.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca a linha LAIA (aspecto, impacto, pontuação, plano...).
  const l = await obterLaia(a, id);
  // Linha inexistente ou sem acesso → 404.
  if (!l) notFound();
  // Alvo dos anexos (esta linha).
  const alvo = { tipo: "LAIA" as const, entidadeId: l.id };
  // Busca em paralelo: histórico, opções, fuso horário, anexos, se pode anexar, pedidos de aprovação e a regra de aprovação da empresa.
  const [historico, op, fuso, anexos, podeAnexar, pendencias, aprovacao] = await Promise.all([
    listarHistoricoLaia(a, l.id),
    opcoesLaia(a),
    fusoDaEmpresa(a),
    listarAnexos(a, alvo),
    podeEnviarAnexo(a, alvo),
    pendenciasLaia(a),
    infoAprovacaoLaia(a),
  ]);
  const hoje = hojeNoFuso(fuso);
  // A linha está vigente (em uso)? Só linhas vigentes podem ser alteradas ou reavaliadas.
  const vigente = l.status === "VIGENTE";
  // Pedido de aprovação em andamento para esta linha, se houver.
  const pend = pendencias.get(l.id);
  // `g`: pode alterar/excluir (gerencia, linha vigente e sem pedido de aprovação em andamento).
  const g = podeGerenciarLaia(a) && vigente && !pend;
  // `t`: pode reavaliar e gerar plano (responsável ou gestor, com a linha vigente).
  const t = podeTratarLaia(a, l) && vigente;
  // Escala de pontuação da unidade (ou a padrão da empresa).
  const config = op.escalas[l.obraId] ?? op.escalas[""];
  const codigo = codigoLaia(l);
  // A próxima reavaliação já venceu? (a data ganha o aviso "vencida")
  const vencida = vigente && l.proximaReavaliacaoEm && l.proximaReavaliacaoEm.toISOString().slice(0, 10) < hoje;
  // Nome de um eixo da escala (ex.: "Severidade") conforme a configuração da empresa.
  const rotuloEixo = (k: (typeof EIXOS_LAIA)[number]) => eixoLaia(config, k)?.rotulo ?? k;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href={`/laia?obra=${l.obraId}`} className={styles.linkVoltar}>← Aspectos e impactos (LAIA)</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{codigo} · {l.obra.nome}</p>
          <h1 className={styles.titulo}>{l.aspecto} → {l.impacto}</h1>
          <p className={styles.meta}>
            <BadgeFaixa faixa={l.faixa} score={l.score} />
            <span className={styles.status}>{l.significativo ? "Significativo" : "Não significativo"}</span>
            <span className={styles.status}>{ROTULO_STATUS_LINHA[l.status]}</span>
            <span>Responsável: {l.responsavel?.nome ?? "—"}</span>
          </p>
        </div>
        {g && (
          <FormAcao
            acao={excluirLaiaAcao}
            botao={aprovacao ? "Solicitar exclusão" : "Excluir"}
            variante="perigo"
            tamanho="pequeno"
            className={styles.formExcluir}
            confirmar={aprovacao ? `Enviar a exclusão de ${codigo} para aprovação?` : `Excluir (inativar) ${codigo}? O histórico é preservado.`}
          >
            <input type="hidden" name="id" value={l.id} />
            <input type="hidden" name="versao" value={l.versao} />
            <input name="motivo" placeholder="Motivo" aria-label="Motivo da exclusão" maxLength={1000} className={styles.entrada} />
          </FormAcao>
        )}
      </header>

      {pend && (
        <p className={styles.pendencia}>
          {ROTULO_TIPO_ALTERACAO[pend.tipoAlteracao]} aguardando aprovação — <Link href={`/aprovacoes/${pend.id}`}>ver solicitação</Link>. Enquanto isso, a linha não pode ser alterada.
        </p>
      )}

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo="Dados">
            <dl className={styles.dados}>
              <dt>Unidade</dt>
              <dd>{l.obra.nome}</dd>
              <dt>Processo</dt>
              <dd>{l.processo ? <Link href={`/processos/${l.processo.id}`}>{l.processo.codigo} — {l.processo.nome}</Link> : "—"}</dd>
              <dt>Atividade</dt>
              <dd>{l.atividade}</dd>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO[l.situacao]} · temporalidade {ROTULO_TEMPORALIDADE[l.temporalidade].toLowerCase()} · incidência {ROTULO_INCIDENCIA[l.incidencia].toLowerCase()}</dd>
              <dt>Controles</dt>
              <dd>{l.controles ?? "—"}</dd>
              <dt>Reavaliação</dt>
              <dd>
                {l.modoReavaliacao === "ITEM" ? "Item a item" : "Na revisão geral da unidade"} · a cada {l.periodicidadeMeses} {l.periodicidadeMeses === 1 ? "mês" : "meses"} · próxima em{" "}
                <span className={vencida ? styles.vencida : undefined}>{formatarData(l.proximaReavaliacaoEm)}{vencida ? " (vencida)" : ""}</span>
                {l.ultimaReavaliacaoEm && <> · última em {formatarDataHora(l.ultimaReavaliacaoEm, fuso)}</>}
              </dd>
              <dt>Cadastro</dt>
              <dd>{l.criadoPor.nome} · {formatarDataHora(l.criadoEm, fuso)}</dd>
            </dl>
            {g && (
              <details className={styles.editar}>
                <summary>{aprovacao ? "Solicitar alteração (vai para aprovação)" : "Alterar linha"}</summary>
                <LaiaFormulario
                  acao={alterarLaiaAcao}
                  modo="alterar"
                  botao={aprovacao ? "Enviar para aprovação" : "Salvar"}
                  aprovacao={aprovacao}
                  escalas={op.escalas}
                  obras={op.obras}
                  processos={op.processos}
                  usuarios={op.usuarios}
                  inicial={{
                    id: l.id,
                    versao: l.versao,
                    obraId: l.obraId,
                    processoId: l.processoId ?? "",
                    atividade: l.atividade,
                    aspecto: l.aspecto,
                    impacto: l.impacto,
                    situacao: l.situacao,
                    temporalidade: l.temporalidade,
                    incidencia: l.incidencia,
                    severidade: l.severidade,
                    frequencia: l.frequencia,
                    abrangencia: l.abrangencia,
                    requisitoLegal: l.requisitoLegal,
                    partesInteressadas: l.partesInteressadas,
                    controles: l.controles ?? "",
                    responsavelId: l.responsavelId ?? "",
                    modoReavaliacao: l.modoReavaliacao,
                    periodicidadeMeses: l.periodicidadeMeses,
                  }}
                />
              </details>
            )}
          </Cartao>

          <Cartao titulo="Significância">
            <div className={styles.avaliacoes}>
              <div className={styles.blocoAvaliacao}>
                <span className={styles.rotulo}>Pontuação</span>
                <BadgeFaixa faixa={l.faixa} score={l.score} />
                <span className={styles.detalheAvaliacao}>
                  {rotuloEixo("severidade")} {l.severidade} × {rotuloEixo("frequencia")} {l.frequencia} × {rotuloEixo("abrangencia")} {l.abrangencia}
                </span>
              </div>
              <div className={styles.blocoAvaliacao}>
                <span className={styles.rotulo}>Critérios extras</span>
                <span className={styles.detalheAvaliacao}>Requisito legal: {l.requisitoLegal ? "sim" : "não"}</span>
                <span className={styles.detalheAvaliacao}>Partes interessadas: {l.partesInteressadas ? "sim" : "não"}</span>
              </div>
            </div>
            {t && (
              <details className={styles.editar}>
                <summary>Reavaliar</summary>
                <FormAcao acao={reavaliarLaiaAcao} botao="Registrar reavaliação" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="versao" value={l.versao} />
                  {EIXOS_LAIA.map((k) => {
                    const e = eixoLaia(config, k);
                    if (!e) return <input key={k} type="hidden" name={k} value={l[k]} />;
                    return (
                      <label key={k} className={styles.campo}>
                        {e.rotulo}
                        <select name={k} defaultValue={l[k]} required className={styles.entrada}>
                          {e.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
                        </select>
                      </label>
                    );
                  })}
                  <label className={styles.campoLargo}>
                    Observação <input name="observacao" maxLength={1000} className={styles.entrada} />
                  </label>
                </FormAcao>
              </details>
            )}
          </Cartao>

          <Cartao titulo="Plano de ação">
            {l.planoAcao ? (
              <>
                <p className={styles.texto}>
                  <Link href={linkPlano(l.planoAcao.id)} className={styles.linkForte}>{l.planoAcao.titulo}</Link>
                </p>
                <ul className={styles.itensPlano}>
                  {l.planoAcao.itens.map((i) => (
                    <li key={i.id} className={styles.itemPlano}>
                      <span>{i.oQue}</span>
                      <span className={styles.detalheAvaliacao}>{i.quem.nome} · {formatarData(i.quando)}</span>
                      <BadgeStatusItem status={statusEfetivoItem(i, hoje)} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className={styles.vazio}>Nenhum plano vinculado.{l.significativo ? " Aspecto significativo: recomenda-se plano de ação/controle operacional." : ""}</p>
                {t && (
                  <details className={styles.editar}>
                    <summary>Gerar plano de ação (5W2H)</summary>
                    <ItensForm acao={gerarPlanoLaiaAcao} ocultos={{ id: l.id }} usuarios={op.usuarios} />
                  </details>
                )}
              </>
            )}
          </Cartao>
        </div>

        <div className={styles.coluna}>
          <Cartao titulo={`Histórico · ${historico.length}`}>
            {historico.length === 0 ? (
              <p className={styles.vazio}>Sem histórico.</p>
            ) : (
              <ol className={styles.historico}>
                {historico.map((h) => {
                  const s = h.dados as Snapshot;
                  return (
                    <li key={h.id} className={styles.eventoHistorico}>
                      <div className={styles.cabecalhoEvento}>
                        <strong>{ROTULO_ACAO_HISTORICO[h.acao]}</strong>
                        <span>{formatarDataHora(h.criadoEm, fuso)} · {h.usuario.nome} · v{h.versao}</span>
                      </div>
                      <div className={styles.linhaEvento}>
                        {s.faixa && <span>{s.severidade}×{s.frequencia}×{s.abrangencia} = {s.score} ({ROTULO_FAIXA[s.faixa]}{s.significativo ? ", significativo" : ""})</span>}
                        {s.status && <span>{ROTULO_STATUS_LINHA[s.status]}</span>}
                      </div>
                      {h.observacao && <p className={styles.observacao}>{h.observacao}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Cartao>

          <AprovacoesDaEntidade entidadeTipo="LAIA" entidadeId={l.id} />

          <Cartao titulo={`Anexos${anexos.length ? ` · ${anexos.length}` : ""}`}>
            <GaleriaAnexos anexos={anexos} fuso={fuso} />
            {podeAnexar && <EnviarAnexos tipo="LAIA" entidadeId={l.id} />}
          </Cartao>

          <Interacoes a={a} tipo="LAIA" entidadeId={l.id} usuarios={op.usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}
