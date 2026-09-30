"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import { Botao } from "@/paginas/html/componentes/botao";
import styles from "@/paginas/css/componentes/tabela-5w2h.module.css";

/** Uma linha do plano 5W2H, com todos os campos como texto (o formulário trabalha com texto). */
export type Linha5W2H = { oQue: string; porQue: string; onde: string; quemId: string; quando: string; como: string; quanto: string };
/** Cria uma linha 5W2H em branco (usada ao clicar em "+ Linha" e ao limpar o formulário). */
export const linhaVazia = (): Linha5W2H => ({ oQue: "", porQue: "", onde: "", quemId: "", quando: "", como: "", quanto: "" });

/**
 * Itens 5W2H editáveis (várias linhas). O estado fica no componente pai: não se perde em erro.
 * Cada linha é um grupo de campos com rótulo visível; o arranjo se adapta à largura do
 * container (uma faixa só em áreas largas, duas faixas em cartões médios, empilhado no
 * celular) — nunca exige rolagem horizontal.
 */
export function Tabela5W2H({
  linhas,
  onChange,
  usuarios,
}: {
  linhas: Linha5W2H[];
  onChange: (linhas: Linha5W2H[]) => void;
  usuarios: { id: string; nome: string }[];
}) {
  const idBase = useId();
  // Altera UM campo (`k`) da linha número `i`: copia as linhas, troca só aquele valor e avisa o componente pai.
  const set = (i: number, k: keyof Linha5W2H, v: string) => onChange(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  // Gera um id único para cada campo de cada linha (liga o <label> ao campo).
  const idDe = (i: number, k: keyof Linha5W2H) => `${idBase}-${i}-${k}`;
  // Monta um campo completo: rótulo + controle, posicionado na área (`area`) indicada do layout.
  const campo = (i: number, k: keyof Linha5W2H, rotulo: ReactNode, area: string, controle: ReactNode) => (
    <div className={`${styles.campo} ${area}`}>
      <label htmlFor={idDe(i, k)} className={styles.rotulo}>{rotulo}</label>
      {controle}
    </div>
  );
  // Atalho para um campo de texto simples; `ph` é o texto de dica (placeholder).
  const texto = (i: number, k: keyof Linha5W2H, ph: string) => (
    <input id={idDe(i, k)} value={linhas[i][k]} onChange={(e) => set(i, k, e.target.value)} placeholder={ph} className={styles.entrada} />
  );
  // Rótulo de campo obrigatório: o texto seguido de um asterisco (*).
  const obrig = (t: string) => (
    <>
      {t} <span className={styles.obrigatorio}>*</span>
    </>
  );

  return (
    <div className={styles.bloco}>
      <div className={styles.lista}>
        {linhas.map((l, i) => (
          <div key={i} role="group" aria-label={`Item ${i + 1}`} className={styles.linha}>
            {campo(i, "oQue", obrig("O quê"), styles.areaOQue, texto(i, "oQue", "Ação"))}
            {campo(i, "porQue", "Por quê", styles.areaPorQue, texto(i, "porQue", "Justificativa"))}
            {campo(i, "onde", "Onde", styles.areaOnde, texto(i, "onde", "Local"))}
            {campo(i, "quemId", obrig("Quem"), styles.areaQuem, (
              <select id={idDe(i, "quemId")} value={l.quemId} onChange={(e) => set(i, "quemId", e.target.value)} className={styles.entrada}>
                <option value="">Selecione...</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            ))}
            {campo(i, "quando", obrig("Quando"), styles.areaQuando, (
              <input id={idDe(i, "quando")} type="date" value={l.quando} onChange={(e) => set(i, "quando", e.target.value)} className={`${styles.entrada} ${styles.mono}`} />
            ))}
            {campo(i, "como", "Como", styles.areaComo, texto(i, "como", "Método"))}
            {campo(i, "quanto", "Quanto (R$)", styles.areaQuanto, (
              <input
                id={idDe(i, "quanto")}
                type="number"
                min={0}
                step="0.01"
                value={l.quanto}
                onChange={(e) => set(i, "quanto", e.target.value)}
                className={`${styles.entrada} ${styles.mono}`}
              />
            ))}
            {linhas.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(linhas.filter((_, j) => j !== i))}
                className={styles.botaoRemover}
                aria-label={`Remover item ${i + 1}`}
                title="Remover linha"
              >
                ✕
              </button>
            )}
          </div>
        ))}
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
  // `linhas`: as linhas em edição (começa com uma linha em branco).
  const [linhas, setLinhas] = useState<Linha5W2H[]>([linhaVazia()]);
  // Envolve a server action: chama a ação e, se deu certo, volta o formulário para uma linha em branco.
  const [res, executar, pendente] = useActionState<Awaited<ReturnType<AcaoServidor>>, FormData>(async (prev, fd) => {
    const r = await acao(prev, fd);
    if (r?.ok && !r.erro) setLinhas([linhaVazia()]);
    return r;
  }, null);

  return (
    <form action={executar} className={styles.formulario}>
      {/* Campos escondidos vindos da página (ex.: id da RNC) + as linhas do plano convertidas em texto JSON. */}
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
