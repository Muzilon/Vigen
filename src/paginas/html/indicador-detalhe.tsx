import Link from "next/link";
import { notFound } from "next/navigation";
import { definirAtivoIndicadorAcao, editarIndicadorAcao, lancarResultadoAcao, registrarAutomaticoAcao } from "@/app/(app)/indicadores/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora, hojeNoFuso } from "@/lib/datas";
import { ehAutomatico } from "@/lib/indicadores/automaticos";
import { calcularValorIndicador, obterIndicador, opcoesIndicadores, podeGerenciarIndicadores, podeLancarResultado } from "@/lib/indicadores/gestao";
import {
  atingido,
  formatarValor,
  periodoDaData,
  ROTULO_DIRECAO,
  ROTULO_FONTE,
  ROTULO_PERIODICIDADE,
  ROTULO_SITUACAO,
  rotuloPeriodo,
  ultimosPeriodos,
  vigentesPorPeriodo,
} from "@/lib/indicadores/periodos";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeSituacaoIndicador } from "@/paginas/html/componentes/badge";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { GraficoIndicador } from "@/paginas/html/componentes/grafico-indicador";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { CamposIndicador } from "@/paginas/html/indicador-formulario";
import styles from "@/paginas/css/indicador-detalhe.module.css";

// Quantos períodos aparecem no gráfico conforme a periodicidade (12 meses, 8 trimestres, 6 semestres, 5 anos).
const PERIODOS_NO_GRAFICO = { MENSAL: 12, TRIMESTRAL: 8, SEMESTRAL: 6, ANUAL: 5 } as const;

/**
 * Página de detalhe do indicador: gráfico dos resultados contra a meta, formulário para lançar o resultado do período
 * (ou registrar o valor calculado, nos automáticos), dados cadastrais, histórico de lançamentos e comentários.
 */
/** Detalhe do indicador: gráfico do histórico vs meta, lançamento do período, trilha de lançamentos e comentários. */
export default async function IndicadorDetalhe({ params }: PageProps<"/indicadores/[id]">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Indicadores, a página responde "404 - não encontrada".
  exigirModulo(ctx, "INDICADORES");
  // `id`: o identificador do indicador, tirado do endereço.
  const { id } = await params;
  // Id em formato inválido → página 404.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca o indicador com seus resultados e a situação no último período fechado.
  const i = await obterIndicador(a, id);
  // Indicador inexistente → 404.
  if (!i) notFound();
  // Busca em paralelo as opções (para o formulário de edição) e o fuso horário da empresa.
  const [op, fuso] = await Promise.all([opcoesIndicadores(a), fusoDaEmpresa(a)]);
  // Data de hoje no fuso da empresa.
  const hoje = hojeNoFuso(fuso);
  // `g`: verdadeiro se o usuário pode editar/inativar o indicador.
  const g = podeGerenciarIndicadores(a);
  // Pode lançar resultado? Gestor ou o responsável, e só se o indicador estiver ativo.
  const podeLancar = podeLancarResultado(a, i) && i.ativo;
  // Indicador automático: o valor é calculado pelo sistema (o usuário só confirma o registro).
  const auto = ehAutomatico(i.fonte);
  // Período em andamento (ex.: "2026-09" ou "2026-T3").
  const atual = periodoDaData(hoje, i.periodicidade);
  // Para cada período, o resultado que vale (o lançamento mais recente; correções substituem os anteriores).
  const vigentes = vigentesPorPeriodo(i.resultados);
  // Os períodos que entram no gráfico, terminando no último período fechado.
  const janela = ultimosPeriodos(i.periodoReferencia, i.periodicidade, PERIODOS_NO_GRAFICO[i.periodicidade]);
  // Um ponto por período: o valor lançado (ou vazio), a meta vigente e a direção (maior/menor é melhor).
  const pontos = janela.map((p) => {
    const r = vigentes.get(p);
    return { periodo: p, valor: r ? r.valor : null, meta: r ? r.meta : i.meta, direcao: r ? r.direcao : i.direcao };
  });
  // Períodos que o usuário pode escolher ao lançar (os últimos 12, do mais novo ao mais antigo).
  const opcoesPeriodo = ultimosPeriodos(atual, i.periodicidade, 12).reverse();
  // Nos automáticos, calcula o valor do último período fechado e do período em andamento.
  const [calcReferencia, calcAtual] = auto
    ? await Promise.all([calcularValorIndicador(a, i.id, i.periodoReferencia), calcularValorIndicador(a, i.id, atual)])
    : [null, null];

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/indicadores" className={styles.linkVoltar}>← Indicadores</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>
            {ROTULO_PERIODICIDADE[i.periodicidade]} · {auto ? "automático" : "manual"}
            {i.processo ? <> · <Link href={`/processos/${i.processo.id}`}>{i.processo.codigo} — {i.processo.nome}</Link></> : null}
          </p>
          <h1 className={styles.titulo}>{i.nome}</h1>
          <p className={styles.meta}>
            <BadgeSituacaoIndicador situacao={i.situacao} rotulo={`${ROTULO_SITUACAO[i.situacao]} · ${rotuloPeriodo(i.periodoReferencia)}`} />
            <span>Meta {i.direcao === "MAIOR_MELHOR" ? "≥" : "≤"} <strong className={styles.numero}>{formatarValor(i.meta, i.unidade)}</strong></span>
            {i.resultado && <span>Resultado <strong className={styles.numero}>{formatarValor(i.resultado.valor, i.unidade)}</strong></span>}
            <span>Responsável: {i.responsavel?.nome ?? "—"}</span>
            {!i.ativo && <span className={styles.inativo}>Inativo</span>}
          </p>
        </div>
        {g && (
          <FormAcao acao={definirAtivoIndicadorAcao} botao={i.ativo ? "Inativar" : "Reativar"} variante={i.ativo ? "perigo" : "secundario"} tamanho="pequeno" confirmar={i.ativo ? "Inativar o indicador? Os resultados são preservados." : undefined}>
            <input type="hidden" name="id" value={i.id} />
            <input type="hidden" name="ativo" value={i.ativo ? "0" : "1"} />
          </FormAcao>
        )}
      </header>

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo="Resultados × meta">
            <GraficoIndicador pontos={pontos} unidade={i.unidade} />
          </Cartao>

          <section id="lancar">
            <Cartao titulo={auto ? "Registrar valor calculado" : "Lançar resultado"}>
              {auto && (
                <dl className={styles.calculado}>
                  <dt>{rotuloPeriodo(i.periodoReferencia)} (último fechado)</dt>
                  <dd>{formatarValor(calcReferencia, i.unidade)}</dd>
                  <dt>{rotuloPeriodo(atual)} (em andamento, parcial)</dt>
                  <dd>{formatarValor(calcAtual, i.unidade)}</dd>
                </dl>
              )}
              {podeLancar ? (
                <FormAcao acao={auto ? registrarAutomaticoAcao : lancarResultadoAcao} botao={auto ? "Registrar valor calculado" : "Lançar resultado"} tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={i.id} />
                  <div className={styles.linhaCampos}>
                    <label className={styles.campo}>Período
                      <select name="periodo" defaultValue={i.periodoReferencia} className={styles.entrada}>
                        {opcoesPeriodo.map((p) => (
                          <option key={p} value={p}>{rotuloPeriodo(p)}{vigentes.has(p) ? " (já lançado — corrigir)" : ""}{p === atual ? " (em andamento)" : ""}</option>
                        ))}
                      </select>
                    </label>
                    {!auto && (
                      <label className={styles.campo}>Valor ({i.unidade})
                        <input name="valor" required inputMode="decimal" placeholder="Ex.: 92,5" className={styles.entrada} />
                      </label>
                    )}
                  </div>
                  <label className={styles.campo}>Observação {auto ? "(opcional)" : "(obrigatória ao corrigir um período já lançado)"}
                    <textarea name="observacao" rows={2} maxLength={2000} className={styles.entrada} />
                  </label>
                </FormAcao>
              ) : (
                <p className={styles.vazio}>{i.ativo ? "Somente o responsável ou quem gerencia indicadores lança resultados." : "Indicador inativo."}</p>
              )}
              <p className={styles.dica}>Lançamentos não são editados: para corrigir, lance de novo o mesmo período — o mais recente vale e o anterior fica no histórico.</p>
            </Cartao>
          </section>

          <Cartao titulo="Dados do indicador">
            <dl className={styles.dados}>
              <dt>Fonte</dt>
              <dd>{ROTULO_FONTE[i.fonte]}</dd>
              <dt>Direção</dt>
              <dd>{ROTULO_DIRECAO[i.direcao]}</dd>
              <dt>Unidade</dt>
              <dd>{i.unidade}</dd>
              <dt>Fórmula</dt>
              <dd>{i.formula ?? "—"}</dd>
              <dt>Descrição</dt>
              <dd>{i.descricao ?? "—"}</dd>
              <dt>Cadastro</dt>
              <dd>{i.criadoPor.nome} · {formatarDataHora(i.criadoEm, fuso)}</dd>
            </dl>
            {g && (
              <details className={styles.editar}>
                <summary>Editar indicador</summary>
                <FormAcao acao={editarIndicadorAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="versao" value={i.versao} />
                  <CamposIndicador
                    v={{
                      nome: i.nome,
                      descricao: i.descricao ?? "",
                      processoId: i.processoId ?? "",
                      unidade: i.unidade,
                      direcao: i.direcao,
                      meta: String(i.meta).replace(".", ","),
                      periodicidade: i.periodicidade,
                      fonte: i.fonte,
                      formula: i.formula ?? "",
                      responsavelId: i.responsavelId ?? "",
                    }}
                    processos={op.processos}
                    usuarios={op.usuarios}
                  />
                </FormAcao>
                <p className={styles.dica}>Alterar a meta não muda os resultados já lançados: cada lançamento guarda a meta vigente na época.</p>
              </details>
            )}
          </Cartao>
        </div>

        <div className={styles.coluna}>
          <Cartao titulo={`Lançamentos · ${i.resultados.length}`}>
            {i.resultados.length === 0 ? (
              <p className={styles.vazio}>Nenhum resultado lançado.</p>
            ) : (
              <ol className={styles.historico}>
                {i.resultados.map((r) => {
                  // Este lançamento foi substituído por uma correção posterior do mesmo período?
                  const substituido = vigentes.get(r.periodo) !== r;
                  return (
                    <li key={r.id} className={`${styles.evento} ${substituido ? styles.substituido : ""}`}>
                      <div className={styles.cabecalhoEvento}>
                        <strong>{rotuloPeriodo(r.periodo)}</strong>
                        <span className={atingido(r.valor, r.meta, r.direcao) ? styles.ok : styles.ruim}>
                          {formatarValor(r.valor, i.unidade)} <span className={styles.metaEvento}>meta {r.direcao === "MAIOR_MELHOR" ? "≥" : "≤"} {formatarValor(r.meta, i.unidade)}</span>
                        </span>
                      </div>
                      <div className={styles.linhaEvento}>
                        <span>{formatarDataHora(r.criadoEm, fuso)} · {r.registradoPor.nome}{r.automatico ? " · calculado" : ""}</span>
                        {substituido && <span className={styles.seloSubstituido}>substituído por correção</span>}
                      </div>
                      {r.observacao && <p className={styles.observacao}>{r.observacao}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Cartao>

          <Interacoes a={a} tipo="INDICADOR" entidadeId={i.id} usuarios={op.usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}
