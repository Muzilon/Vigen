import { cancelarItemAcao, concluirItemAcao, editarItemAcao, iniciarItemAcao } from "@/app/(app)/rncs/actions";
import { CampoArquivos } from "@/paginas/html/componentes/campo-arquivos";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { dataIso } from "@/lib/datas";
import botoes from "@/paginas/css/componentes/botao.module.css";
import styles from "@/paginas/css/componentes/item-acoes.module.css";

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

/** Ações por item: execução (quem) e gestão (responsável da RNC / PLANO_GERENCIAR). */
export function ItemAcoes({
  item,
  rncId,
  podeExecutar,
  podeGerenciar,
  usuarios,
  hoje,
}: {
  item: ItemParaAcoes;
  rncId?: string;
  podeExecutar: boolean;
  podeGerenciar: boolean;
  usuarios: { id: string; nome: string }[];
  hoje: string;
}) {
  const aberto = item.status === "PENDENTE" || item.status === "EM_ANDAMENTO";
  if (!aberto || (!podeExecutar && !podeGerenciar)) return <span className={styles.semAcao}>—</span>;
  const ocultos = (
    <>
      <input type="hidden" name="itemId" value={item.id} />
      {rncId && <input type="hidden" name="rncId" value={rncId} />}
    </>
  );
  const campo = (id: string, rotulo: string, controle: React.ReactNode) => (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.rotulo}>{rotulo}</label>
      {controle}
    </div>
  );
  const pfx = `it-${item.id}`;
  return (
    <div className={styles.acoes}>
      {podeExecutar && item.status === "PENDENTE" && (
        <FormAcao acao={iniciarItemAcao} botao="Iniciar" variante="secundario" tamanho="pequeno">
          {ocultos}
        </FormAcao>
      )}
      {podeExecutar && (
        <details className={styles.painelDetalhes}>
          <summary className={`${botoes.botao} ${botoes.primario} ${styles.resumo}`}>Concluir</summary>
          <FormAcao acao={concluirItemAcao} botao="Confirmar conclusão" tamanho="pequeno" className={styles.painel}>
            {ocultos}
            {campo(`${pfx}-conc`, "Data de conclusão", <input id={`${pfx}-conc`} type="date" name="dataConclusao" defaultValue={hoje} required className={styles.entrada} />)}
            {campo(
              `${pfx}-evid`,
              "Evidência",
              <textarea id={`${pfx}-evid`} name="evidencia" rows={3} required className={styles.entrada} placeholder="Descreva a evidência" />,
            )}
            <CampoArquivos rotulo="Arquivos de evidência (opcional)" ajuda="Fotos, PDF, DOCX, XLSX ou TXT — até 10 MB cada." />
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
