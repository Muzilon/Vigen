"use client";

import { useActionState, useState } from "react";
import { cls } from "@/components/ui";
import { ROTULO_METODO, SEIS_M } from "@/lib/rnc/rotulos";
import { salvarCausaAcao } from "../actions";

type Metodo = keyof typeof ROTULO_METODO;
type Analise = { porques?: string[]; ishikawa?: Record<string, string>; texto?: string };

export function CausaForm(props: {
  rncId: string;
  versao: number;
  metodo: Metodo | null;
  analise: Analise | null;
  causaRaiz: string | null;
}) {
  const [res, acao, pendente] = useActionState(salvarCausaAcao, null);
  const [metodo, setMetodo] = useState<Metodo>(props.metodo ?? "CINCO_PORQUES");
  const [porques, setPorques] = useState<string[]>(props.analise?.porques ?? ["", "", "", "", ""]);
  const [ishikawa, setIshikawa] = useState<Record<string, string>>(props.analise?.ishikawa ?? {});
  const [texto, setTexto] = useState(props.analise?.texto ?? "");

  const analise =
    metodo === "CINCO_PORQUES" ? { porques } : metodo === "ISHIKAWA" ? { ishikawa } : { texto };

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="id" value={props.rncId} />
      <input type="hidden" name="versao" value={props.versao} />
      <input type="hidden" name="metodo" value={metodo} />
      <input type="hidden" name="analise" value={JSON.stringify(analise)} />

      <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-0.5">
        {(Object.keys(ROTULO_METODO) as Metodo[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetodo(m)}
            className={`rounded px-3 py-1 text-sm ${metodo === m ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            {ROTULO_METODO[m]}
          </button>
        ))}
      </div>

      {metodo === "CINCO_PORQUES" && (
        <div className="space-y-2">
          {porques.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{i + 1}º Por quê?</span>
              <input
                value={p}
                onChange={(e) => setPorques(porques.map((x, j) => (j === i ? e.target.value : x)))}
                className={cls.input}
              />
            </div>
          ))}
        </div>
      )}

      {metodo === "ISHIKAWA" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SEIS_M.map(([k, r]) => (
            <div key={k}>
              <label className={cls.label}>{r}</label>
              <textarea
                rows={2}
                value={ishikawa[k] ?? ""}
                onChange={(e) => setIshikawa({ ...ishikawa, [k]: e.target.value })}
                className={cls.input}
              />
            </div>
          ))}
        </div>
      )}

      {metodo === "OUTRO" && (
        <div>
          <label className={cls.label}>Análise</label>
          <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} className={cls.input} />
        </div>
      )}

      <div>
        <label className={cls.label} htmlFor="causaRaiz">Causa raiz (conclusão) *</label>
        <textarea id="causaRaiz" name="causaRaiz" rows={2} required defaultValue={props.causaRaiz ?? ""} className={cls.input} />
      </div>

      {res?.erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{res.erro}</p>}
      {res?.ok && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{res.ok}</p>}
      <button type="submit" disabled={pendente} className={cls.btn}>{pendente ? "Salvando..." : "Salvar causa raiz"}</button>
    </form>
  );
}
