"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export function LoginForm() {
  const [erro, acao, pendente] = useActionState(entrar, null);
  return (
    <form action={acao} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
      </div>
      <div>
        <label htmlFor="senha" className="block text-sm font-medium text-slate-700">Senha</label>
        <input id="senha" name="senha" type="password" required autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
      </div>
      {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <button type="submit" disabled={pendente}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
        {pendente ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
