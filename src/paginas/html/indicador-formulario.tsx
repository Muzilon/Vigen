import type { DirecaoIndicador, FonteIndicador, PeriodicidadeIndicador } from "@prisma/client";
import { DIRECOES, FONTES, PERIODICIDADES, ROTULO_DIRECAO, ROTULO_FONTE, ROTULO_PERIODICIDADE } from "@/lib/indicadores/periodos";
import styles from "@/paginas/css/indicador-formulario.module.css";

/** Os valores de um indicador que o formulário mostra (nome, meta, periodicidade, responsável etc.). */
export interface ValoresIndicador {
  nome: string;
  descricao: string;
  processoId: string;
  unidade: string;
  direcao: DirecaoIndicador;
  meta: string;
  periodicidade: PeriodicidadeIndicador;
  fonte: FonteIndicador;
  formula: string;
  responsavelId: string;
}

/**
 * Os campos cadastrais do indicador, reaproveitados na criação e na edição (dentro de um <FormAcao>).
 * - `v`: valores iniciais. `processos` e `usuarios`: listas para as caixas de seleção.
 * As opções de fonte, direção e periodicidade vêm prontas de lib/indicadores/periodos.
 */
/** Campos cadastrais do indicador (novo e edição), usados dentro de um FormAcao. */
export function CamposIndicador({
  v,
  processos,
  usuarios,
}: {
  v: Partial<ValoresIndicador>;
  processos: { id: string; codigo: string; nome: string }[];
  usuarios: { id: string; nome: string }[];
}) {
  return (
    <div className={styles.grade}>
      <label className={styles.campoLargo}>Nome do indicador
        <input name="nome" required maxLength={200} defaultValue={v.nome} placeholder="Ex.: Índice de satisfação do cliente" className={styles.entrada} />
      </label>
      <label className={styles.campo}>Fonte do valor
        <select name="fonte" defaultValue={v.fonte ?? "MANUAL"} className={styles.entrada}>
          {FONTES.map((f) => <option key={f} value={f}>{ROTULO_FONTE[f]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Processo
        <select name="processoId" defaultValue={v.processoId ?? ""} className={styles.entrada}>
          <option value="">— Empresa (sem processo) —</option>
          {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Meta
        <input name="meta" required inputMode="decimal" defaultValue={v.meta} placeholder="Ex.: 90" className={styles.entrada} />
      </label>
      <label className={styles.campo}>Unidade
        <input name="unidade" maxLength={20} defaultValue={v.unidade} placeholder="%, dias, un, R$" className={styles.entrada} />
        <span className={styles.dica}>Automáticos usam sempre %.</span>
      </label>
      <label className={styles.campo}>Direção
        <select name="direcao" defaultValue={v.direcao ?? "MAIOR_MELHOR"} className={styles.entrada}>
          {DIRECOES.map((d) => <option key={d} value={d}>{ROTULO_DIRECAO[d]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Periodicidade
        <select name="periodicidade" defaultValue={v.periodicidade ?? "MENSAL"} className={styles.entrada}>
          {PERIODICIDADES.map((p) => <option key={p} value={p}>{ROTULO_PERIODICIDADE[p]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Responsável pelo lançamento
        <select name="responsavelId" defaultValue={v.responsavelId ?? ""} className={styles.entrada}>
          <option value="">— Sem responsável —</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <label className={styles.campoLargo}>Fórmula / fonte dos dados
        <textarea name="formula" rows={2} maxLength={2000} defaultValue={v.formula} placeholder="Ex.: pesquisas com nota ≥ 8 ÷ total de pesquisas × 100 (em branco nos automáticos: preenchido pelo sistema)" className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>Descrição
        <textarea name="descricao" rows={2} maxLength={2000} defaultValue={v.descricao} className={styles.entrada} />
      </label>
    </div>
  );
}
