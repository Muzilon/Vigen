"use client";

import { useActionState, useState } from "react";
import { cls } from "@/components/ui";
import { editarPlanoManualAcao } from "../../actions";

/** Edição do cabeçalho do plano avulso; campos controlados (não se perdem em erro). */
export function EditarPlanoForm({ planoId, versao, titulo: t0, descricao: d0 }: { planoId: string; versao: number; titulo: string; descricao: string }) {
  const [res, acao, pendente] = useActionState(editarPlanoManualAcao, null);
  const [titulo, setTitulo] = useState(t0);
  const [descricao, setDescricao] = useState(d0);
  return (
    <form action={acao} className="mt-2 max-w-2xl space-y-2 rounded-md border border-slate-200 bg-white p-3">
      <input type="hidden" name="planoId" value={planoId} />
      <input type="hidden" name="versao" value={versao} />
      <label className={cls.label} htmlFor="titulo-plano">Título</label>
      <input id="titulo-plano" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} maxLength={200} className={cls.input} />
      <label className={cls.label} htmlFor="descricao-plano">Objetivo</label>
      <textarea id="descricao-plano" name="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={5000} className={cls.input} />
      <button type="submit" disabled={pendente} className={`${cls.btn} text-xs`}>{pendente ? "Aguarde..." : "Salvar"}</button>
      {res?.erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{res.erro}</p>}
      {res?.ok && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{res.ok}</p>}
    </form>
  );
}
