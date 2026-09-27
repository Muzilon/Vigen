import Link from "next/link";
import { notFound } from "next/navigation";
import {
  editarRequisitoAcao,
  excluirRequisitoAcao,
  gerarPlanoRequisitoAcao,
  registrarVerificacaoAcao,
} from "@/app/(app)/requisitos-legais/actions";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData, formatarDataHora, hojeNoFuso } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { linkPlano } from "@/lib/plano-acao/acesso";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import {
  ROTULO_ACAO_REQUISITO,
  ROTULO_ESFERA,
  ROTULO_STATUS_REQUISITO,
  ROTULO_TEMA,
  ROTULO_TIPO_REQUISITO,
  statusExigePlano,
  verificacaoVencida,
} from "@/lib/requisitos-legais/regras";
import {
  listarHistoricoRequisito,
  obterRequisito,
  opcoesRequisitos,
  podeGerenciarRequisitos,
  podeVerificarRequisito,
} from "@/lib/requisitos-legais/servico";
import { getContexto } from "@/lib/tenant";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { BadgeStatusRequisito } from "@/paginas/html/componentes/badge";
import { BadgeStatusItem } from "@/paginas/html/componentes/badge-status-item";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { ItensForm } from "@/paginas/html/componentes/tabela-5w2h";
import { CamposRequisito, CamposVerificacao } from "@/paginas/html/requisito-legal-formulario";
import styles from "@/paginas/css/requisito-legal-detalhe.module.css";

/** Detalhe do requisito legal: dados, verificação de atendimento, plano, histórico (evidência), anexos e comentários. */
export default async function RequisitoLegalDetalhe({ params }: PageProps<"/requisitos-legais/[id]">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "REQUISITOS_LEGAIS");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const r = await obterRequisito(a, id);
  if (!r) notFound();
  const alvo = { tipo: "REQUISITO_LEGAL" as const, entidadeId: r.id };
  const [historico, op, fuso, anexos, podeAnexar] = await Promise.all([
    listarHistoricoRequisito(a, r.id),
    opcoesRequisitos(a),
    fusoDaEmpresa(a),
    listarAnexos(a, alvo),
    podeEnviarAnexo(a, alvo),
  ]);
  const hoje = hojeNoFuso(fuso);
  const g = podeGerenciarRequisitos(a);
  const v = podeVerificarRequisito(a, r);
  const vencida = verificacaoVencida(r.proximaVerificacaoEm ? dataIso(r.proximaVerificacaoEm) : null, hoje, r.status);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/requisitos-legais" className={styles.linkVoltar}>← Requisitos legais</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{r.codigo} · {ROTULO_TIPO_REQUISITO[r.tipo]} · {ROTULO_ESFERA[r.esfera]}</p>
          <h1 className={styles.titulo}>{r.numero} — {r.titulo}</h1>
          <p className={styles.meta}>
            <BadgeStatusRequisito status={r.status} rotulo={ROTULO_STATUS_REQUISITO[r.status]} />
            <span>{ROTULO_TEMA[r.tema]}</span>
            <span>Responsável: {r.responsavel?.nome ?? "—"}</span>
            {vencida && <span className={styles.vencida}>Verificação vencida</span>}
          </p>
        </div>
        {g && (
          <FormAcao acao={excluirRequisitoAcao} botao="Excluir" variante="perigo" tamanho="pequeno" confirmar={`Excluir ${r.codigo}? O histórico é preservado.`}>
            <input type="hidden" name="id" value={r.id} />
          </FormAcao>
        )}
      </header>

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo="Dados do requisito">
            <dl className={styles.dados}>
              <dt>Órgão emissor</dt>
              <dd>{r.orgaoEmissor ?? "—"}</dd>
              <dt>Publicação</dt>
              <dd>{formatarData(r.dataPublicacao)}</dd>
              <dt>Resumo</dt>
              <dd>{r.resumo ?? "—"}</dd>
              <dt>Aplicabilidade</dt>
              <dd>{r.aplicabilidade ?? "—"}</dd>
              <dt>Aplicável a</dt>
              <dd>{r.obra?.nome ?? "Empresa toda"}</dd>
              <dt>Processo</dt>
              <dd>{r.processo ? <Link href={`/processos/${r.processo.id}`}>{r.processo.codigo} — {r.processo.nome}</Link> : "—"}</dd>
              <dt>Verificação</dt>
              <dd>
                a cada {r.periodicidadeMeses} {r.periodicidadeMeses === 1 ? "mês" : "meses"} · última em {formatarData(r.ultimaVerificacaoEm)} · próxima em{" "}
                <span className={vencida ? styles.textoVencido : undefined}>{r.status === "NAO_APLICAVEL" ? "—" : formatarData(r.proximaVerificacaoEm)}{vencida ? " (vencida)" : ""}</span>
              </dd>
              <dt>Cadastro</dt>
              <dd>{r.criadoPor.nome} · {formatarDataHora(r.criadoEm, fuso)}</dd>
            </dl>
            {g && (
              <details className={styles.editar}>
                <summary>Editar dados</summary>
                <FormAcao acao={editarRequisitoAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="versao" value={r.versao} />
                  <CamposRequisito
                    v={{
                      tipo: r.tipo,
                      numero: r.numero,
                      titulo: r.titulo,
                      esfera: r.esfera,
                      tema: r.tema,
                      orgaoEmissor: r.orgaoEmissor ?? "",
                      resumo: r.resumo ?? "",
                      aplicabilidade: r.aplicabilidade ?? "",
                      dataPublicacao: r.dataPublicacao ? dataIso(r.dataPublicacao) : "",
                      processoId: r.processoId ?? "",
                      obraId: r.obraId ?? "",
                      responsavelId: r.responsavelId ?? "",
                      periodicidadeMeses: String(r.periodicidadeMeses),
                    }}
                    obras={op.obras}
                    processos={op.processos}
                    usuarios={op.usuarios}
                  />
                </FormAcao>
              </details>
            )}
          </Cartao>

          <Cartao titulo="Verificação de atendimento">
            <p className={styles.texto}>
              Situação atual: <BadgeStatusRequisito status={r.status} rotulo={ROTULO_STATUS_REQUISITO[r.status]} />
              {statusExigePlano(r.status) && !r.planoAcaoId && <span className={styles.textoVencido}> — exige plano de ação</span>}
            </p>
            {v ? (
              <details className={styles.editar} open={vencida || r.status === "EM_ANALISE"}>
                <summary>Registrar verificação</summary>
                <FormAcao acao={registrarVerificacaoAcao} botao="Registrar verificação" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="versao" value={r.versao} />
                  <CamposVerificacao usuarios={op.usuarios} statusInicial={r.status} comData hoje={hoje} temPlano={!!r.planoAcaoId} />
                </FormAcao>
                <p className={styles.dica}>A evidência documental (licença, laudo, ASO, certificado) pode ser anexada na seção Evidências.</p>
              </details>
            ) : (
              <p className={styles.vazio}>Somente quem gerencia requisitos legais ou o responsável registra verificações.</p>
            )}
          </Cartao>

          <Cartao titulo="Plano de ação">
            {r.planoAcao ? (
              <>
                <p className={styles.texto}><Link href={linkPlano(r.planoAcao.id)} className={styles.linkForte}>{r.planoAcao.titulo}</Link></p>
                <ul className={styles.itensPlano}>
                  {r.planoAcao.itens.map((i) => (
                    <li key={i.id} className={styles.itemPlano}>
                      <span>{i.oQue}</span>
                      <span className={styles.detalhe}>{i.quem.nome} · {formatarData(i.quando)}</span>
                      <BadgeStatusItem status={statusEfetivoItem(i, hoje)} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className={styles.vazio}>Nenhum plano vinculado.</p>
                {v && (
                  <details className={styles.editar}>
                    <summary>Gerar plano de ação (5W2H)</summary>
                    <ItensForm acao={gerarPlanoRequisitoAcao} ocultos={{ id: r.id }} usuarios={op.usuarios} />
                  </details>
                )}
              </>
            )}
          </Cartao>
        </div>

        <div className={styles.coluna}>
          <Cartao titulo={`Histórico de atendimento · ${historico.length}`}>
            {historico.length === 0 ? (
              <p className={styles.vazio}>Sem histórico.</p>
            ) : (
              <ol className={styles.historico}>
                {historico.map((h) => (
                  <li key={h.id} className={styles.eventoHistorico}>
                    <div className={styles.cabecalhoEvento}>
                      <strong>{ROTULO_ACAO_REQUISITO[h.acao]}</strong>
                      <span>{formatarDataHora(h.criadoEm, fuso)} · {h.usuario.nome}</span>
                    </div>
                    <div className={styles.linhaEvento}>
                      {h.statusAnterior && h.statusAnterior !== h.statusNovo ? (
                        <span>{ROTULO_STATUS_REQUISITO[h.statusAnterior]} → <strong>{ROTULO_STATUS_REQUISITO[h.statusNovo]}</strong></span>
                      ) : (
                        <span>{ROTULO_STATUS_REQUISITO[h.statusNovo]}</span>
                      )}
                      {h.dataVerificacao && <span>verificado em {formatarData(h.dataVerificacao)}</span>}
                    </div>
                    {h.observacao && <p className={styles.observacao}>{h.observacao}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Cartao>

          <Cartao titulo={`Evidências de atendimento${anexos.length ? ` · ${anexos.length}` : ""}`}>
            <GaleriaAnexos anexos={anexos} fuso={fuso} vazio="Nenhuma evidência anexada." />
            {podeAnexar && <EnviarAnexos tipo="REQUISITO_LEGAL" entidadeId={r.id} rotulo="Anexar evidência" />}
          </Cartao>

          <Interacoes a={a} tipo="REQUISITO_LEGAL" entidadeId={r.id} usuarios={op.usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}
