"use client";

import { useActionState, useState } from "react";
import { ROTULO_METODO, SEIS_M } from "@/lib/rnc/rotulos";
import { salvarCausaAcao } from "@/app/(app)/rncs/actions";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import { Botao } from "@/paginas/html/componentes/botao";
import styles from "@/paginas/css/rnc-detalhe-causa.module.css";

// Os métodos de análise possíveis (5 Porquês, Ishikawa ou texto livre); as chaves vêm de ROTULO_METODO.
type Metodo = keyof typeof ROTULO_METODO;
// Formato guardado da análise: lista de porquês, mapa do Ishikawa (categoria → texto) ou um texto livre.
type Analise = { porques?: string[]; ishikawa?: Record<string, string>; texto?: string };

/**
 * Formulário da análise de causa raiz (5 Porquês / Ishikawa 6M / texto livre) — aba "Causa raiz" do detalhe.
 * Reaproveitado pela investigação de incidentes (P6): `acao` troca a server action (campos id/versao/metodo/analise/causaRaiz).
 */
export function CausaForm(props: {
  acao?: AcaoServidor;
  rncId: string;
  versao: number;
  metodo: Metodo | null;
  analise: Analise | null;
  causaRaiz: string | null;
}) {
  // Liga o formulário à server action (a padrão é salvar causa da RNC; outro módulo pode passar a sua): `res` é a resposta, `pendente` indica que está salvando.
  const [res, acao, pendente] = useActionState(props.acao ?? salvarCausaAcao, null);
  // Método escolhido no momento (começa com o que já estava salvo ou "5 Porquês").
  const [metodo, setMetodo] = useState<Metodo>(props.metodo ?? "CINCO_PORQUES");
  // Os 5 campos do método "5 Porquês" (começam vazios ou com o que já foi salvo).
  const [porques, setPorques] = useState<string[]>(props.analise?.porques ?? ["", "", "", "", ""]);
  // Os campos do Ishikawa: um texto para cada um dos 6M (máquina, método, mão de obra, materiais, meio ambiente, medição).
  const [ishikawa, setIshikawa] = useState<Record<string, string>>(props.analise?.ishikawa ?? {});
  // O texto do método livre ("Outro").
  const [texto, setTexto] = useState(props.analise?.texto ?? "");

  // Só o conteúdo do método escolhido vai no envio (em formato JSON, dentro de um campo escondido).
  const analise =
    metodo === "CINCO_PORQUES" ? { porques } : metodo === "ISHIKAWA" ? { ishikawa } : { texto };

  return (
    <form action={acao} className={styles.formulario}>
      <input type="hidden" name="id" value={props.rncId} />
      <input type="hidden" name="versao" value={props.versao} />
      <input type="hidden" name="metodo" value={metodo} />
      <input type="hidden" name="analise" value={JSON.stringify(analise)} />

      <div role="group" aria-label="Método de análise" className={styles.seletorMetodo}>
        {(Object.keys(ROTULO_METODO) as Metodo[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={metodo === m}
            onClick={() => setMetodo(m)}
            className={`${styles.opcaoMetodo} ${metodo === m ? styles.opcaoMetodoAtiva : ""}`}
          >
            {ROTULO_METODO[m]}
          </button>
        ))}
      </div>

      {metodo === "CINCO_PORQUES" && (
        <ol className={styles.listaPorques}>
          {porques.map((p, i) => (
            <li key={i} className={styles.linhaPorque}>
              <label htmlFor={`porque-${i}`} className={styles.rotuloPorque}>{i + 1}º Por quê?</label>
              <input
                id={`porque-${i}`}
                value={p}
                onChange={(e) => setPorques(porques.map((x, j) => (j === i ? e.target.value : x)))}
                className={styles.entrada}
              />
            </li>
          ))}
        </ol>
      )}

      {metodo === "ISHIKAWA" && (
        <div className={styles.gradeIshikawa}>
          {SEIS_M.map(([k, r]) => (
            <div key={k} className={styles.campo}>
              <label htmlFor={`ishikawa-${k}`} className={styles.rotulo}>{r}</label>
              <textarea
                id={`ishikawa-${k}`}
                rows={2}
                value={ishikawa[k] ?? ""}
                onChange={(e) => setIshikawa({ ...ishikawa, [k]: e.target.value })}
                className={styles.entrada}
              />
            </div>
          ))}
        </div>
      )}

      {metodo === "OUTRO" && (
        <div className={styles.campo}>
          <label htmlFor="analise-texto" className={styles.rotulo}>Análise</label>
          <textarea id="analise-texto" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} className={styles.entrada} />
        </div>
      )}

      <div className={`${styles.campo} ${styles.campoConclusao}`}>
        <label className={styles.rotulo} htmlFor="causaRaiz">
          Causa raiz (conclusão) <span className={styles.obrigatorio}>*</span>
        </label>
        <textarea id="causaRaiz" name="causaRaiz" rows={2} required defaultValue={props.causaRaiz ?? ""} className={styles.entrada} />
      </div>

      <RetornoAcao res={res ? { erro: res.erro, ok: res.ok } : null} />
      <div>
        <Botao type="submit" disabled={pendente}>{pendente ? "Salvando..." : "Salvar causa raiz"}</Botao>
      </div>
    </form>
  );
}
