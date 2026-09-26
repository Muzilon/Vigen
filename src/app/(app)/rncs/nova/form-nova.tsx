"use client";

import { useActionState, useState } from "react";
import { CampoArquivos } from "@/components/campo-arquivos";
import { cls } from "@/components/ui";
import { ROTULO_GRAVIDADE, ROTULO_ORIGEM, ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { criarRncAcao } from "../actions";

type Opcao = { id: string; nome: string };

export function FormNovaRnc({
  obras,
  setores,
  usuarios,
  podeSensiveis,
}: {
  obras: Opcao[];
  setores: Opcao[];
  usuarios: Opcao[];
  podeSensiveis: boolean;
}) {
  const [res, acao, pendente] = useActionState(criarRncAcao, null);
  const [tipo, setTipo] = useState("QUALIDADE");
  const [pessoais, setPessoais] = useState(false);

  return (
    <form action={acao} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <label className={cls.label} htmlFor="titulo">Título *</label>
        <input id="titulo" name="titulo" required maxLength={200} className={cls.input} />
      </div>
      <div>
        <label className={cls.label} htmlFor="descricao">Descrição *</label>
        <textarea id="descricao" name="descricao" required rows={4} className={cls.input} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={cls.label} htmlFor="tipo">Tipo *</label>
          <select id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={cls.input}>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={cls.label} htmlFor="origem">Origem *</label>
          <select id="origem" name="origem" className={cls.input}>
            {Object.entries(ROTULO_ORIGEM).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={cls.label} htmlFor="gravidade">Gravidade *</label>
          <select id="gravidade" name="gravidade" defaultValue="MEDIA" className={cls.input}>
            {Object.entries(ROTULO_GRAVIDADE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={cls.label} htmlFor="obraId">Obra / unidade *</label>
          <select id="obraId" name="obraId" required className={cls.input} defaultValue={obras.length === 1 ? obras[0].id : ""}>
            <option value="">Selecione...</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={cls.label} htmlFor="setorId">Setor</label>
          <select id="setorId" name="setorId" className={cls.input}>
            <option value="">—</option>
            {setores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={cls.label} htmlFor="processoArea">Processo / área</label>
          <input id="processoArea" name="processoArea" className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor="responsavelId">Responsável sugerido</label>
          <select id="responsavelId" name="responsavelId" className={cls.input}>
            <option value="">—</option>
            {usuarios.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="contemDadosPessoais" checked={pessoais} onChange={(e) => setPessoais(e.target.checked)} />
          Contém dados pessoais (LGPD)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="restrita" />
          Marcar como restrita
        </label>
        {tipo === "SSO" && pessoais && (
          <p className="text-xs text-amber-700">RNCs de SSO com dados pessoais são restritas automaticamente.</p>
        )}
      </div>

      {pessoais && (
        <fieldset className="grid grid-cols-1 gap-4 rounded-md border border-amber-200 bg-amber-50/40 p-4 sm:grid-cols-3">
          <legend className="px-1 text-xs font-semibold text-amber-800">Dados sensíveis — acesso restrito</legend>
          <div>
            <label className={cls.label} htmlFor="nomeEnvolvido">Nome do envolvido</label>
            <input id="nomeEnvolvido" name="nomeEnvolvido" className={cls.input} />
          </div>
          <div>
            <label className={cls.label} htmlFor="documentoEnvolvido">Documento</label>
            <input id="documentoEnvolvido" name="documentoEnvolvido" className={cls.input} />
          </div>
          <div>
            <label className={cls.label} htmlFor="funcaoEnvolvido">Função</label>
            <input id="funcaoEnvolvido" name="funcaoEnvolvido" className={cls.input} />
          </div>
          <div className="sm:col-span-3">
            <label className={cls.label} htmlFor="relato">Relato</label>
            <textarea id="relato" name="relato" rows={3} className={cls.input} />
          </div>
          <div className="sm:col-span-3">
            <label className={cls.label} htmlFor="lesaoDescricao">Descrição da lesão</label>
            <textarea id="lesaoDescricao" name="lesaoDescricao" rows={2} className={cls.input} />
          </div>
          {podeSensiveis && (
            <div className="sm:col-span-3">
              <CampoArquivos
                nome="arquivosSensiveis"
                rotulo="Anexos com dados pessoais (acesso restrito)"
                ajuda="Visíveis apenas para quem tem acesso a dados sensíveis."
              />
            </div>
          )}
        </fieldset>
      )}

      <div className="rounded-md border border-dashed border-slate-300 px-4 py-3">
        <CampoArquivos rotulo="Anexos (fotos e documentos)" />
      </div>

      {res?.erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{res.erro}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pendente} className={cls.btn}>{pendente ? "Salvando..." : "Abrir RNC"}</button>
      </div>
    </form>
  );
}
