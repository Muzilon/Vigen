import type { TipoProcesso } from "@prisma/client";
import { montarLayoutMapa, ROTULO_TIPO_PROCESSO } from "@/lib/processos/regras";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/processos-mapa.module.css";

// Classes de CSS (cores) de cada raia do mapa e, logo abaixo, de cada caixa de processo, conforme o tipo.
const CLASSE_RAIA: Record<TipoProcesso, string> = {
  GESTAO: styles.raiaGestao,
  FINALISTICO: styles.raiaFinalistico,
  APOIO: styles.raiaApoio,
};
const CLASSE_CAIXA: Record<TipoProcesso, string> = {
  GESTAO: styles.caixaGestao,
  FINALISTICO: styles.caixaFinalistico,
  APOIO: styles.caixaApoio,
};

/** Quebra o nome em até 2 linhas (~22 caracteres cada) para caber na caixa. */
function linhasNome(nome: string, max = 22): string[] {
  const palavras = nome.split(/\s+/);
  const linhas: string[] = [""];
  for (const p of palavras) {
    const atual = linhas[linhas.length - 1];
    if ((atual + " " + p).trim().length <= max) linhas[linhas.length - 1] = (atual + " " + p).trim();
    else if (linhas.length < 2) linhas.push(p);
    else {
      linhas[1] = (linhas[1] + " " + p).slice(0, max - 1) + "…";
      break;
    }
  }
  return linhas;
}

/**
 * O mapa visual dos processos: um desenho (SVG) em 3 raias (gestão, finalísticos, apoio) com uma caixa por processo,
 * setas de sequência e de interação, e o "Cliente" nas pontas. Cada caixa é um link para o detalhe do processo.
 * As posições são calculadas por `montarLayoutMapa` (lib/processos/regras). Sem processos, mostra uma mensagem.
 */
/** Diagrama SVG em 3 raias gerado da ordem da planilha; cada caixa leva ao detalhe. */
export function MapaProcessos({
  processos,
  interacoes,
}: {
  processos: { id: string; codigo: string; nome: string; tipo: TipoProcesso; ordem: number }[];
  interacoes: { origemId: string; destinoId: string; descricao: string | null }[];
}) {
  if (processos.length === 0) return <EstadoVazio>Nenhum processo cadastrado. Adicione processos na aba Planilha.</EstadoVazio>;
  // `L` é o "desenho pronto": tamanho total, raias, caixas, setas e clientes, todos com posição calculada.
  const L = montarLayoutMapa(processos, interacoes);
  return (
    <div className={styles.envoltorio}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${L.largura} ${L.altura}`}
        width={L.largura}
        height={L.altura}
        role="img"
        aria-label="Mapa de processos em três raias: gestão, finalísticos e apoio"
      >
        <defs>
          <marker id="seta-fluxo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className={styles.pontaFluxo} />
          </marker>
          <marker id="seta-interacao" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className={styles.pontaInteracao} />
          </marker>
        </defs>

        {L.raias.map((r) => (
          <g key={r.tipo}>
            <rect x={8} y={r.y} width={L.largura - 16} height={r.altura} rx={8} className={CLASSE_RAIA[r.tipo]} />
            <text x={20} y={r.y + 22} className={styles.rotuloRaia}>{r.rotulo}</text>
          </g>
        ))}

        {(["entrada", "saida"] as const).map((k) => {
          const c = L.clientes[k];
          return (
            <g key={k}>
              <rect x={c.x} y={c.y} width={c.largura} height={c.altura} rx={32} className={styles.cliente} />
              <text x={c.x + c.largura / 2} y={c.y + c.altura / 2 - 4} textAnchor="middle" className={styles.textoCliente}>Cliente</text>
              <text x={c.x + c.largura / 2} y={c.y + c.altura / 2 + 12} textAnchor="middle" className={styles.subtextoCliente}>
                {k === "entrada" ? "requisitos" : "satisfação"}
              </text>
            </g>
          );
        })}

        {L.setas.map((s, i) => (
          <path
            key={i}
            d={s.d}
            className={s.tipo === "fluxo" ? styles.setaFluxo : styles.setaInteracao}
            markerEnd={`url(#${s.tipo === "fluxo" ? "seta-fluxo" : "seta-interacao"})`}
          >
            <title>{s.titulo}</title>
          </path>
        ))}

        {L.caixas.map((c) => (
          <a key={c.id} href={`/processos/${c.id}`} className={styles.linkCaixa}>
            <title>{`${c.codigo} — ${c.nome} (${ROTULO_TIPO_PROCESSO[c.tipo]})`}</title>
            <rect x={c.x} y={c.y} width={c.largura} height={c.altura} rx={6} className={CLASSE_CAIXA[c.tipo]} />
            <text x={c.x + 10} y={c.y + 18} className={styles.codigoCaixa}>{c.codigo}</text>
            {linhasNome(c.nome).map((l, i) => (
              <text key={i} x={c.x + 10} y={c.y + 36 + i * 15} className={styles.nomeCaixa}>{l}</text>
            ))}
          </a>
        ))}
      </svg>
      <p className={styles.legenda}>
        <span className={styles.legendaFluxo} aria-hidden="true" /> sequência dos processos finalísticos (cliente → cliente)
        <span className={styles.legendaInteracao} aria-hidden="true" /> interações cadastradas no detalhe do processo
      </p>
    </div>
  );
}
