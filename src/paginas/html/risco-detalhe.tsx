import Link from "next/link";
import { notFound } from "next/navigation";
import {
  alterarStatusAcao,
  definirTratamentoAcao,
  editarRiscoAcao,
  excluirRiscoAcao,
  gerarPlanoAcao,
  reavaliarAcao,
  solicitarAlteracaoAcao,
} from "@/app/(app)/riscos/actions";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { linkPlano } from "@/lib/plano-acao/acesso";
import {
  codigoRisco,
  eixosPI,
  ROTULO_FAIXA,
  ROTULO_STATUS_RISCO,
  ROTULO_TIPO_RISCO,
  ROTULO_TRATAMENTO,
  STATUS_RISCO,
} from "@/lib/riscos/regras";
import { listarHistorico, obterRisco, opcoesFormulario, podeGerenciarRiscos, podeTratarRisco } from "@/lib/riscos/servico";
import { ROTULO_QUADRANTE } from "@/lib/swot/regras";
import { getContexto } from "@/lib/tenant";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { AprovacoesDaEntidade } from "@/paginas/html/componentes/aprovacoes-da-entidade";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { BadgeStatusItem } from "@/paginas/html/componentes/badge-status-item";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { ItensForm } from "@/paginas/html/componentes/tabela-5w2h";
import { RiscoFormulario, TratamentoFormulario, type ValoresRisco } from "@/paginas/html/riscos-formulario";
import styles from "@/paginas/css/risco-detalhe.module.css";

const ROTULO_ACAO: Record<string, string> = {
  CRIACAO: "Cadastro",
  ALTERACAO: "Alteração",
  TRATAMENTO: "Tratamento",
  REAVALIACAO: "Reavaliação",
  REVISAO_GERAL: "Revisão geral",
  STATUS: "Status",
  EXCLUSAO: "Exclusão",
};

/** Detalhe do risco/oportunidade: avaliação, tratamento, plano, reavaliação, histórico, aprovações, anexos e comentários. */
export default async function RiscoDetalhe({ params }: PageProps<"/riscos/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "RISCOS_OPORTUNIDADES");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const r = await obterRisco(a, id);
  if (!r) notFound();
  const alvo = { tipo: "RISCO_OPORTUNIDADE" as const, entidadeId: r.id };
  const [historico, op, fuso, anexos, podeAnexar] = await Promise.all([
    listarHistorico(a, r.id),
    opcoesFormulario(a),
    fusoDaEmpresa(a),
    listarAnexos(a, alvo),
    podeEnviarAnexo(a, alvo),
  ]);
  const hoje = hojeNoFuso(fuso);
  const g = podeGerenciarRiscos(a);
  const t = podeTratarRisco(a, r);
  const config = op.escalas[r.obraId ?? ""] ?? op.escalas[""];
  const { eixoP, eixoI } = eixosPI(config);
  const codigo = codigoRisco(r);
  const valores: ValoresRisco = {
    id: r.id,
    versao: r.versao,
    tipo: r.tipo,
    descricao: r.descricao,
    causa: r.causa ?? "",
    consequencia: r.consequencia ?? "",
    processoId: r.processoId ?? "",
    obraId: r.obraId ?? "",
    responsavelId: r.responsavelId ?? "",
    probabilidade: r.probabilidade,
    impacto: r.impacto,
    modoReavaliacao: r.modoReavaliacao,
    periodicidadeMeses: r.periodicidadeMeses,
  };
  const vencida = r.proximaReavaliacaoEm && r.proximaReavaliacaoEm.toISOString().slice(0, 10) < hoje;
  const aprovadores = op.usuarios.filter((u) => u.id !== a.usuarioId);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/riscos" className={styles.linkVoltar}>← Riscos e oportunidades</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{codigo} · {ROTULO_TIPO_RISCO[r.tipo]}</p>
          <h1 className={styles.titulo}>{r.descricao}</h1>
          <p className={styles.meta}>
            <BadgeFaixa faixa={r.faixa} score={r.score} />
            <span className={styles.status}>{ROTULO_STATUS_RISCO[r.status]}</span>
            {r.tratamento && <span>Tratamento: {ROTULO_TRATAMENTO[r.tratamento]}</span>}
            <span>Responsável: {r.responsavel?.nome ?? "—"}</span>
          </p>
        </div>
        {g && (
          <FormAcao acao={excluirRiscoAcao} botao="Excluir" variante="perigo" tamanho="pequeno" confirmar={`Excluir ${codigo}? O histórico é preservado.`}>
            <input type="hidden" name="id" value={r.id} />
          </FormAcao>
        )}
      </header>

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo="Dados">
            <dl className={styles.dados}>
              <dt>Processo</dt>
              <dd>{r.processo ? <Link href={`/processos/${r.processo.id}`}>{r.processo.codigo} — {r.processo.nome}</Link> : "—"}</dd>
              <dt>Obra/unidade</dt>
              <dd>{r.obra?.nome ?? "Empresa toda"}</dd>
              <dt>Causa</dt>
              <dd>{r.causa ?? "—"}</dd>
              <dt>Consequência</dt>
              <dd>{r.consequencia ?? "—"}</dd>
              <dt>Reavaliação</dt>
              <dd>
                {r.modoReavaliacao === "ITEM" ? "Item a item" : "Na revisão geral"} · a cada {r.periodicidadeMeses} {r.periodicidadeMeses === 1 ? "mês" : "meses"} · próxima em{" "}
                <span className={vencida ? styles.vencida : undefined}>{formatarData(r.proximaReavaliacaoEm)}{vencida ? " (vencida)" : ""}</span>
                {r.ultimaReavaliacaoEm && <> · última em {formatarDataHora(r.ultimaReavaliacaoEm, fuso)}</>}
              </dd>
              <dt>Cadastro</dt>
              <dd>{r.criadoPor.nome} · {formatarDataHora(r.criadoEm, fuso)}</dd>
              {r.itensSwot.length > 0 && (
                <>
                  <dt>Origem SWOT</dt>
                  <dd>
                    {r.itensSwot.map((i) => (
                      <Link key={i.id} href={`/swot/${i.ciclo.id}`} className={styles.linkBloco}>
                        {ROTULO_QUADRANTE[i.quadrante]} {i.ciclo.ano}: {i.descricao}
                      </Link>
                    ))}
                  </dd>
                </>
              )}
            </dl>
            {g && (
              <details className={styles.editar}>
                <summary>Editar dados e avaliação</summary>
                <RiscoFormulario acao={editarRiscoAcao} modo="editar" botao="Salvar" inicial={valores} escalas={op.escalas} processos={op.processos} obras={op.obras} usuarios={op.usuarios} />
              </details>
            )}
            {g && aprovadores.length > 0 && (
              <details className={styles.editar}>
                <summary>Solicitar alteração via aprovação (assinaturas)</summary>
                <RiscoFormulario
                  acao={solicitarAlteracaoAcao}
                  modo="aprovacao"
                  botao="Enviar para aprovação"
                  inicial={valores}
                  escalas={op.escalas}
                  processos={op.processos}
                  obras={op.obras}
                  usuarios={op.usuarios}
                  aprovadores={aprovadores}
                />
              </details>
            )}
          </Cartao>

          <Cartao titulo="Avaliação">
            <div className={styles.avaliacoes}>
              <div className={styles.blocoAvaliacao}>
                <span className={styles.rotulo}>Inicial</span>
                <BadgeFaixa faixa={r.faixa} score={r.score} />
                <span className={styles.detalheAvaliacao}>{eixoP.rotulo} {r.probabilidade} × {eixoI.rotulo} {r.impacto}</span>
              </div>
              <div className={styles.blocoAvaliacao}>
                <span className={styles.rotulo}>Residual</span>
                {r.faixaResidual ? (
                  <>
                    <BadgeFaixa faixa={r.faixaResidual} score={r.scoreResidual} />
                    <span className={styles.detalheAvaliacao}>{eixoP.rotulo} {r.probabilidadeResidual} × {eixoI.rotulo} {r.impactoResidual}</span>
                  </>
                ) : (
                  <span className={styles.detalheAvaliacao}>Não avaliado</span>
                )}
              </div>
            </div>
            {t && (
              <details className={styles.editar}>
                <summary>Reavaliar</summary>
                <FormAcao acao={reavaliarAcao} botao="Registrar reavaliação" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="versao" value={r.versao} />
                  <SelecaoNivel nome="probabilidade" rotulo={eixoP.rotulo} niveis={eixoP.niveis} valor={r.probabilidade} />
                  <SelecaoNivel nome="impacto" rotulo={eixoI.rotulo} niveis={eixoI.niveis} valor={r.impacto} />
                  <SelecaoNivel nome="probabilidadeResidual" rotulo={`${eixoP.rotulo} residual`} niveis={eixoP.niveis} valor={r.probabilidadeResidual} opcional />
                  <SelecaoNivel nome="impactoResidual" rotulo={`${eixoI.rotulo} residual`} niveis={eixoI.niveis} valor={r.impactoResidual} opcional />
                  <label className={styles.campoLargo}>
                    Observação <input name="observacao" maxLength={1000} className={styles.entrada} />
                  </label>
                </FormAcao>
              </details>
            )}
          </Cartao>

          <Cartao titulo="Tratamento">
            {r.tratamento ? (
              <p className={styles.texto}>
                <strong>{ROTULO_TRATAMENTO[r.tratamento]}</strong>
                {r.descricaoTratamento ? ` — ${r.descricaoTratamento}` : ""}
              </p>
            ) : (
              <p className={styles.vazio}>Tratamento ainda não definido.</p>
            )}
            {t && (
              <details className={styles.editar} open={!r.tratamento}>
                <summary>{r.tratamento ? "Alterar tratamento / residual" : "Definir tratamento"}</summary>
                <TratamentoFormulario
                  acao={definirTratamentoAcao}
                  id={r.id}
                  versao={r.versao}
                  tipo={r.tipo}
                  faixa={r.faixa}
                  config={config}
                  temPlano={!!r.planoAcaoId}
                  usuarios={op.usuarios}
                  inicial={{
                    tratamento: r.tratamento ?? "",
                    descricaoTratamento: r.descricaoTratamento ?? "",
                    probabilidadeResidual: r.probabilidadeResidual ? String(r.probabilidadeResidual) : "",
                    impactoResidual: r.impactoResidual ? String(r.impactoResidual) : "",
                  }}
                />
              </details>
            )}
            {t && (
              <FormAcao acao={alterarStatusAcao} botao="Alterar status" variante="secundario" tamanho="pequeno" className={styles.formLinha}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="versao" value={r.versao} />
                <select name="status" defaultValue={r.status} aria-label="Status" className={styles.entrada}>
                  {STATUS_RISCO.map((s) => <option key={s} value={s}>{ROTULO_STATUS_RISCO[s]}</option>)}
                </select>
                <input name="observacao" placeholder="Observação (opcional)" aria-label="Observação" className={styles.entrada} />
              </FormAcao>
            )}
          </Cartao>

          <Cartao titulo="Plano de ação">
            {r.planoAcao ? (
              <>
                <p className={styles.texto}>
                  <Link href={linkPlano(r.planoAcao.id)} className={styles.linkForte}>{r.planoAcao.titulo}</Link>
                </p>
                <ul className={styles.itensPlano}>
                  {r.planoAcao.itens.map((i) => (
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
                <p className={styles.vazio}>
                  Nenhum plano vinculado.
                  {r.tratamento && (r.tratamento === "MITIGAR" || r.tratamento === "EVITAR") && (r.faixa === "ALTO" || r.faixa === "CRITICO")
                    ? " Este tratamento exige plano de ação."
                    : ""}
                </p>
                {t && (
                  <details className={styles.editar}>
                    <summary>Gerar plano de ação (5W2H)</summary>
                    <ItensForm acao={gerarPlanoAcao} ocultos={{ id: r.id }} usuarios={op.usuarios} />
                  </details>
                )}
              </>
            )}
          </Cartao>
        </div>

        <div className={styles.coluna}>
          <Cartao titulo={`Histórico de avaliações · ${historico.length}`}>
            {historico.length === 0 ? (
              <p className={styles.vazio}>Sem histórico.</p>
            ) : (
              <ol className={styles.historico}>
                {historico.map((h) => (
                  <li key={h.id} className={styles.eventoHistorico}>
                    <div className={styles.cabecalhoEvento}>
                      <strong>{ROTULO_ACAO[h.acao]}</strong>
                      <span>{formatarDataHora(h.criadoEm, fuso)} · {h.usuario.nome}</span>
                    </div>
                    <div className={styles.linhaEvento}>
                      <span>Inicial {h.probabilidade}×{h.impacto} = {h.score} ({ROTULO_FAIXA[h.faixa]})</span>
                      {h.faixaResidual && <span>Residual {h.probabilidadeResidual}×{h.impactoResidual} = {h.scoreResidual} ({ROTULO_FAIXA[h.faixaResidual]})</span>}
                      <span>{ROTULO_STATUS_RISCO[h.status]}{h.tratamento ? ` · ${ROTULO_TRATAMENTO[h.tratamento]}` : ""}</span>
                    </div>
                    {h.observacao && <p className={styles.observacao}>{h.observacao}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Cartao>

          <AprovacoesDaEntidade entidadeTipo="RISCO_OPORTUNIDADE" entidadeId={r.id} />

          <Cartao titulo={`Anexos${anexos.length ? ` · ${anexos.length}` : ""}`}>
            <GaleriaAnexos anexos={anexos} fuso={fuso} />
            {podeAnexar && <EnviarAnexos tipo="RISCO_OPORTUNIDADE" entidadeId={r.id} />}
          </Cartao>

          <Interacoes a={a} tipo="RISCO_OPORTUNIDADE" entidadeId={r.id} usuarios={op.usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}

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
