import type { TipoTreinamento } from "@prisma/client";
import { ROTULO_TIPO_TREINAMENTO, TIPOS_TREINAMENTO } from "@/lib/treinamentos/regras";
import styles from "@/paginas/css/treinamento-formulario.module.css";

/** Os valores de um treinamento que o formulário mostra (todos opcionais: vazios na criação, preenchidos na edição). */
export interface ValoresTreinamento {
  nome: string;
  tipo: TipoTreinamento;
  descricao: string;
  cargaHoraria: string;
  validadeMeses: string;
  obrigatorioTodos: boolean;
  obrigatorioSetorIds: string[];
  obrigatorioFuncaoIds: string[];
  documentoId: string;
  critico: boolean;
  diasAvaliacaoEficacia: string;
}

// Uma opção de lista: o id (valor guardado) e o nome (o que aparece).
/** Campos cadastrais do treinamento (novo e edição), usados dentro de um FormAcao. */
type Opcao = { id: string; nome: string };

/**
 * Os campos cadastrais do treinamento, reaproveitados na criação e na edição (dentro de um <FormAcao>):
 * nome, tipo, carga horária, validade, para quem é obrigatório (todos/setores/funções), documento de
 * conscientização, se é crítico para aptidão e prazo da avaliação de eficácia.
 * - `v`: valores iniciais. `setores`, `funcoes` e `documentos`: listas para as escolhas.
 */
export function CamposTreinamento({
  v,
  setores,
  funcoes,
  documentos,
}: {
  v: Partial<ValoresTreinamento>;
  setores: Opcao[];
  funcoes: Opcao[];
  documentos: { id: string; codigo: string; titulo: string }[];
}) {
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
        {funcoes.length > 0 && (
          <div className={styles.setores}>
            {funcoes.map((f) => (
              <label key={f.id} className={styles.opcao}>
                <input type="checkbox" name="obrigatorioFuncaoIds" value={f.id} defaultChecked={v.obrigatorioFuncaoIds?.includes(f.id)} /> Função {f.nome}
              </label>
            ))}
          </div>
        )}
        <span className={styles.dica}>Setores e funções somam (basta um). Sem nenhuma marcação o treinamento é opcional (aparece na matriz só para quem o fez).</span>
      </fieldset>
      {documentos.length > 0 && (
        <label className={styles.campoLargo}>Documento para conscientização (ISO 9001 7.3)
          <select name="documentoId" defaultValue={v.documentoId ?? ""} className={styles.entrada}>
            <option value="">— Nenhum —</option>
            {documentos.map((d) => <option key={d.id} value={d.id}>{d.codigo} — {d.titulo}</option>)}
          </select>
          <span className={styles.dica}>A ciência da revisão vigente conta como realização; nova revisão publicada gera &quot;Reciclagem pendente&quot;.</span>
        </label>
      )}
      <label className={styles.campoLargo}>
        <span className={styles.opcao}>
          <input type="checkbox" name="critico" value="1" defaultChecked={v.critico} /> Crítico para aptidão
        </span>
        <span className={styles.dica}>Pendência (vencido, não realizado ou reciclagem pendente) deixa a pessoa obrigada como &quot;Inapta&quot;.</span>
      </label>
      <label className={styles.campo}>Avaliar eficácia após (dias)
        <input name="diasAvaliacaoEficacia" type="number" min={1} max={365} defaultValue={v.diasAvaliacaoEficacia} placeholder="Em branco = não exige" className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>Descrição / conteúdo programático
        <textarea name="descricao" rows={3} maxLength={4000} defaultValue={v.descricao} className={styles.entrada} />
      </label>
    </div>
  );
}
