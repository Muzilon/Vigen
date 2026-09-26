"use client";

import { useActionState, useId, useState } from "react";
import type { TipoAlteracaoAprovacao, TipoEntidadeAprovacao } from "@prisma/client";
import { ROTULO_TIPO_ALTERACAO } from "@/lib/aprovacao/rotulos";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/componentes/solicitar-aprovacao.module.css";

export interface UsuarioAprovador {
  id: string;
  nome: string;
}

/**
 * Formulário "Solicitar aprovação" para os módulos: escolhe aprovadores (ordem importa no modo
 * sequencial), o modo e o resumo. Envia à `acao` (server action do módulo) os campos
 * entidadeTipo, entidadeId, tipoAlteracao, modo, resumo, aprovadorIds (JSON) e payload (JSON);
 * no servidor, leia com `lerSolicitacaoDoForm(fd)` (src/lib/aprovacao/form.ts).
 */
export function SolicitarAprovacao({
  entidadeTipo,
  entidadeId,
  tipoAlteracao,
  payload,
  usuarios,
  acao,
  resumoInicial = "",
  botao = "Solicitar aprovação",
}: {
  entidadeTipo: TipoEntidadeAprovacao;
  entidadeId: string;
  tipoAlteracao: TipoAlteracaoAprovacao;
  payload?: unknown;
  /** Usuários ativos elegíveis (ex.: listarAprovadoresPossiveis). */
  usuarios: UsuarioAprovador[];
  acao: AcaoServidor;
  resumoInicial?: string;
  botao?: string;
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [escolha, setEscolha] = useState("");
  const [modo, setModo] = useState<"SEQUENCIAL" | "PARALELO">("SEQUENCIAL");
  const [aviso, setAviso] = useState("");
  const id = useId();
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));
  const disponiveis = usuarios.filter((u) => !selecionados.includes(u.id));

  function adicionar() {
    if (!escolha) return;
    setSelecionados((s) => [...s, escolha]);
    setEscolha("");
    setAviso("");
  }
  function mover(i: number, delta: -1 | 1) {
    setSelecionados((s) => {
      const j = i + delta;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  function remover(i: number) {
    setSelecionados((s) => s.filter((_, k) => k !== i));
  }

  return (
    <form
      action={executar}
      className={styles.formulario}
      onSubmit={(e) => {
        if (selecionados.length === 0) {
          e.preventDefault();
          setAviso("Adicione ao menos um aprovador.");
        }
      }}
    >
      <input type="hidden" name="entidadeTipo" value={entidadeTipo} />
      <input type="hidden" name="entidadeId" value={entidadeId} />
      <input type="hidden" name="tipoAlteracao" value={tipoAlteracao} />
      <input type="hidden" name="modo" value={modo} />
      <input type="hidden" name="aprovadorIds" value={JSON.stringify(selecionados)} />
      <input type="hidden" name="payload" value={JSON.stringify(payload ?? {})} />

      <p className={styles.tipo}>
        Tipo de alteração: <strong>{ROTULO_TIPO_ALTERACAO[tipoAlteracao]}</strong>
      </p>

      <div className={styles.campo}>
        <label htmlFor={`${id}-resumo`} className={styles.rotulo}>
          Resumo da alteração
        </label>
        <textarea
          id={`${id}-resumo`}
          name="resumo"
          required
          maxLength={300}
          rows={2}
          defaultValue={resumoInicial}
          className={styles.areaTexto}
        />
      </div>

      <fieldset className={styles.grupo}>
        <legend className={styles.rotulo}>Modo</legend>
        <div className={styles.segmentado}>
          {(["SEQUENCIAL", "PARALELO"] as const).map((m) => (
            <label key={m} className={`${styles.opcao} ${modo === m ? styles.opcaoMarcada : ""}`}>
              <input type="radio" name={`${id}-modo`} value={m} checked={modo === m} onChange={() => setModo(m)} className={styles.radio} />
              {m === "SEQUENCIAL" ? "Sequencial" : "Paralelo"}
            </label>
          ))}
        </div>
        <p className={styles.ajuda}>
          {modo === "SEQUENCIAL" ? "Um aprovador por vez, na ordem da lista." : "Todos recebem ao mesmo tempo; conclui quando todos aprovarem."}
        </p>
      </fieldset>

      <div className={styles.campo}>
        <label htmlFor={`${id}-aprovador`} className={styles.rotulo}>
          Aprovadores
        </label>
        <div className={styles.linhaAdicionar}>
          <select id={`${id}-aprovador`} value={escolha} onChange={(e) => setEscolha(e.target.value)} className={styles.selecao}>
            <option value="">Selecione um usuário…</option>
            {disponiveis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <Botao type="button" variante="secundario" onClick={adicionar} disabled={!escolha}>
            Adicionar
          </Botao>
        </div>
        {selecionados.length > 0 && (
          <ol className={styles.listaAprovadores} aria-label="Aprovadores escolhidos">
            {selecionados.map((uid, i) => {
              const nome = nomes.get(uid) ?? uid;
              return (
                <li key={uid} className={styles.aprovador}>
                  <span className={styles.ordem}>{modo === "SEQUENCIAL" ? `${i + 1}º` : "•"}</span>
                  <span className={styles.nome}>{nome}</span>
                  <button type="button" className={styles.botaoIcone} onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Mover ${nome} para cima`}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.botaoIcone}
                    onClick={() => mover(i, 1)}
                    disabled={i === selecionados.length - 1}
                    aria-label={`Mover ${nome} para baixo`}
                  >
                    ↓
                  </button>
                  <button type="button" className={styles.botaoRemover} onClick={() => remover(i)} aria-label={`Remover ${nome}`}>
                    Remover
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className={styles.rodape}>
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Aguarde..." : botao}
        </Botao>
      </div>
      {aviso && (
        <p role="alert" className={styles.aviso}>
          {aviso}
        </p>
      )}
      <RetornoAcao res={res} />
    </form>
  );
}
