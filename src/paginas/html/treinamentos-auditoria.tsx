import Link from "next/link";
import { notFound } from "next/navigation";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { ROTULO_MODALIDADE, ROTULO_TIPO_TREINAMENTO } from "@/lib/treinamentos/regras";
import { podeGerenciarTreinamentos, relatorioAuditoria } from "@/lib/treinamentos/servico";
import { BotaoImprimir } from "@/paginas/html/componentes/botao-imprimir";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/treinamentos-auditoria.module.css";

/**
 * Página "Evidências de competência" (modo auditoria, ISO 9001 7.2): reúne, por treinamento, as sessões com
 * presença, certificados, eficácia e conformidade com a NR-1 — só leitura e com botão para imprimir/salvar em PDF.
 * Exige a permissão de gerenciar treinamentos.
 */
/** Modo auditoria (ISO 9001 7.2): evidências de competência consolidadas, só leitura e pronta para impressão/PDF. */
export default async function TreinamentosAuditoria() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Treinamentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "TREINAMENTOS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarTreinamentos(a)) notFound();
  // O relatório completo vem pronto do serviço: data de hoje, resumo em números (`r`) e os treinamentos com suas sessões.
  const { hoje, resumo: r, itens } = await relatorioAuditoria(a);
  // Todas as sessões de todos os treinamentos numa lista só (para somar totais).
  const sessoes = itens.flatMap((t) => t.sessoes);
  // Quantas sessões têm alguma pendência frente à NR-1 (conteúdo, instrutor qualificado, carga horária).
  const naoConformesNr1 = sessoes.filter((s) => s.pendenciasNr1 && s.pendenciasNr1.length > 0).length;
  // Soma das avaliações de eficácia que já deveriam ter sido feitas e ainda não foram.
  const eficaciaPendente = sessoes.reduce((n, s) => n + s.eficaciaPendente, 0);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Evidências de competência"
        subtitulo={`${ctx.usuario.empresaNome} · ISO 9001:2015 7.2 · posição em ${formatarData(hoje)}`}
      />
      <div className={styles.acoes}>
        <BotaoImprimir />
        <Link href="/treinamentos/matriz" className={styles.link}>Matriz de competências →</Link>
      </div>

      <section className={styles.indicadores} aria-label="Resumo">
        <div><strong>{r.percentualEmDia === null ? "—" : `${r.percentualEmDia}%`}</strong><span>obrigatórios em dia</span></div>
        <div><strong>{r.vencidos + r.naoRealizados}</strong><span>vencidos ou não realizados</span></div>
        <div><strong>{r.reciclagemPendente}</strong><span>reciclagens pendentes</span></div>
        <div><strong>{r.inaptos}</strong><span>pessoas inaptas</span></div>
        <div><strong>{naoConformesNr1}</strong><span>sessões com pendência NR-1</span></div>
        <div><strong>{eficaciaPendente}</strong><span>avaliações de eficácia pendentes</span></div>
      </section>

      {itens.length === 0 ? (
        <EstadoVazio>Nenhum treinamento ativo.</EstadoVazio>
      ) : (
        itens.map((t) => (
          <section key={t.id} className={styles.treinamento}>
            <header className={styles.cabecalhoTreinamento}>
              <h2><Link href={`/treinamentos/${t.id}`}>{t.nome}</Link></h2>
              <p>
                {ROTULO_TIPO_TREINAMENTO[t.tipo]} · {t.validadeMeses ? `validade ${t.validadeMeses} meses` : "não vence"}
                {t.critico ? " · crítico" : ""}
                {t.diasAvaliacaoEficacia ? ` · eficácia em ${t.diasAvaliacaoEficacia} dias${t.percentualEficaz === null ? "" : ` · ${t.percentualEficaz}% eficaz`}` : " · sem avaliação de eficácia"}
              </p>
            </header>
            {t.sessoes.length === 0 ? (
              <p className={styles.vazio}>Nenhuma sessão registrada.</p>
            ) : (
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Instrutor</th>
                    <th scope="col">Modalidade / CH</th>
                    <th scope="col">Presença</th>
                    <th scope="col">Certificados</th>
                    <th scope="col">Eficácia</th>
                    <th scope="col">NR-1</th>
                  </tr>
                </thead>
                <tbody>
                  {t.sessoes.map((s) => (
                    <tr key={s.id}>
                      <td className={styles.mono}>{formatarData(s.data)}</td>
                      <td>
                        {s.instrutor}
                        {s.qualificacaoInstrutor && <span className={styles.sub}>{s.qualificacaoInstrutor}</span>}
                      </td>
                      <td>{ROTULO_MODALIDADE[s.modalidade]}{s.cargaHoraria ? ` · ${s.cargaHoraria} h` : ""}{s.obra && <span className={styles.sub}>{s.obra}</span>}</td>
                      <td>{s.presentes} pres. · {s.ausentes} aus.</td>
                      <td className={s.certificados < s.presentes ? styles.atencao : undefined}>{s.certificados}/{s.presentes}</td>
                      <td>
                        {t.diasAvaliacaoEficacia ? (
                          <>
                            {s.eficazes} eficaz · {s.naoEficazes} não
                            {s.eficaciaPendente > 0 && <span className={`${styles.sub} ${styles.atencao}`}>{s.eficaciaPendente} pendente(s)</span>}
                          </>
                        ) : "—"}
                      </td>
                      <td>
                        {s.pendenciasNr1 === null ? "n/a" : s.pendenciasNr1.length === 0 ? <span className={styles.ok}>Conforme</span> : (
                          <span className={styles.atencao} title={s.pendenciasNr1.join("\n")}>{s.pendenciasNr1.length} pendência(s)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))
      )}
    </div>
  );
}
