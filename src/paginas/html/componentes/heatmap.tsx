import Link from "next/link";
import type { CorFaixa } from "@/lib/escala/tipos";
import styles from "@/paginas/css/componentes/heatmap.module.css";

/**
 * Heatmap genérico (matriz P×S) reaproveitável por Riscos e Oportunidades, HIRA, LAIA e,
 * futuramente, Partes Interessadas — ver docs/06-desenho-modulos.md, "Base comum".
 * Recebe apenas dados já calculados (rótulos dos eixos e contagem/cor por célula); não
 * conhece regra de negócio nenhuma — quem chama usa src/lib/escala/calculo.ts para chegar
 * até aqui.
 */

export interface CelulaHeatmap {
  /** Valor do eixo da linha (ex.: severidade = 3). */
  linha: number;
  /** Valor do eixo da coluna (ex.: probabilidade = 4). */
  coluna: number;
  contagem: number;
  cor: CorFaixa;
  /** Rota para o item filtrado por esta combinação (opcional). */
  href?: string;
}

export interface HeatmapProps {
  titulo: string;
  /** Rótulo e valores do eixo mostrado nas colunas (ex.: Probabilidade: 1..5). */
  eixoColuna: { rotulo: string; valores: { valor: number; rotulo: string }[] };
  /** Rótulo e valores do eixo mostrado nas linhas (ex.: Severidade: 1..5), do maior para o menor. */
  eixoLinha: { rotulo: string; valores: { valor: number; rotulo: string }[] };
  celulas: CelulaHeatmap[];
  legenda?: { cor: CorFaixa; rotulo: string }[];
}

const CLASSE_COR: Record<CorFaixa, string> = {
  baixa: styles.corBaixa,
  media: styles.corMedia,
  alta: styles.corAlta,
  critica: styles.corCritica,
};

const LEGENDA_PADRAO: { cor: CorFaixa; rotulo: string }[] = [
  { cor: "baixa", rotulo: "Baixo" },
  { cor: "media", rotulo: "Médio" },
  { cor: "alta", rotulo: "Alto" },
  { cor: "critica", rotulo: "Crítico" },
];

export function Heatmap({ titulo, eixoColuna, eixoLinha, celulas, legenda = LEGENDA_PADRAO }: HeatmapProps) {
  const porPosicao = new Map(celulas.map((c) => [`${c.linha}-${c.coluna}`, c]));
  const linhasOrdenadas = [...eixoLinha.valores].sort((a, b) => b.valor - a.valor);

  return (
    <figure className={styles.envoltorio}>
      <figcaption className={styles.titulo}>{titulo}</figcaption>
      <div className={styles.rolagem}>
        <table className={styles.tabela}>
          <caption className={styles.somenteLeitorTela}>
            {titulo}: {eixoLinha.rotulo} (linhas) por {eixoColuna.rotulo} (colunas)
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.cantoVazio}>
                <span className={styles.rotuloEixoLinha}>{eixoLinha.rotulo}</span>
                <span className={styles.rotuloEixoColuna}>{eixoColuna.rotulo}</span>
              </th>
              {eixoColuna.valores.map((c) => (
                <th key={c.valor} scope="col" className={styles.cabecalhoColuna}>
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((linha) => (
              <tr key={linha.valor}>
                <th scope="row" className={styles.cabecalhoLinha}>
                  {linha.rotulo}
                </th>
                {eixoColuna.valores.map((coluna) => {
                  const celula = porPosicao.get(`${linha.valor}-${coluna.valor}`);
                  const conteudo = celula?.contagem ?? 0;
                  const rotuloCelula = `${eixoLinha.rotulo} ${linha.rotulo}, ${eixoColuna.rotulo} ${coluna.rotulo}: ${conteudo}`;
                  return (
                    <td
                      key={coluna.valor}
                      className={`${styles.celula} ${celula ? CLASSE_COR[celula.cor] : styles.corVazia}`}
                    >
                      {celula?.href && conteudo > 0 ? (
                        <Link href={celula.href} className={styles.linkCelula} aria-label={rotuloCelula}>
                          {conteudo}
                        </Link>
                      ) : (
                        <span aria-label={rotuloCelula}>{conteudo}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={styles.legenda} aria-label="Legenda de níveis">
        {legenda.map((l) => (
          <li key={l.cor} className={styles.itemLegenda}>
            <span className={`${styles.marcadorLegenda} ${CLASSE_COR[l.cor]}`} aria-hidden="true" />
            {l.rotulo}
          </li>
        ))}
      </ul>
    </figure>
  );
}
