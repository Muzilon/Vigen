"use client";

import { useActionState, useState } from "react";
import { linhaVazia, Tabela5W2H, type Linha5W2H } from "@/components/tabela-5w2h";
import { cls } from "@/components/ui";
import { criarPlanoManualAcao } from "../actions";

type UsuarioObras = { id: string; nome: string; obras: string[] | null };

/** Todos os campos são controlados: um erro do servidor não apaga o que foi digitado. */
export function FormNovoPlano({ obras, usuarios }: { obras: { id: string; nome: string }[]; usuarios: UsuarioObras[] }) {
  const [res, acao, pendente] = useActionState(criarPlanoManualAcao, null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [obraId, setObraId] = useState("");
  const [linhas, setLinhas] = useState<Linha5W2H[]>([linhaVazia()]);

  const acessa = (u: UsuarioObras, obra: string) => !obra || u.obras === null || u.obras.includes(obra);
  const usuariosObra = usuarios.filter((u) => acessa(u, obraId));

  function trocarObra(nova: string) {
    setObraId(nova);
    // "Quem" sem acesso à nova obra é desmarcado.
    const permitidos = new Set(usuarios.filter((u) => acessa(u, nova)).map((u) => u.id));
    setLinhas(linhas.map((l) => (l.quemId && !permitidos.has(l.quemId) ? { ...l, quemId: "" } : l)));
  }

  return (
    <form action={acao} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <label className={cls.label} htmlFor="titulo">Título *</label>
        <input id="titulo" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={3} maxLength={200} className={cls.input} />
      </div>
      <div>
        <label className={cls.label} htmlFor="descricao">Objetivo</label>
        <textarea id="descricao" name="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={5000} className={cls.input} />
      </div>
      <div className="max-w-sm">
        <label className={cls.label} htmlFor="obraId">Obra / unidade</label>
        <select id="obraId" name="obraId" value={obraId} onChange={(e) => trocarObra(e.target.value)} className={cls.input}>
          <option value="">Nenhuma (toda a empresa)</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">Com obra, só usuários com acesso a ela podem ser o &quot;quem&quot; dos itens.</p>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Itens (5W2H) *</h2>
        <input type="hidden" name="itens" value={JSON.stringify(linhas)} />
        <Tabela5W2H linhas={linhas} onChange={setLinhas} usuarios={usuariosObra} />
      </div>
      {res?.erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{res.erro}</p>}
      <button type="submit" disabled={pendente} className={cls.btn}>{pendente ? "Salvando..." : "Criar plano de ação"}</button>
    </form>
  );
}
