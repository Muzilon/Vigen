import Link from "next/link";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { ROTULO_STATUS_COMPETENCIA, ROTULO_TIPO_TREINAMENTO } from "@/lib/treinamentos/regras";
import { meusTreinamentos } from "@/lib/treinamentos/servico";
import { BadgeStatusCompetencia } from "@/paginas/html/componentes/badge";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/treinamentos-meus.module.css";

const ORDEM = { VENCIDO: 0, A_VENCER: 1, NAO_REALIZADO: 2, EM_DIA: 3 } as const;

/** "Meus treinamentos": situação própria (o que está vencendo primeiro), certificados e histórico de sessões. */
export default async function TreinamentosMeus() {
  const ctx = await getContexto();
  exigirModulo(ctx, "TREINAMENTOS");
  const a = await getAtor();
  const { itens, historico, resumo } = await meusTreinamentos(a);
  const ordenados = [...itens].sort((x, y) => ORDEM[x.status!] - ORDEM[y.status!] || x.treinamento.nome.localeCompare(y.treinamento.nome));
  const certificadoDa = new Map(historico.filter((p) => p.presente && p.certificado).map((p) => [`${p.sessao.treinamentoId}:${dataIso(p.sessao.dataRealizacao)}`, p.certificado!]));

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina titulo="Meus treinamentos" subtitulo="Sua situação nos treinamentos obrigatórios e nos que você já fez, com validade e certificados." />
      <div className={styles.resumo}>
        <span><strong className={styles.numero}>{resumo.percentualEmDia === null ? "—" : `${resumo.percentualEmDia}%`}</strong> dos obrigatórios em dia</span>
        <span className={resumo.aVencer ? styles.aviso : undefined}><strong className={styles.numero}>{resumo.aVencer}</strong> vencendo em 30 dias</span>
        <span className={resumo.vencidos ? styles.alerta : undefined}><strong className={styles.numero}>{resumo.vencidos}</strong> vencido(s)</span>
        <span><strong className={styles.numero}>{resumo.naoRealizados}</strong> obrigatório(s) pendente(s)</span>
      </div>

      {ordenados.length === 0 ? (
        <EstadoVazio>Nenhum treinamento obrigatório ou realizado.</EstadoVazio>
      ) : (
        <ul className={styles.lista}>
          {ordenados.map((c) => {
            const cert = c.dataRealizacao ? certificadoDa.get(`${c.treinamento.id}:${c.dataRealizacao}`) : undefined;
            return (
              <li key={c.treinamento.id} className={styles.item}>
                <div>
                  <Link href={`/treinamentos/${c.treinamento.id}`} className={styles.nome}>{c.treinamento.nome}</Link>
                  <span className={styles.sub}>
                    {ROTULO_TIPO_TREINAMENTO[c.treinamento.tipo]}{c.obrigatorio ? " · obrigatório" : ""}
                    {c.dataRealizacao ? ` · realizado em ${formatarData(c.dataRealizacao)}` : ""}
                    {c.dataValidade ? ` · válido até ${formatarData(c.dataValidade)}` : c.dataRealizacao ? " · não vence" : ""}
                  </span>
                </div>
                <div className={styles.direita}>
                  {cert && <a href={`/api/anexos/${cert.id}`} className={styles.link}>Certificado</a>}
                  <BadgeStatusCompetencia status={c.status!} rotulo={ROTULO_STATUS_COMPETENCIA[c.status!]} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Cartao titulo={`Histórico de participações · ${historico.length}`}>
        {historico.length === 0 ? (
          <p className={styles.sub}>Nenhuma participação registrada.</p>
        ) : (
          <ul className={styles.historico}>
            {historico.map((p) => (
              <li key={p.id}>
                <span className={styles.mono}>{formatarData(p.sessao.dataRealizacao)}</span>
                <span>{p.sessao.treinamento.nome} · {p.sessao.instrutor}</span>
                <span className={styles.sub}>{p.presente ? "presente" : "ausente"}{p.aproveitamento ? ` · ${p.aproveitamento}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
