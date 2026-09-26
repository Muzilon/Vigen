"use client";

import { useActionState, useState } from "react";
import type { AcaoServidor } from "@/components/form-acao";
import { cls } from "@/components/ui";

export type Linha5W2H = { oQue: string; porQue: string; onde: string; quemId: string; quando: string; como: string; quanto: string };
export const linhaVazia = (): Linha5W2H => ({ oQue: "", porQue: "", onde: "", quemId: "", quando: "", como: "", quanto: "" });

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
  const campo = (i: number, k: keyof Linha5W2H, ph: string, extra = "") => (
    <input value={linhas[i][k]} onChange={(e) => set(i, k, e.target.value)} placeholder={ph} aria-label={ph} className={`${cls.input} ${extra}`} />
  );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              {["O quê *", "Por quê", "Onde", "Quem *", "Quando *", "Como", "Quanto (R$)", ""].map((h) => (
                <th key={h} className="px-1 pb-1 text-left text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="p-1">{campo(i, "oQue", "Ação", "min-w-48")}</td>
                <td className="p-1">{campo(i, "porQue", "Justificativa", "min-w-32")}</td>
                <td className="p-1">{campo(i, "onde", "Local", "min-w-24")}</td>
                <td className="p-1">
                  <select value={l.quemId} onChange={(e) => set(i, "quemId", e.target.value)} aria-label="Quem" className={`${cls.input} min-w-40`}>
                    <option value="">Selecione...</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </td>
                <td className="p-1">
                  <input type="date" value={l.quando} onChange={(e) => set(i, "quando", e.target.value)} aria-label="Quando" className={cls.input} />
                </td>
                <td className="p-1">{campo(i, "como", "Método", "min-w-32")}</td>
                <td className="p-1">
                  <input type="number" min={0} step="0.01" value={l.quanto} onChange={(e) => set(i, "quanto", e.target.value)} aria-label="Quanto (R$)" className={`${cls.input} w-36 min-w-36`} />
                </td>
                <td className="p-1">
                  {linhas.length > 1 && (
                    <button type="button" onClick={() => onChange(linhas.filter((_, j) => j !== i))} className="px-2 py-1.5 text-sm text-slate-400 hover:text-red-600" aria-label="Remover linha">
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...linhas, linhaVazia()])} className={cls.btnSec}>+ Linha</button>
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
    <form action={executar} className="space-y-3">
      {Object.entries(ocultos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="itens" value={JSON.stringify(linhas)} />
      <Tabela5W2H linhas={linhas} onChange={setLinhas} usuarios={usuarios} />
      <button type="submit" disabled={pendente} className={cls.btn}>{pendente ? "Salvando..." : `Adicionar ${linhas.length} item(ns)`}</button>
      {res?.erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{res.erro}</p>}
      {res?.ok && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{res.ok}</p>}
    </form>
  );
}
