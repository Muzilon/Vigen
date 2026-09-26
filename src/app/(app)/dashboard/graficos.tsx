import type { Contagem } from "@/lib/indicadores/calculos";

/** Paleta acessível (Okabe-Ito adaptada), contraste adequado sobre fundo branco. */
export const CORES = { abertas: "#0072B2", encerradas: "#009E73", barra: "#0072B2", alerta: "#D55E00" };
const COR_STATUS: Record<string, string> = {
  PENDENTE: "#64748b", EM_ANDAMENTO: "#0072B2", ATRASADO: "#D55E00", CONCLUIDO: "#009E73", CANCELADO: "#94a3b8",
};
const COR_GRAV: Record<string, string> = { BAIXA: "#56B4E9", MEDIA: "#E69F00", ALTA: "#D55E00", CRITICA: "#9F1D35" };

export function Vazio({ texto = "Sem dados no período e filtros selecionados." }: { texto?: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{texto}</p>;
}

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => `${NOMES_MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

export function GraficoMensal({ dados }: { dados: { mes: string; abertas: number; encerradas: number }[] }) {
  if (dados.every((d) => d.abertas === 0 && d.encerradas === 0)) return <Vazio />;
  const max = Math.max(1, ...dados.flatMap((d) => [d.abertas, d.encerradas]));
  const W = 720, H = 240, ml = 32, mb = 28, mt = 12;
  const larg = (W - ml) / dados.length;
  const bw = Math.max(4, Math.min(18, larg / 3));
  const y = (v: number) => mt + (H - mt - mb) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-slate-600">
        <Legenda cor={CORES.abertas} texto="Abertas" />
        <Legenda cor={CORES.encerradas} texto="Encerradas" />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="RNCs abertas e encerradas por mês">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ml} x2={W} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x={ml - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{t}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const cx = ml + larg * i + larg / 2;
          return (
            <g key={d.mes}>
              <rect x={cx - bw - 1} y={y(d.abertas)} width={bw} height={y(0) - y(d.abertas)} fill={CORES.abertas} rx="2">
                <title>{`${rotuloMes(d.mes)}: ${d.abertas} abertas`}</title>
              </rect>
              <rect x={cx + 1} y={y(d.encerradas)} width={bw} height={y(0) - y(d.encerradas)} fill={CORES.encerradas} rx="2">
                <title>{`${rotuloMes(d.mes)}: ${d.encerradas} encerradas`}</title>
              </rect>
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#475569">{rotuloMes(d.mes)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: cor }} aria-hidden />
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
    (paleta === "gravidade" ? COR_GRAV[k] : paleta === "status" ? COR_STATUS[k] : paleta === "alerta" ? CORES.alerta : undefined) ??
    CORES.barra;
  return (
    <ul className="space-y-2.5">
      {dados.map((d) => (
        <li key={d.chave}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="truncate text-slate-700">{d.rotulo}</span>
            <span className="ml-2 font-medium text-slate-900">
              {d.valor} <span className="text-xs font-normal text-slate-500">({Math.round((d.valor / total) * 100)}%)</span>
            </span>
          </div>
          <div className="h-2.5 rounded bg-slate-100">
            <div className="h-2.5 rounded" style={{ width: `${(d.valor / max) * 100}%`, background: cor(d.chave) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
