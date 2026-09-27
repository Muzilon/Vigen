import type { TipoTreinamento } from "@prisma/client";
import { ROTULO_TIPO_TREINAMENTO, TIPOS_TREINAMENTO } from "@/lib/treinamentos/regras";
import styles from "@/paginas/css/treinamento-formulario.module.css";

export interface ValoresTreinamento {
  nome: string;
  tipo: TipoTreinamento;
  descricao: string;
  cargaHoraria: string;
  validadeMeses: string;
  obrigatorioTodos: boolean;
  obrigatorioSetorIds: string[];
}

/** Campos cadastrais do treinamento (novo e edição), usados dentro de um FormAcao. */
export function CamposTreinamento({ v, setores }: { v: Partial<ValoresTreinamento>; setores: { id: string; nome: string }[] }) {
  return (
    <div className={styles.grade}>
      <label className={styles.campoLargo}>Nome do treinamento
        <input name="nome" required maxLength={200} defaultValue={v.nome} placeholder="Ex.: NR-35 — Trabalho em altura" className={styles.entrada} />
      </label>
      <label className={styles.campo}>Tipo
        <select name="tipo" defaultValue={v.tipo ?? "NR"} className={styles.entrada}>
          {TIPOS_TREINAMENTO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_TREINAMENTO[t]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>Carga horária (h)
        <input name="cargaHoraria" type="number" min={1} max={1000} defaultValue={v.cargaHoraria} className={styles.entrada} />
      </label>
      <label className={styles.campo}>Validade (meses)
        <input name="validadeMeses" type="number" min={1} max={120} defaultValue={v.validadeMeses} placeholder="Em branco = não vence" className={styles.entrada} />
      </label>
      <fieldset className={styles.campoLargo}>
        <legend className={styles.legenda}>Obrigatório para</legend>
        <label className={styles.opcao}>
          <input type="checkbox" name="obrigatorioTodos" value="1" defaultChecked={v.obrigatorioTodos} /> Todos os usuários ativos
        </label>
        <div className={styles.setores}>
          {setores.map((s) => (
            <label key={s.id} className={styles.opcao}>
              <input type="checkbox" name="obrigatorioSetorIds" value={s.id} defaultChecked={v.obrigatorioSetorIds?.includes(s.id)} /> Setor {s.nome}
            </label>
          ))}
        </div>
        <span className={styles.dica}>Sem nenhuma marcação o treinamento é opcional (aparece na matriz só para quem o fez).</span>
      </fieldset>
      <label className={styles.campoLargo}>Descrição / conteúdo programático
        <textarea name="descricao" rows={3} maxLength={4000} defaultValue={v.descricao} className={styles.entrada} />
      </label>
    </div>
  );
}
