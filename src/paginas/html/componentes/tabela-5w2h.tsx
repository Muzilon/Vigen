"use client";

import { useActionState, useState } from "react";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import { Botao } from "@/paginas/html/componentes/botao";
import styles from "@/paginas/css/componentes/tabela-5w2h.module.css";

export type Linha5W2H = { oQue: string; porQue: string; onde: string; quemId: string; quando: string; como: string; quanto: string };
export const linhaVazia = (): Linha5W2H => ({ oQue: "", porQue: "", onde: "", quemId: "", quando: "", como: "", quanto: "" });

const COLUNAS = ["O quê *", "Por quê", "Onde", "Quem *", "Quando *", "Como", "Quanto (R$)", ""];

/** Tabela 5W2H controlada (várias linhas). O estado fica no componente pai: não se perde em erro. */
export function Tabela5W2H({
  linhas,
  onChange,
  usuarios,
}: {
  linhas: Linha5W2H[];
  onChange: (linhas: Linha5W2H[]) => void;
  usuarios: { id: string; nome: string }[];
}) {
  const set = (i: number, k: keyof Linha5W2H, v: string) => onChange(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const campo = (i: number, k: keyof Linha5W2H, ph: string, classe: string) => (
    <input value={linhas[i][k]} onChange={(e) => set(i, k, e.target.value)} placeholder={ph} aria-label={ph} className={`${styles.entrada} ${classe}`} />
  );

  return (
    <div className={styles.bloco}>
      <div className={styles.rolagem}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              {COLUNAS.map((h) => (
                <th key={h} scope="col" className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td className={styles.td}>{campo(i, "oQue", "Ação", styles.largo)}</td>
                <td className={styles.td}>{campo(i, "porQue", "Justificativa", styles.medio)}</td>
                <td className={styles.td}>{campo(i, "onde", "Local", styles.curto)}</td>
                <td className={styles.td}>
                  <select value={l.quemId} onChange={(e) => set(i, "quemId", e.target.value)} aria-label="Quem" className={`${styles.entrada} ${styles.medio}`}>
                    <option value="">Selecione...</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </td>
                <td className={styles.td}>
                  <input type="date" value={l.quando} onChange={(e) => set(i, "quando", e.target.value)} aria-label="Quando" className={`${styles.entrada} ${styles.data}`} />
                </td>
                <td className={styles.td}>{campo(i, "como", "Método", styles.medio)}</td>
                <td className={styles.td}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.quanto}
                    onChange={(e) => set(i, "quanto", e.target.value)}
                    aria-label="Quanto (R$)"
                    className={`${styles.entrada} ${styles.valor}`}
                  />
                </td>
                <td className={styles.td}>
                  {linhas.length > 1 && (
                    <button type="button" onClick={() => onChange(linhas.filter((_, j) => j !== i))} className={styles.botaoRemover} aria-label="Remover linha">
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Botao type="button" variante="secundario" onClick={() => onChange([...linhas, linhaVazia()])} className={styles.botaoLinha}>
        + Linha
      </Botao>
    </div>
  );
}

/**
 * Adição de vários itens 5W2H de uma vez (plano da RNC ou plano avulso). A action recebe os
 * campos ocultos + `itens` (JSON); as linhas só são limpas em caso de sucesso.
 */
export function ItensForm({
  acao,
  ocultos,
  usuarios,
}: {
  acao: AcaoServidor;
  ocultos: Record<string, string>;
  usuarios: { id: string; nome: string }[];
}) {
  const [linhas, setLinhas] = useState<Linha5W2H[]>([linhaVazia()]);
  const [res, executar, pendente] = useActionState<Awaited<ReturnType<AcaoServidor>>, FormData>(async (prev, fd) => {
    const r = await acao(prev, fd);
    if (r?.ok && !r.erro) setLinhas([linhaVazia()]);
    return r;
  }, null);

  return (
    <form action={executar} className={styles.formulario}>
      {Object.entries(ocultos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="itens" value={JSON.stringify(linhas)} />
      <Tabela5W2H linhas={linhas} onChange={setLinhas} usuarios={usuarios} />
      <div>
        <Botao type="submit" disabled={pendente}>{pendente ? "Salvando..." : `Adicionar ${linhas.length} item(ns)`}</Botao>
        <RetornoAcao res={res ? { erro: res.erro, ok: res.ok } : null} />
      </div>
    </form>
  );
}
