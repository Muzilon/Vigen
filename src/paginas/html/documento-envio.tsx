"use client";

import { useActionState, useState } from "react";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/documento-envio.module.css";

type Usuario = { id: string; nome: string };

/**
 * Envio da revisão para o motor de aprovação (estilo DocuSign): revisores e aprovadores em listas
 * ordenadas, sequencial ou paralelo. O fluxo é único: revisores assinam primeiro, depois os aprovadores.
 */
export function DocumentoEnvio({ acao, documentoId, versao, usuarios, resumo }: { acao: AcaoServidor; documentoId: string; versao: number; usuarios: Usuario[]; resumo: string }) {
  const [res, executar, pendente] = useActionState(acao, null);
  const [revisores, setRevisores] = useState<string[]>([]);
  const [aprovadores, setAprovadores] = useState<string[]>([]);
  const [modo, setModo] = useState<"SEQUENCIAL" | "PARALELO">("SEQUENCIAL");
  const [aviso, setAviso] = useState("");
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  const usados = new Set([...revisores, ...aprovadores]);

  return (
    <form
      action={executar}
      className={styles.formulario}
      onSubmit={(e) => {
        if (aprovadores.length === 0) {
          e.preventDefault();
          setAviso("Adicione ao menos um aprovador.");
        }
      }}
    >
      <input type="hidden" name="id" value={documentoId} />
      <input type="hidden" name="versao" value={versao} />
      <input type="hidden" name="modo" value={modo} />
      <input type="hidden" name="revisorIds" value={JSON.stringify(revisores)} />
      <input type="hidden" name="aprovadorIds" value={JSON.stringify(aprovadores)} />

      <div className={styles.listas}>
        <ListaOrdenada titulo="Revisores (opcional)" ajuda="Conferem o conteúdo antes dos aprovadores." ids={revisores} setIds={setRevisores} usuarios={usuarios} usados={usados} nomes={nomes} numerar={modo === "SEQUENCIAL"} />
        <ListaOrdenada titulo="Aprovadores *" ajuda="Assinam a aprovação da revisão." ids={aprovadores} setIds={(f) => { setAviso(""); setAprovadores(f); }} usuarios={usuarios} usados={usados} nomes={nomes} numerar={modo === "SEQUENCIAL"} deslocamento={revisores.length} />
      </div>

      <fieldset className={styles.grupo}>
        <legend className={styles.rotulo}>Modo</legend>
        <div className={styles.segmentado}>
          {(["SEQUENCIAL", "PARALELO"] as const).map((m) => (
            <label key={m} className={`${styles.opcao} ${modo === m ? styles.opcaoMarcada : ""}`}>
              <input type="radio" name="modoEscolha" value={m} checked={modo === m} onChange={() => setModo(m)} className={styles.radio} />
              {m === "SEQUENCIAL" ? "Sequencial" : "Paralelo"}
            </label>
          ))}
        </div>
        <p className={styles.ajuda}>{modo === "SEQUENCIAL" ? "Um signatário por vez, na ordem: revisores e depois aprovadores." : "Todos recebem ao mesmo tempo; conclui quando todos assinarem."}</p>
      </fieldset>

      <label className={styles.campo}>
        <span className={styles.rotulo}>Resumo (aparece em Aprovações)</span>
        <input name="resumo" maxLength={300} defaultValue={resumo} className={styles.entrada} />
      </label>

      <div className={styles.rodape}>
        <Botao type="submit" disabled={pendente}>{pendente ? "Enviando..." : "Enviar para revisão/aprovação"}</Botao>
      </div>
      {aviso && <p role="alert" className={styles.aviso}>{aviso}</p>}
      <RetornoAcao res={res} />
    </form>
  );
}

function ListaOrdenada({
  titulo,
  ajuda,
  ids,
  setIds,
  usuarios,
  usados,
  nomes,
  numerar,
  deslocamento = 0,
}: {
  titulo: string;
  ajuda: string;
  ids: string[];
  setIds: (f: (s: string[]) => string[]) => void;
  usuarios: Usuario[];
  usados: Set<string>;
  nomes: Map<string, string>;
  numerar: boolean;
  deslocamento?: number;
}) {
  const [escolha, setEscolha] = useState("");
  const mover = (i: number, d: -1 | 1) =>
    setIds((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <div className={styles.lista}>
      <span className={styles.rotulo}>{titulo}</span>
      <span className={styles.ajuda}>{ajuda}</span>
      <div className={styles.linhaAdicionar}>
        <select value={escolha} onChange={(e) => setEscolha(e.target.value)} className={styles.selecao} aria-label={`Adicionar a ${titulo}`}>
          <option value="">Selecione…</option>
          {usuarios.filter((u) => !usados.has(u.id)).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <Botao type="button" variante="secundario" disabled={!escolha} onClick={() => { setIds((s) => [...s, escolha]); setEscolha(""); }}>
          Adicionar
        </Botao>
      </div>
      {ids.length > 0 && (
        <ol className={styles.pessoas}>
          {ids.map((id, i) => (
            <li key={id} className={styles.pessoa}>
              <span className={styles.ordem}>{numerar ? `${deslocamento + i + 1}º` : "•"}</span>
              <span className={styles.nome}>{nomes.get(id) ?? id}</span>
              <button type="button" className={styles.botaoIcone} onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover para cima">↑</button>
              <button type="button" className={styles.botaoIcone} onClick={() => mover(i, 1)} disabled={i === ids.length - 1} aria-label="Mover para baixo">↓</button>
              <button type="button" className={styles.botaoRemover} onClick={() => setIds((s) => s.filter((x) => x !== id))}>Remover</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
