"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LinhaLaiaListada } from "@/lib/laia/servico";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import styles from "@/paginas/css/hira-arvore.module.css";

// Texto mostrado na árvore para registros que não têm processo vinculado.
const SEM_PROCESSO = "— sem processo —";

/**
 * Master-detail (docs/ideias-implantadas/01-riscos-hira-laia.md, item 2 — mesmo padrão do
 * HiraArvore): árvore Obra > Processo > Atividade à esquerda; ao clicar em uma atividade, os
 * aspectos/impactos (LAIA) dela aparecem em cards à direita.
 */
export function LaiaArvore({ linhas }: { linhas: LinhaLaiaListada[] }) {
  // Monta a árvore (Unidade > Processo > Atividade) a partir da lista plana de linhas; `useMemo` só refaz a conta se as linhas mudarem.
  const arvore = useMemo(() => construirArvore(linhas), [linhas]);
  // Qual unidade está expandida na árvore (começa na primeira).
  const [obraAberta, setObraAberta] = useState<string | null>(arvore[0]?.obraId ?? null);
  // Qual processo está expandido dentro da unidade.
  const [processoAberto, setProcessoAberto] = useState<string | null>(null);
  // Qual atividade foi clicada (é a que tem seus cartões mostrados à direita).
  const [atividadeSelecionada, setAtividadeSelecionada] = useState<string | null>(null);

  // Do estado (ids escolhidos) chegamos aos objetos: unidade aberta, processo aberto e atividade selecionada.
  const obra = arvore.find((o) => o.obraId === obraAberta) ?? null;
  const processo = obra?.processos.find((p) => p.chave === processoAberto) ?? null;
  const atividade = processo?.atividades.find((a) => a.chave === atividadeSelecionada) ?? null;

  return (
    <div className={styles.envoltorio}>
      <nav className={styles.arvore} aria-label="Unidade, processo e atividade">
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
          <p className={styles.vazio}>Escolha uma unidade, um processo e uma atividade à esquerda para ver os aspectos mapeados.</p>
        ) : (
          <>
            <p className={styles.tituloDetalhe}>{atividade.nome}</p>
            <ul className={styles.cartoes}>
              {atividade.linhas.map((l) => (
                <li key={l.id} className={styles.cartao}>
                  <Link href={`/laia/${l.id}`} className={styles.linkCartao}>{l.aspecto}</Link>
                  <p className={styles.textoSecundario}>{l.impacto}</p>
                  <div className={styles.linhaCartao}>
                    <BadgeFaixa faixa={l.faixa} score={l.score} />
                    {l.significativo && <span className={styles.textoSecundario}>Significativo</span>}
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

// Os três níveis da árvore: atividade (com suas linhas), processo (com suas atividades) e unidade (com seus processos).
// `total` é a contagem de registros abaixo de cada nó, mostrada ao lado do nome.
interface NoAtividade {
  chave: string;
  nome: string;
  linhas: LinhaLaiaListada[];
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

/**
 * Transforma a lista plana de linhas em árvore: agrupa por unidade, depois por processo, depois por atividade,
 * contando o total em cada nível. As unidades saem em ordem alfabética.
 */
function construirArvore(linhas: LinhaLaiaListada[]): NoObra[] {
  // Dicionário id da unidade → nó da unidade (evita criar a mesma unidade duas vezes).
  const obras = new Map<string, NoObra>();
  for (const l of linhas) {
    let obra = obras.get(l.obraId);
    if (!obra) {
      obra = { obraId: l.obraId, obraNome: l.obra.nome, total: 0, processos: [] };
      obras.set(l.obraId, obra);
    }
    obra.total++;
    // Identificador do processo (ou "sem-processo") e, abaixo, da atividade dentro dele.
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
