import type { Contagem } from "@/lib/indicadores/calculos";
import styles from "@/paginas/css/dashboard-graficos.module.css";

/**
 * Gráficos SVG/HTML do Dashboard. Cores vêm dos tokens de base.css via classes
 * de dashboard-graficos.module.css (nunca hex solto aqui).
 */

/** Classe de cor por status de item de ação. */
const CLASSE_STATUS: Record<string, string> = {
  PENDENTE: styles.corPendente,
  EM_ANDAMENTO: styles.corEmAndamento,
  ATRASADO: styles.corAlerta,
  CONCLUIDO: styles.corConcluido,
  CANCELADO: styles.corCancelado,
};
/** Classe de cor por gravidade de RNC. */
const CLASSE_GRAV: Record<string, string> = {
  BAIXA: styles.corGravBaixa,
  MEDIA: styles.corGravMedia,
  ALTA: styles.corGravAlta,
  CRITICA: styles.corGravCritica,
};

export function Vazio({ texto = "Sem dados no período e filtros selecionados." }: { texto?: string }) {
  return <p className={styles.vazio}>{texto}</p>;
}

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => `${NOMES_MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

/**
 * Barras mensais. O SVG só desenha grade e barras e estica na largura (preserveAspectRatio
 * "none", traço sem escala); os rótulos dos eixos são HTML fora do SVG, então o tamanho da
 * fonte é o mesmo do resto da página em qualquer largura (antes o viewBox escalava o texto).
 */
export function GraficoMensal({ dados }: { dados: { mes: string; abertas: number; encerradas: number }[] }) {
  if (dados.every((d) => d.abertas === 0 && d.encerradas === 0)) return <Vazio />;
  const max = Math.max(1, ...dados.flatMap((d) => [d.abertas, d.encerradas]));
  const W = 720, H = 200, mt = 8;
  const larg = W / dados.length;
  const bw = Math.max(4, Math.min(18, larg / 3));
  const y = (v: number) => mt + (H - mt) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <div>
      <div className={styles.legenda}>
        <Legenda classe={styles.corAbertas} texto="Abertas" />
        <Legenda classe={styles.corEncerradas} texto="Encerradas" />
      </div>
      <div className={styles.grafico}>
        {/* posições dos rótulos derivam dos dados: por isso inline */}
        <div className={styles.eixoY} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className={styles.textoEixo} style={{ top: pct(y(t), H) }}>{t}</span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svgMensal} role="img" aria-label="RNCs abertas e encerradas por mês">
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} vectorEffect="non-scaling-stroke" className={t === 0 ? styles.linhaBase : styles.linhaGrade} />
          ))}
          {dados.map((d, i) => {
            const cx = larg * i + larg / 2;
            return (
              <g key={d.mes}>
                <rect x={cx - bw - 1} y={y(d.abertas)} width={bw} height={y(0) - y(d.abertas)} className={styles.corAbertas}>
                  <title>{`${rotuloMes(d.mes)}: ${d.abertas} abertas`}</title>
                </rect>
                <rect x={cx + 1} y={y(d.encerradas)} width={bw} height={y(0) - y(d.encerradas)} className={styles.corEncerradas}>
                  <title>{`${rotuloMes(d.mes)}: ${d.encerradas} encerradas`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
        <div className={styles.eixoX} aria-hidden="true">
          {dados.map((d, i) => (
            <span key={d.mes} className={`${styles.textoMes} ${i % 2 === 1 ? styles.textoMesAlternado : ""}`} style={{ left: pct(larg * i + larg / 2, W) }}>
              {rotuloMes(d.mes)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Legenda({ classe, texto }: { classe: string; texto: string }) {
  return (
    <span className={styles.itemLegenda}>
      <span className={`${styles.amostraLegenda} ${classe}`} aria-hidden />
      {texto}
    </span>
  );
}

/** Barras horizontais com rótulo e valor em texto (legível sem depender de cor). */
export function Barras({ dados, paleta, vazio }: { dados: Contagem[]; paleta?: "gravidade" | "status" | "alerta"; vazio?: string }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total === 0) return <Vazio texto={vazio} />;
  const max = Math.max(...dados.map((d) => d.valor));
  const cor = (k: string) =>
    (paleta === "gravidade" ? CLASSE_GRAV[k] : paleta === "status" ? CLASSE_STATUS[k] : paleta === "alerta" ? styles.corAlerta : undefined) ??
    styles.corBarra;
  return (
    <ul className={styles.listaBarras}>
      {dados.map((d) => (
        <li key={d.chave}>
          <div className={styles.linhaBarra}>
            <span className={styles.rotuloBarra}>{d.rotulo}</span>
            <span className={styles.valorBarra}>
              {d.valor} <span className={styles.percentualBarra}>· {Math.round((d.valor / total) * 100)}%</span>
            </span>
          </div>
          <div className={styles.trilhoBarra}>
            {/* largura proporcional ao maior valor: dado dinâmico, por isso inline */}
            <div className={`${styles.preenchimentoBarra} ${cor(d.chave)}`} style={{ width: `${(d.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
