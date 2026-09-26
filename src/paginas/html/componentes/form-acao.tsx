"use client";

import { useActionState, type ReactNode } from "react";
import botoes from "@/paginas/css/componentes/botao.module.css";
import styles from "@/paginas/css/componentes/form-acao.module.css";

export type ResultadoAcao = { erro?: string; ok?: string; aviso?: string; valores?: Record<string, string> } | null;
export type AcaoServidor = (prev: ResultadoAcao, fd: FormData) => Promise<ResultadoAcao>;

type VarianteBotao = "primario" | "secundario" | "perigo" | "texto";

const CLASSE_VARIANTE: Record<VarianteBotao, string> = {
  primario: botoes.primario,
  secundario: botoes.secundario,
  perigo: botoes.perigo,
  texto: botoes.texto,
};

/**
 * Formulário com server action e feedback (erro / sucesso / aviso).
 *
 * Aparência do botão:
 * - `variante` (+ `tamanho`) usa o Botao da Direção A; `classeBotao` entra como classe extra.
 * - Sem `variante`, `classeBotao` é usada sozinha (a página estiliza o botão pelo próprio
 *   .module.css, ex.: `composes` de botao.module.css). Sem nenhum dos dois, vale "primario".
 */
export function FormAcao({
  acao,
  children,
  botao,
  classeBotao,
  className,
  confirmar,
  variante,
  tamanho = "normal",
}: {
  acao: AcaoServidor;
  children?: ReactNode;
  botao: string;
  classeBotao?: string;
  className?: string;
  confirmar?: string;
  variante?: VarianteBotao;
  tamanho?: "normal" | "pequeno";
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  const usarPadrao = variante !== undefined || classeBotao === undefined;
  const classe = usarPadrao
    ? `${botoes.botao} ${CLASSE_VARIANTE[variante ?? "primario"]} ${tamanho === "pequeno" ? styles.botaoPequeno : ""} ${classeBotao ?? ""}`
    : classeBotao;
  return (
    <form
      action={executar}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      <button type="submit" disabled={pendente} className={classe}>
        {pendente ? "Aguarde..." : botao}
      </button>
      {res?.erro && <p role="alert" className={`${styles.retorno} ${styles.erro}`}>{res.erro}</p>}
      {res?.aviso && <p className={`${styles.retorno} ${styles.aviso}`}>{res.aviso}</p>}
      {res?.ok && <p className={`${styles.retorno} ${styles.sucesso}`}>{res.ok}</p>}
    </form>
  );
}

/** Mensagens de retorno de uma action, para formulários que não usam FormAcao (useActionState próprio). */
export function RetornoAcao({ res }: { res: ResultadoAcao }) {
  return (
    <>
      {res?.erro && <p role="alert" className={`${styles.retorno} ${styles.erro}`}>{res.erro}</p>}
      {res?.aviso && <p className={`${styles.retorno} ${styles.aviso}`}>{res.aviso}</p>}
      {res?.ok && <p className={`${styles.retorno} ${styles.sucesso}`}>{res.ok}</p>}
    </>
  );
}
