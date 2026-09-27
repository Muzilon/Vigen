import { atingido, formatarValor, rotuloPeriodo } from "@/lib/indicadores/periodos";
import type { DirecaoIndicador } from "@prisma/client";
import styles from "@/paginas/css/componentes/grafico-indicador.module.css";

export interface PontoIndicador {
  periodo: string;
  /** null = sem lançamento no período. */
  valor: number | null;
  /** Meta vigente no lançamento (ou a atual, sem lançamento). */
  meta: number;
  direcao: DirecaoIndicador;
}

/**
 * Linha do histórico de resultados vs meta (SVG simples, sem biblioteca — mesmo espírito dos gráficos do dashboard).
 * Pontos verdes = meta atingida, vermelhos = não atingida; linha tracejada = meta; período sem lançamento fica vazio.
 * Cores só por classes do .module.css (tokens de base.css).
 */
export function GraficoIndicador({ pontos, unidade }: { pontos: PontoIndicador[]; unidade: string }) {
  const comValor = pontos.filter((p): p is PontoIndicador & { valor: number } => p.valor !== null);
  if (pontos.length === 0) return <p className={styles.vazio}>Sem períodos para exibir.</p>;
  const W = 640, H = 220, ml = 56, mr = 16, mt = 16, mb = 34;
  const valores = [...comValor.map((p) => p.valor), ...pontos.map((p) => p.meta)];
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.12;
  min = min >= 0 && min - folga < 0 ? 0 : min - folga;
  max += folga;
  const x = (i: number) => ml + (pontos.length === 1 ? (W - ml - mr) / 2 : (i * (W - ml - mr)) / (pontos.length - 1));
  const y = (v: number) => mt + (H - mt - mb) * (1 - (v - min) / (max - min));
  const ticks = [min, (min + max) / 2, max];

  // Linha de resultados: segmentos só entre períodos consecutivos com valor.
  const segmentos: string[] = [];
  let atual = "";
  pontos.forEach((p, i) => {
    if (p.valor === null) { if (atual) segmentos.push(atual); atual = ""; return; }
    atual += `${atual ? " L" : "M"} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`;
  });
  if (atual) segmentos.push(atual);
  const meta = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.meta).toFixed(1)}`).join(" ");

  return (
    <figure className={styles.figura}>
      <div className={styles.legenda} aria-hidden="true">
        <span><i className={`${styles.marca} ${styles.marcaValor}`} />Resultado</span>
        <span><i className={`${styles.marca} ${styles.marcaMeta}`} />Meta</span>
        <span><i className={`${styles.ponto} ${styles.pontoOk}`} />Atingida</span>
        <span><i className={`${styles.ponto} ${styles.pontoRuim}`} />Não atingida</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`Resultados por período comparados à meta (${unidade})`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} className={styles.grade} />
            <text x={ml - 6} y={y(t) + 4} textAnchor="end" className={styles.texto}>{formatarValor(t, unidade)}</text>
          </g>
        ))}
        <path d={meta} className={styles.linhaMeta} />
        {segmentos.map((d) => <path key={d} d={d} className={styles.linhaValor} />)}
        {pontos.map((p, i) => (
          <g key={p.periodo}>
            <text x={x(i)} y={H - 10} textAnchor="middle" className={styles.texto}>{rotuloPeriodo(p.periodo)}</text>
            {p.valor === null ? (
              <circle cx={x(i)} cy={y(p.meta)} r={4} className={styles.pontoVazio}><title>{rotuloPeriodo(p.periodo)}: sem lançamento</title></circle>
            ) : (
              <circle cx={x(i)} cy={y(p.valor)} r={5} className={atingido(p.valor, p.meta, p.direcao) ? styles.circuloOk : styles.circuloRuim}>
                <title>{`${rotuloPeriodo(p.periodo)}: ${formatarValor(p.valor, unidade)} (meta ${formatarValor(p.meta, unidade)})`}</title>
              </circle>
            )}
          </g>
        ))}
      </svg>
      <figcaption className={styles.legendaAcessivel}>
        {pontos.map((p) => `${rotuloPeriodo(p.periodo)}: ${p.valor === null ? "sem lançamento" : formatarValor(p.valor, unidade)}`).join("; ")}
      </figcaption>
    </figure>
  );
}
