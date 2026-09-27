"use client";

import { useActionState, useState } from "react";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/documento-novo-formulario.module.css";

type Opcao = { id: string; nome: string };

export const ACEITAR_DOCUMENTO = ".pdf,.docx,.xlsx,.txt,.jpg,.jpeg,.png,.webp";

/**
 * Formulário "Novo documento": tipo (sigla → código automático), título, vínculos, responsável,
 * periodicidade (padrão do tipo) e o arquivo da Rev. 00. Em erro, os valores digitados voltam
 * (o arquivo precisa ser escolhido de novo — o navegador não permite repovoar input de arquivo).
 */
export function DocumentoNovoFormulario({
  acao,
  tipos,
  processos,
  obras,
  setores,
  usuarios,
  inicial,
}: {
  acao: AcaoServidor;
  tipos: { id: string; nome: string; sigla: string; periodicidadeRevisaoMeses: number }[];
  processos: { id: string; codigo: string; nome: string }[];
  obras: Opcao[];
  setores: Opcao[];
  usuarios: Opcao[];
  inicial: { processoId: string; responsavelId: string };
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  const v = res?.valores ?? {};
  const [tipoId, setTipoId] = useState(v.tipoId ?? tipos[0]?.id ?? "");
  const tipo = tipos.find((t) => t.id === tipoId);

  return (
    <form action={executar} className={styles.formulario} key={JSON.stringify(v)}>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Tipo *</span>
        <select name="tipoId" required value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={styles.entrada}>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.sigla} — {t.nome}</option>)}
        </select>
        <span className={styles.ajuda}>O código é gerado automaticamente: {tipo ? `${tipo.sigla}-NNN` : "—"}.</span>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Responsável *</span>
        <select name="responsavelId" required defaultValue={v.responsavelId ?? inicial.responsavelId} className={styles.entrada}>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <label className={styles.campoLargo}>
        <span className={styles.rotulo}>Título *</span>
        <input name="titulo" required minLength={3} maxLength={200} defaultValue={v.titulo ?? ""} className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>
        <span className={styles.rotulo}>Descrição / objetivo</span>
        <textarea name="descricao" rows={2} maxLength={2000} defaultValue={v.descricao ?? ""} className={styles.entrada} />
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Processo</span>
        <select name="processoId" defaultValue={v.processoId ?? inicial.processoId} className={styles.entrada}>
          <option value="">—</option>
          {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Periodicidade de revisão (meses)</span>
        <input
          name="periodicidadeRevisaoMeses"
          type="number"
          min={1}
          max={120}
          placeholder={tipo ? `Padrão do tipo: ${tipo.periodicidadeRevisaoMeses}` : ""}
          defaultValue={v.periodicidadeRevisaoMeses ?? ""}
          className={styles.entrada}
        />
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Unidade</span>
        <select name="obraId" defaultValue={v.obraId ?? ""} className={styles.entrada}>
          <option value="">— toda a empresa —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Setor</span>
        <select name="setorId" defaultValue={v.setorId ?? ""} className={styles.entrada}>
          <option value="">—</option>
          {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </label>

      <fieldset className={styles.bloco}>
        <legend className={styles.legenda}>Revisão 00</legend>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Arquivo do documento *</span>
          <input name="arquivo" type="file" required accept={ACEITAR_DOCUMENTO} className={styles.arquivo} />
          <span className={styles.ajuda}>PDF, DOCX, XLSX, TXT ou imagem — até 10 MB. O conteúdo é conferido no servidor.</span>
        </label>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Motivo / descrição da emissão</span>
          <input name="motivo" maxLength={1000} placeholder="Emissão inicial." defaultValue={v.motivo ?? ""} className={styles.entrada} />
        </label>
      </fieldset>

      <div className={styles.rodape}>
        <p className={styles.ajuda}>O documento nasce em elaboração. Depois, envie para revisão/aprovação no detalhe.</p>
        <Botao type="submit" disabled={pendente}>{pendente ? "Enviando..." : "Criar documento"}</Botao>
      </div>
      <div className={styles.campoLargo}><RetornoAcao res={res} /></div>
    </form>
  );
}
