import type { EsferaRequisito, TemaRequisito, TipoRequisitoLegal } from "@prisma/client";
import { ESFERAS, ROTULO_ESFERA, ROTULO_STATUS_REQUISITO, ROTULO_TEMA, ROTULO_TIPO_REQUISITO, STATUS_REQUISITO, TEMAS, TIPOS_REQUISITO } from "@/lib/requisitos-legais/regras";
import styles from "@/paginas/css/requisito-legal-formulario.module.css";

// Uma opção de lista: o id (valor guardado) e o nome (o que aparece).
type Opcao = { id: string; nome: string };

/** Os valores de um requisito legal que o formulário mostra (todos opcionais: vazios na criação, preenchidos na edição). */
export interface ValoresRequisito {
  tipo: TipoRequisitoLegal;
  numero: string;
  titulo: string;
  esfera: EsferaRequisito;
  tema: TemaRequisito;
  orgaoEmissor: string;
  resumo: string;
  aplicabilidade: string;
  dataPublicacao: string;
  processoId: string;
  obraId: string;
  responsavelId: string;
  periodicidadeMeses: string;
}

/**
 * Os campos cadastrais do requisito legal (tipo, número, título, esfera, tema, órgão, resumo, aplicabilidade, vínculos,
 * responsável e periodicidade), reaproveitados na criação e na edição dentro de um <FormAcao>.
 */
/** Campos cadastrais do requisito legal (novo e edição), usados dentro de um FormAcao. */
export function CamposRequisito({
  v,
  obras,
  processos,
  usuarios,
}: {
  v: Partial<ValoresRequisito>;
  obras: Opcao[];
  processos: { id: string; codigo: string; nome: string }[];
  usuarios: Opcao[];
}) {
  return (
    <div className={styles.grade}>
      <label className={styles.campo}>Tipo
        <select name="tipo" defaultValue={v.tipo ?? "LEI"} className={styles.entrada}>
          {TIPOS_REQUISITO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_REQUISITO[t]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Número / identificação
        <input name="numero" required maxLength={120} defaultValue={v.numero} placeholder="Ex.: NR-35, Lei 12.305/2010" className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>Título / ementa
        <input name="titulo" required maxLength={300} defaultValue={v.titulo} className={styles.entrada} />
      </label>
      <label className={styles.campo}>Esfera
        <select name="esfera" defaultValue={v.esfera ?? "FEDERAL"} className={styles.entrada}>
          {ESFERAS.map((e) => <option key={e} value={e}>{ROTULO_ESFERA[e]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Tema
        <select name="tema" defaultValue={v.tema ?? "SSO"} className={styles.entrada}>
          {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Órgão emissor
        <input name="orgaoEmissor" maxLength={200} defaultValue={v.orgaoEmissor} placeholder="Ex.: Ministério do Trabalho" className={styles.entrada} />
      </label>
      <label className={styles.campo}>Data de publicação
        <input type="date" name="dataPublicacao" defaultValue={v.dataPublicacao} className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>Resumo (o que exige)
        <textarea name="resumo" rows={3} maxLength={4000} defaultValue={v.resumo} className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>Aplicabilidade (onde/como se aplica à empresa)
        <textarea name="aplicabilidade" rows={2} maxLength={4000} defaultValue={v.aplicabilidade} className={styles.entrada} />
      </label>
      <label className={styles.campo}>Processo (opcional)
        <select name="processoId" defaultValue={v.processoId ?? ""} className={styles.entrada}>
          <option value="">—</option>
          {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Unidade (opcional; vazio = empresa toda)
        <select name="obraId" defaultValue={v.obraId ?? ""} className={styles.entrada}>
          <option value="">— empresa toda —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Responsável pelo atendimento
        <select name="responsavelId" defaultValue={v.responsavelId ?? ""} className={styles.entrada}>
          <option value="">—</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Verificar a cada (meses)
        <input type="number" name="periodicidadeMeses" min={1} max={60} defaultValue={v.periodicidadeMeses ?? "12"} className={styles.entrada} />
      </label>
    </div>
  );
}

/**
 * Os campos de uma verificação: status de atendimento, observação/evidência e, se o requisito ainda não tem plano,
 * a primeira ação (obrigatória quando o status é "Não atende" ou "Atende parcialmente").
 * - `comData`: mostra o campo de data da verificação. `temPlano`: se já existe plano, a seção da primeira ação some.
 */
/** Status + observação + primeira ação (exigida para "Não atende"/"Atende parcialmente" sem plano). */
export function CamposVerificacao({
  usuarios,
  statusInicial,
  comData,
  hoje,
  temPlano,
}: {
  usuarios: Opcao[];
  statusInicial?: string;
  comData?: boolean;
  hoje: string;
  temPlano?: boolean;
}) {
  return (
    <div className={styles.grade}>
      <label className={styles.campo}>Status de atendimento
        <select name="status" defaultValue={statusInicial ?? "EM_ANALISE"} className={styles.entrada}>
          {STATUS_REQUISITO.map((s) => <option key={s} value={s}>{ROTULO_STATUS_REQUISITO[s]}</option>)}
        </select>
      </label>
      {comData && (
        <label className={styles.campo}>Data da verificação
          <input type="date" name="data" defaultValue={hoje} max={hoje} className={styles.entrada} />
        </label>
      )}
      <label className={styles.campoLargo}>Observação / evidência
        <input name="observacao" maxLength={2000} placeholder="Ex.: PCMSO revisado e assinado pelo médico coordenador" className={styles.entrada} />
      </label>
      {!temPlano && (
        <fieldset className={styles.acao}>
          <legend>Primeira ação do plano — obrigatória se &quot;Não atende&quot; ou &quot;Atende parcialmente&quot;</legend>
          <label className={styles.campoLargo}>O quê
            <input name="acaoOQue" maxLength={500} className={styles.entrada} />
          </label>
          <label className={styles.campo}>Quem
            <select name="acaoQuemId" defaultValue="" className={styles.entrada}>
              <option value="">—</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <label className={styles.campo}>Quando
            <input type="date" name="acaoQuando" min={hoje} className={styles.entrada} />
          </label>
        </fieldset>
      )}
    </div>
  );
}
