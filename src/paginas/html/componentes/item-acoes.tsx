import { cancelarItemAcao, concluirItemAcao, editarItemAcao, iniciarItemAcao } from "@/app/(app)/rncs/actions";
import { CampoArquivos } from "@/paginas/html/componentes/campo-arquivos";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { dataIso } from "@/lib/datas";
import botoes from "@/paginas/css/componentes/botao.module.css";
import styles from "@/paginas/css/componentes/item-acoes.module.css";

/** Os dados de um item do plano 5W2H que este componente precisa (o quê, por quê, onde, quem, quando, como, quanto). */
interface ItemParaAcoes {
  id: string;
  status: string;
  oQue: string;
  porQue: string | null;
  onde: string | null;
  quemId: string;
  quando: Date;
  como: string | null;
  quanto: { toString(): string } | null;
}

/**
 * true quando o ItemAcoes renderiza algum botão (item em aberto e o usuário executa, conclui ou gerencia).
 * `podeConcluir` vale `podeExecutar` quando não informado.
 */
export function itemTemAcoes(status: string, podeExecutar: boolean, podeGerenciar: boolean, podeConcluir = podeExecutar) {
  return (status === "PENDENTE" || status === "EM_ANDAMENTO") && (podeExecutar || podeConcluir || podeGerenciar);
}

/**
 * Botões de ação de um item do plano 5W2H:
 * - responsável pelo item: "Iniciar";
 * - responsável, qualidade e administração: "Concluir" (pede data; evidência por anexo, descrição ou link é
 *   opcional, mas sem nenhuma o item fica "Sem evidência" e a qualidade é avisada);
 * - quem gerencia (responsável da RNC ou permissão PLANO_GERENCIAR): "Editar" e "Cancelar".
 * `podeExecutar`/`podeConcluir`/`podeGerenciar` dizem o que o usuário atual pode fazer; `hoje` é a data padrão da conclusão.
 */
export function ItemAcoes({
  item,
  rncId,
  podeExecutar,
  podeConcluir = podeExecutar,
  podeGerenciar,
  usuarios,
  hoje,
}: {
  item: ItemParaAcoes;
  rncId?: string;
  podeExecutar: boolean;
  podeConcluir?: boolean;
  podeGerenciar: boolean;
  usuarios: { id: string; nome: string }[];
  hoje: string;
}) {
  // Sem nenhuma ação possível (item já concluído/cancelado ou usuário sem permissão): mostra só "—".
  if (!itemTemAcoes(item.status, podeExecutar, podeGerenciar, podeConcluir)) return <span className={styles.semAcao}>—</span>;
  // Campos escondidos que todos os formulários abaixo enviam: qual item (e qual RNC) é o alvo da ação.
  const ocultos = (
    <>
      <input type="hidden" name="itemId" value={item.id} />
      {rncId && <input type="hidden" name="rncId" value={rncId} />}
    </>
  );
  // Monta um campo de formulário: um rótulo (<label>) ligado ao controle (input/select/textarea) pelo `id`.
  const campo = (id: string, rotulo: string, controle: React.ReactNode) => (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.rotulo}>{rotulo}</label>
      {controle}
    </div>
  );
  // Prefixo para gerar ids únicos por item (vários itens na mesma página não podem repetir id).
  const pfx = `it-${item.id}`;
  return (
    <div className={styles.acoes}>
      {podeExecutar && item.status === "PENDENTE" && (
        <FormAcao acao={iniciarItemAcao} botao="Iniciar" variante="secundario" tamanho="pequeno">
          {ocultos}
        </FormAcao>
      )}
      {podeConcluir && (
        <details className={styles.painelDetalhes}>
          <summary className={`${botoes.botao} ${botoes.primario} ${styles.resumo}`}>Concluir</summary>
          <FormAcao acao={concluirItemAcao} botao="Confirmar conclusão" tamanho="pequeno" className={styles.painel}>
            {ocultos}
            {campo(`${pfx}-conc`, "Data de conclusão", <input id={`${pfx}-conc`} type="date" name="dataConclusao" defaultValue={hoje} required className={styles.entrada} />)}
            {campo(
              `${pfx}-just`,
              "Justificativa da data (se não for hoje)",
              <input id={`${pfx}-just`} name="justificativaData" maxLength={1000} className={styles.entrada} placeholder="Motivo da data" />,
            )}
            <CampoArquivos rotulo="Arquivos de evidência" ajuda="Fotos, PDF, DOCX, XLSX ou TXT — até 10 MB cada." />
            {campo(
              `${pfx}-evid`,
              "Descrição da evidência",
              <textarea id={`${pfx}-evid`} name="evidencia" rows={3} className={styles.entrada} placeholder="Descreva o que foi feito e onde está a prova" />,
            )}
            {campo(
              `${pfx}-link`,
              "Link da pasta ou do arquivo",
              <input id={`${pfx}-link`} type="url" name="linkEvidencia" className={styles.entrada} placeholder="https://… (pasta na nuvem, por exemplo)" />,
            )}
            <p className={styles.avisoEvidencia}>
              Evidência é anexo, descrição ou link. Sem nenhuma delas a ação é concluída, mas fica marcada como “Sem evidência” e a qualidade é avisada.
            </p>
            <p className={styles.avisoEvidencia}>
              A justificativa da data é obrigatória quando a data é futura, ou anterior a hoje e quem conclui não é o responsável pela ação.
            </p>
          </FormAcao>
        </details>
      )}
      {podeGerenciar && (
        <details className={styles.painelDetalhes}>
          <summary className={`${botoes.botao} ${botoes.secundario} ${styles.resumo}`}>Editar</summary>
          <FormAcao acao={editarItemAcao} botao="Salvar" tamanho="pequeno" className={styles.painel}>
            {ocultos}
            {campo(`${pfx}-oque`, "O quê", <input id={`${pfx}-oque`} name="oQue" defaultValue={item.oQue} required className={styles.entrada} />)}
            {campo(`${pfx}-porque`, "Por quê", <input id={`${pfx}-porque`} name="porQue" defaultValue={item.porQue ?? ""} className={styles.entrada} />)}
            {campo(`${pfx}-onde`, "Onde", <input id={`${pfx}-onde`} name="onde" defaultValue={item.onde ?? ""} className={styles.entrada} />)}
            {campo(
              `${pfx}-quem`,
              "Quem",
              <select id={`${pfx}-quem`} name="quemId" defaultValue={item.quemId} className={styles.entrada}>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>,
            )}
            {campo(`${pfx}-quando`, "Quando", <input id={`${pfx}-quando`} type="date" name="quando" defaultValue={dataIso(item.quando)} required className={styles.entrada} />)}
            {campo(`${pfx}-como`, "Como", <input id={`${pfx}-como`} name="como" defaultValue={item.como ?? ""} className={styles.entrada} />)}
            {campo(
              `${pfx}-quanto`,
              "Quanto (R$)",
              <input id={`${pfx}-quanto`} type="number" min={0} step="0.01" name="quanto" defaultValue={item.quanto?.toString() ?? ""} className={styles.entrada} />,
            )}
          </FormAcao>
        </details>
      )}
      {podeGerenciar && (
        <FormAcao acao={cancelarItemAcao} botao="Cancelar" confirmar="Cancelar este item?" variante="perigo" tamanho="pequeno">
          {ocultos}
        </FormAcao>
      )}
    </div>
  );
}
