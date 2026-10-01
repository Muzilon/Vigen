import Link from "next/link";
import { notFound } from "next/navigation";
import { alterarHiraAcao, excluirHiraAcao, gerarPlanoHiraAcao, reavaliarHiraAcao } from "@/app/(app)/hira/actions";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { ROTULO_TIPO_ALTERACAO } from "@/lib/aprovacao/rotulos";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import {
  codigoHira,
  eixosPS,
  ROTULO_ACAO_HISTORICO,
  ROTULO_CONDICAO,
  ROTULO_FAIXA,
  ROTULO_HIERARQUIA,
  ROTULO_STATUS_LINHA,
} from "@/lib/hira/regras";
import { infoAprovacaoHira, listarHistoricoHira, obterHira, opcoesHira, pendenciasHira, podeGerenciarHira, podeTratarHira } from "@/lib/hira/servico";
import { exigirModulo } from "@/lib/modulos";
import { linkPlano } from "@/lib/plano-acao/acesso";
import { concluidoForaDoPrazo, statusEfetivoItem } from "@/lib/plano-acao/status";
import { getContexto } from "@/lib/tenant";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { AprovacoesDaEntidade } from "@/paginas/html/componentes/aprovacoes-da-entidade";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { BadgeSemEvidencia, BadgeStatusItem } from "@/paginas/html/componentes/badge-status-item";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { ItensForm } from "@/paginas/html/componentes/tabela-5w2h";
import { HiraFormulario } from "@/paginas/html/hira-formulario";
import styles from "@/paginas/css/hira-detalhe.module.css";

// Formato do "retrato" (snapshot) guardado em cada evento do histórico: só os campos que a tela mostra.
type Snapshot = {
  probabilidade?: number;
  severidade?: number;
  score?: number;
  faixa?: keyof typeof ROTULO_FAIXA;
  probabilidadeResidual?: number | null;
  severidadeResidual?: number | null;
  scoreResidual?: number | null;
  faixaResidual?: keyof typeof ROTULO_FAIXA | null;
  status?: keyof typeof ROTULO_STATUS_LINHA;
};

/**
 * Página de detalhe de uma linha de Perigos e Riscos: dados do perigo, avaliação inicial e residual, reavaliação, plano de ação,
 * histórico, aprovações, anexos e comentários. Se houver pedido de aprovação em andamento, a linha fica bloqueada para alteração.
 */
/** Detalhe da linha de Perigos e Riscos: dados, avaliação, reavaliação, plano, histórico, aprovações, anexos e comentários. */
export default async function HiraDetalhe({ params }: PageProps<"/hira/[id]">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Perigos e Riscos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "HIRA");
  // `id`: o identificador da linha de Perigos e Riscos, tirado do endereço.
  const { id } = await params;
  // Id em formato inválido → página 404.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca a linha de Perigos e Riscos (perigo, risco, controles, avaliações, plano...).
  const l = await obterHira(a, id);
  // Linha inexistente ou sem acesso → 404.
  if (!l) notFound();
  // Alvo dos anexos (esta linha).
  const alvo = { tipo: "HIRA" as const, entidadeId: l.id };
  // Busca em paralelo: histórico, opções, fuso horário, anexos, se pode anexar, pedidos de aprovação e a regra de aprovação da empresa.
  const [historico, op, fuso, anexos, podeAnexar, pendencias, aprovacao] = await Promise.all([
    listarHistoricoHira(a, l.id),
    opcoesHira(a),
    fusoDaEmpresa(a),
    listarAnexos(a, alvo),
    podeEnviarAnexo(a, alvo),
    pendenciasHira(a),
    infoAprovacaoHira(a),
  ]);
  const hoje = hojeNoFuso(fuso);
  // A linha está vigente (em uso)? Só linhas vigentes podem ser alteradas ou reavaliadas.
  const vigente = l.status === "VIGENTE";
  // Pedido de aprovação em andamento para esta linha, se houver.
  const pend = pendencias.get(l.id);
  // `g`: pode alterar/excluir (gerencia, linha vigente e sem pedido de aprovação em andamento).
  const g = podeGerenciarHira(a) && vigente && !pend;
  // `t`: pode reavaliar e gerar plano (responsável ou gestor, com a linha vigente).
  const t = podeTratarHira(a, l) && vigente;
  // Escala de pontuação da unidade (ou a padrão da empresa).
  const config = op.escalas[l.obraId] ?? op.escalas[""];
  // Os dois eixos da escala (probabilidade e severidade).
  const { eixoP, eixoS } = eixosPS(config);
  const codigo = codigoHira(l);
  // A próxima reavaliação já venceu? (a data ganha o aviso "vencida")
  const vencida = vigente && l.proximaReavaliacaoEm && l.proximaReavaliacaoEm.toISOString().slice(0, 10) < hoje;

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href={`/hira?obra=${l.obraId}`} className={styles.linkVoltar}>← Perigos e Riscos</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{codigo} · {l.obra.nome} · {l.setor}</p>
          <h1 className={styles.titulo}>{l.atividade}</h1>
          <p className={styles.meta}>
            <BadgeFaixa faixa={l.faixa} score={l.score} />
            <span className={styles.status}>{ROTULO_STATUS_LINHA[l.status]}</span>
            <span>{l.rotineira ? "Rotineira" : "Não rotineira"} · {ROTULO_CONDICAO[l.condicao]}</span>
            <span>Responsável: {l.responsavel?.nome ?? "—"}</span>
          </p>
        </div>
        {g && (
          <FormAcao
            acao={excluirHiraAcao}
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
              <dt>Unidade / setor</dt>
              <dd>{l.obra.nome} · {l.setor}</dd>
              <dt>Processo</dt>
              <dd>{l.processo ? <Link href={`/processos/${l.processo.id}`}>{l.processo.codigo} — {l.processo.nome}</Link> : "—"}</dd>
              <dt>Perigo</dt>
              <dd>{l.perigo}</dd>
              <dt>Risco / dano</dt>
              <dd>{l.risco}</dd>
              <dt>Controles existentes</dt>
              <dd>{l.controlesExistentes ?? "—"}</dd>
              <dt>Controles propostos</dt>
              <dd>{l.hierarquiaControle ? <strong>{ROTULO_HIERARQUIA[l.hierarquiaControle]}: </strong> : null}{l.controlesPropostos ?? (l.hierarquiaControle ? "" : "—")}</dd>
              <dt>Requisito legal</dt>
              <dd>{l.requisitoLegal ?? "—"}</dd>
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
                <HiraFormulario
                  acao={alterarHiraAcao}
                  modo="alterar"
                  botao={aprovacao ? "Enviar para aprovação" : "Salvar"}
                  aprovacao={aprovacao}
                  escalas={op.escalas}
                  obras={op.obras}
                  processos={op.processos}
                  usuarios={op.usuarios}
                  setores={op.setores}
                  inicial={{
                    id: l.id,
                    versao: l.versao,
                    obraId: l.obraId,
                    setor: l.setor,
                    processoId: l.processoId ?? "",
                    atividade: l.atividade,
                    rotineira: l.rotineira,
                    perigo: l.perigo,
                    risco: l.risco,
                    condicao: l.condicao,
                    controlesExistentes: l.controlesExistentes ?? "",
                    hierarquiaControle: l.hierarquiaControle ?? "",
                    controlesPropostos: l.controlesPropostos ?? "",
                    probabilidade: l.probabilidade,
                    severidade: l.severidade,
                    probabilidadeResidual: l.probabilidadeResidual ? String(l.probabilidadeResidual) : "",
                    severidadeResidual: l.severidadeResidual ? String(l.severidadeResidual) : "",
                    requisitoLegal: l.requisitoLegal ?? "",
                    responsavelId: l.responsavelId ?? "",
                    modoReavaliacao: l.modoReavaliacao,
                    periodicidadeMeses: l.periodicidadeMeses,
                  }}
                />
              </details>
            )}
          </Cartao>

          <Cartao titulo="Avaliação">
            <div className={styles.avaliacoes}>
              <div className={styles.blocoAvaliacao}>
                <span className={styles.rotulo}>Inicial</span>
                <BadgeFaixa faixa={l.faixa} score={l.score} />
                <span className={styles.detalheAvaliacao}>{eixoP.rotulo} {l.probabilidade} × {eixoS.rotulo} {l.severidade}</span>
              </div>
              <div className={styles.blocoAvaliacao}>
                <span className={styles.rotulo}>Residual</span>
                {l.faixaResidual ? (
                  <>
                    <BadgeFaixa faixa={l.faixaResidual} score={l.scoreResidual} />
                    <span className={styles.detalheAvaliacao}>{eixoP.rotulo} {l.probabilidadeResidual} × {eixoS.rotulo} {l.severidadeResidual}</span>
                  </>
                ) : (
                  <span className={styles.detalheAvaliacao}>Não avaliado</span>
                )}
              </div>
            </div>
            {t && (
              <details className={styles.editar}>
                <summary>Reavaliar</summary>
                <FormAcao acao={reavaliarHiraAcao} botao="Registrar reavaliação" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="versao" value={l.versao} />
                  <SelecaoNivel nome="probabilidade" rotulo={eixoP.rotulo} niveis={eixoP.niveis} valor={l.probabilidade} />
                  <SelecaoNivel nome="severidade" rotulo={eixoS.rotulo} niveis={eixoS.niveis} valor={l.severidade} />
                  <SelecaoNivel nome="probabilidadeResidual" rotulo={`${eixoP.rotulo} residual`} niveis={eixoP.niveis} valor={l.probabilidadeResidual} opcional />
                  <SelecaoNivel nome="severidadeResidual" rotulo={`${eixoS.rotulo} residual`} niveis={eixoS.niveis} valor={l.severidadeResidual} opcional />
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
                      <BadgeStatusItem status={statusEfetivoItem(i, hoje)} foraDoPrazo={concluidoForaDoPrazo(i)} /> <BadgeSemEvidencia item={i} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className={styles.vazio}>
                  Nenhum plano vinculado.{(l.faixaResidual ?? l.faixa) === "ALTO" || (l.faixaResidual ?? l.faixa) === "CRITICO" ? " Risco alto/crítico: recomenda-se plano de ação." : ""}
                </p>
                {t && (
                  <details className={styles.editar}>
                    <summary>Gerar plano de ação (5W2H)</summary>
                    <ItensForm acao={gerarPlanoHiraAcao} ocultos={{ id: l.id }} usuarios={op.usuarios} />
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
                        {s.faixa && <span>Inicial {s.probabilidade}×{s.severidade} = {s.score} ({ROTULO_FAIXA[s.faixa]})</span>}
                        {s.faixaResidual && <span>Residual {s.probabilidadeResidual}×{s.severidadeResidual} = {s.scoreResidual} ({ROTULO_FAIXA[s.faixaResidual]})</span>}
                        {s.status && <span>{ROTULO_STATUS_LINHA[s.status]}</span>}
                      </div>
                      {h.observacao && <p className={styles.observacao}>{h.observacao}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Cartao>

          <AprovacoesDaEntidade entidadeTipo="HIRA" entidadeId={l.id} />

          <Cartao titulo={`Anexos${anexos.length ? ` · ${anexos.length}` : ""}`}>
            <GaleriaAnexos anexos={anexos} fuso={fuso} />
            {podeAnexar && <EnviarAnexos tipo="HIRA" entidadeId={l.id} />}
          </Cartao>

          <Interacoes a={a} tipo="HIRA" entidadeId={l.id} usuarios={op.usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}

/**
 * Caixa de seleção de um nível (1, 2, 3...) usada no formulário de reavaliação.
 * `opcional` adiciona a escolha em branco (usada nos campos residuais).
 */
function SelecaoNivel({
  nome,
  rotulo,
  niveis,
  valor,
  opcional,
}: {
  nome: string;
  rotulo: string;
  niveis: { valor: number; rotulo: string }[];
  valor: number | null;
  opcional?: boolean;
}) {
  return (
    <label className={styles.campo}>
      {rotulo}
      <select name={nome} defaultValue={valor ?? ""} required={!opcional} className={styles.entrada}>
        {opcional && <option value="">—</option>}
        {niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
      </select>
    </label>
  );
}
