"use client";

import { useActionState, type ReactNode } from "react";

export type ResultadoAcao = { erro?: string; ok?: string; aviso?: string } | null;
export type AcaoServidor = (prev: ResultadoAcao, fd: FormData) => Promise<ResultadoAcao>;

/** Formulário com server action e feedback (erro / sucesso / aviso). */
export function FormAcao({
  acao,
  children,
  botao,
  classeBotao,
  className,
  confirmar,
}: {
  acao: AcaoServidor;
  children?: ReactNode;
  botao: string;
  classeBotao?: string;
  className?: string;
  confirmar?: string;
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  return (
    <form
      action={executar}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      <button type="submit" disabled={pendente} className={classeBotao}>
        {pendente ? "Aguarde..." : botao}
      </button>
      {res?.erro && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{res.erro}</p>}
      {res?.aviso && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{res.aviso}</p>}
      {res?.ok && <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{res.ok}</p>}
    </form>
  );
}
