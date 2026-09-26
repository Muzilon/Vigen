"use client";

import { useActionState, useState } from "react";
import { cls } from "@/components/ui";
import { adicionarItensAcao } from "../actions";

type Linha = { oQue: string; porQue: string; onde: string; quemId: string; quando: string; como: string; quanto: string };
const vazia = (): Linha => ({ oQue: "", porQue: "", onde: "", quemId: "", quando: "", como: "", quanto: "" });

/** Adição de vários itens 5W2H de uma vez. */
export function ItensForm({ rncId, usuarios }: { rncId: string; usuarios: { id: string; nome: string }[] }) {
  const [linhas, setLinhas] = useState<Linha[]>([vazia()]);
  const [res, acao, pendente] = useActionState(async (prev: Parameters<typeof adicionarItensAcao>[0], fd: FormData) => {
    const r = await adicionarItensAcao(prev, fd);
    if (r?.ok) setLinhas([vazia()]);
    return r;
  }, null);
  const set = (i: number, k: keyof Linha, v: string) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const campo = (i: number, k: keyof Linha, ph: string, extra = "") => (
    <input value={linhas[i][k]} onChange={(e) => set(i, k, e.target.value)} placeholder={ph} className={`${cls.input} ${extra}`} />
  );

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="rncId" value={rncId} />
      <input type="hidden" name="itens" value={JSON.stringify(linhas)} />
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
                  <select value={l.quemId} onChange={(e) => set(i, "quemId", e.target.value)} className={`${cls.input} min-w-40`}>
                    <option value="">Selecione...</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </td>
                <td className="p-1">
                  <input type="date" value={l.quando} onChange={(e) => set(i, "quando", e.target.value)} className={cls.input} />
                </td>
                <td className="p-1">{campo(i, "como", "Método", "min-w-32")}</td>
                <td className="p-1">
                  <input type="number" min={0} step="0.01" value={l.quanto} onChange={(e) => set(i, "quanto", e.target.value)} className={`${cls.input} w-28`} />
                </td>
                <td className="p-1">
                  {linhas.length > 1 && (
                    <button type="button" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} className="px-2 py-1.5 text-sm text-slate-400 hover:text-red-600" aria-label="Remover linha">
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setLinhas([...linhas, vazia()])} className={cls.btnSec}>+ Linha</button>
        <button type="submit" disabled={pendente} className={cls.btn}>{pendente ? "Salvando..." : `Adicionar ${linhas.length} item(ns)`}</button>
      </div>
      {res?.erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{res.erro}</p>}
      {res?.ok && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{res.ok}</p>}
    </form>
  );
}
