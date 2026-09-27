import type { TipoAuditoria } from "@prisma/client";
import styles from "@/paginas/css/auditoria-formulario.module.css";

type Opcao = { id: string; nome: string };

export interface ValoresAuditoria {
  programaId: string;
  tipo: TipoAuditoria;
  norma: string;
  escopo: string;
  processoId: string;
  obraId: string;
  auditorLiderId: string;
  equipe: string;
  dataInicio: string;
  dataFim: string;
}

/** Campos da auditoria (nova e edição), usados dentro de um FormAcao. */
export function CamposAuditoria({
  v,
  programas,
  obras,
  processos,
  usuarios,
}: {
  v: Partial<ValoresAuditoria>;
  programas: { id: string; ano: number }[];
  obras: Opcao[];
  processos: { id: string; codigo: string; nome: string }[];
  usuarios: Opcao[];
}) {
  return (
    <div className={styles.grade}>
      <label className={styles.campo}>Tipo
        <select name="tipo" defaultValue={v.tipo ?? "INTERNA"} className={styles.entrada}>
          <option value="INTERNA">Interna</option>
          <option value="EXTERNA_CERTIFICACAO">Externa (certificação)</option>
        </select>
      </label>
      <label className={styles.campo}>Norma<input name="norma" required defaultValue={v.norma ?? "ISO 9001:2015"} maxLength={200} className={styles.entrada} /></label>
      <label className={styles.campoLargo}>Escopo<textarea name="escopo" required rows={2} defaultValue={v.escopo} maxLength={4000} className={styles.entrada} /></label>
      <label className={styles.campo}>Início<input type="date" name="dataInicio" required defaultValue={v.dataInicio} className={styles.entrada} /></label>
      <label className={styles.campo}>Término<input type="date" name="dataFim" required defaultValue={v.dataFim} className={styles.entrada} /></label>
      <label className={styles.campo}>Auditor líder
        <select name="auditorLiderId" required defaultValue={v.auditorLiderId ?? ""} className={styles.entrada}>
          <option value="">Selecione…</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Equipe (opcional)<input name="equipe" defaultValue={v.equipe} maxLength={1000} className={styles.entrada} /></label>
      <label className={styles.campo}>Programa
        <select name="programaId" defaultValue={v.programaId ?? ""} className={styles.entrada}>
          <option value="">— avulsa —</option>
          {programas.map((p) => <option key={p.id} value={p.id}>Programa {p.ano}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Processo (opcional)
        <select name="processoId" defaultValue={v.processoId ?? ""} className={styles.entrada}>
          <option value="">—</option>
          {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Unidade (opcional; vazio = empresa toda)
        <select name="obraId" defaultValue={v.obraId ?? ""} className={styles.entrada}>
          <option value="">—</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>
    </div>
  );
}
