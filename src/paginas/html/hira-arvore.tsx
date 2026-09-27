"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ROTULO_HIERARQUIA } from "@/lib/hira/regras";
import type { LinhaHiraListada } from "@/lib/hira/servico";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import styles from "@/paginas/css/hira-arvore.module.css";

const SEM_PROCESSO = "— sem processo —";

/**
 * Master-detail (docs/ideias-implantadas/01-riscos-hira-laia.md, item 2): árvore
 * Obra > Processo > Atividade à esquerda; ao clicar em uma atividade, os perigos (HIRA) dela
 * aparecem em cards à direita — evita o scroll horizontal infinito da planilha densa.
 */
export function HiraArvore({ linhas }: { linhas: LinhaHiraListada[] }) {
  const arvore = useMemo(() => construirArvore(linhas), [linhas]);
  const [obraAberta, setObraAberta] = useState<string | null>(arvore[0]?.obraId ?? null);
  const [processoAberto, setProcessoAberto] = useState<string | null>(null);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<string | null>(null);

  const obra = arvore.find((o) => o.obraId === obraAberta) ?? null;
  const processo = obra?.processos.find((p) => p.chave === processoAberto) ?? null;
  const atividade = processo?.atividades.find((a) => a.chave === atividadeSelecionada) ?? null;

  return (
    <div className={styles.envoltorio}>
      <nav className={styles.arvore} aria-label="Obra, processo e atividade">
        {arvore.map((o) => (
          <div key={o.obraId} className={styles.obra}>
            <button
              type="button"
              className={styles.botaoObra}
              onClick={() => {
                const abrir = obraAberta === o.obraId ? null : o.obraId;
                setObraAberta(abrir);
                setProcessoAberto(null);
                setAtividadeSelecionada(null);
              }}
            >
              <span>🏗️ {o.obraNome}</span>
              <span className={styles.contador}>{o.total}</span>
            </button>
            {obraAberta === o.obraId &&
              o.processos.map((p) => (
                <div key={p.chave}>
                  <button
                    type="button"
                    className={styles.botaoProcesso}
                    onClick={() => {
                      const abrir = processoAberto === p.chave ? null : p.chave;
                      setProcessoAberto(abrir);
                      setAtividadeSelecionada(null);
                    }}
                  >
                    <span>⚙️ {p.nome}</span>
                    <span className={styles.contador}>{p.total}</span>
                  </button>
                  {processoAberto === p.chave &&
                    p.atividades.map((a) => (
                      <button
                        key={a.chave}
                        type="button"
                        className={`${styles.botaoAtividade} ${atividadeSelecionada === a.chave ? styles.atividadeSelecionada : ""}`}
                        onClick={() => setAtividadeSelecionada(a.chave)}
                      >
                        <span>🛠️ {a.nome}</span>
                        <span className={styles.contador}>{a.linhas.length}</span>
                      </button>
                    ))}
                </div>
              ))}
          </div>
        ))}
      </nav>

      <div className={styles.detalhe}>
        {!atividade ? (
          <p className={styles.vazio}>Escolha uma obra, um processo e uma atividade à esquerda para ver os perigos mapeados.</p>
        ) : (
          <>
            <p className={styles.tituloDetalhe}>{atividade.nome}</p>
            <ul className={styles.cartoes}>
              {atividade.linhas.map((l) => (
                <li key={l.id} className={styles.cartao}>
                  <Link href={`/hira/${l.id}`} className={styles.linkCartao}>{l.perigo}</Link>
                  <p className={styles.textoSecundario}>{l.risco}</p>
                  <div className={styles.linhaCartao}>
                    <BadgeFaixa faixa={l.faixa} score={l.score} />
                    {l.hierarquiaControle && <span className={styles.textoSecundario}>{ROTULO_HIERARQUIA[l.hierarquiaControle]}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

interface NoAtividade {
  chave: string;
  nome: string;
  linhas: LinhaHiraListada[];
}
interface NoProcesso {
  chave: string;
  nome: string;
  total: number;
  atividades: NoAtividade[];
}
interface NoObra {
  obraId: string;
  obraNome: string;
  total: number;
  processos: NoProcesso[];
}

function construirArvore(linhas: LinhaHiraListada[]): NoObra[] {
  const obras = new Map<string, NoObra>();
  for (const l of linhas) {
    let obra = obras.get(l.obraId);
    if (!obra) {
      obra = { obraId: l.obraId, obraNome: l.obra.nome, total: 0, processos: [] };
      obras.set(l.obraId, obra);
    }
    obra.total++;
    const chaveProcesso = l.processo?.id ?? "sem-processo";
    let processo = obra.processos.find((p) => p.chave === chaveProcesso);
    if (!processo) {
      processo = { chave: chaveProcesso, nome: l.processo ? `${l.processo.codigo} — ${l.processo.nome}` : SEM_PROCESSO, total: 0, atividades: [] };
      obra.processos.push(processo);
    }
    processo.total++;
    const chaveAtividade = `${chaveProcesso}::${l.atividade}`;
    let atividade = processo.atividades.find((a) => a.chave === chaveAtividade);
    if (!atividade) {
      atividade = { chave: chaveAtividade, nome: l.atividade, linhas: [] };
      processo.atividades.push(atividade);
    }
    atividade.linhas.push(l);
  }
  return [...obras.values()].sort((a, b) => a.obraNome.localeCompare(b.obraNome));
}
