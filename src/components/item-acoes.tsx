import { cancelarItemAcao, concluirItemAcao, editarItemAcao, iniciarItemAcao } from "@/app/(app)/rncs/actions";
import { FormAcao } from "@/components/form-acao";
import { cls } from "@/components/ui";
import { dataIso } from "@/lib/datas";

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
  if (!aberto || (!podeExecutar && !podeGerenciar)) return <span className="text-xs text-slate-400">—</span>;
  const ocultos = (
    <>
      <input type="hidden" name="itemId" value={item.id} />
      {rncId && <input type="hidden" name="rncId" value={rncId} />}
    </>
  );
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {podeExecutar && item.status === "PENDENTE" && (
        <FormAcao acao={iniciarItemAcao} botao="Iniciar" classeBotao={`${cls.btnSec} px-2 py-1 text-xs`}>
          {ocultos}
        </FormAcao>
      )}
      {podeExecutar && (
        <details className="group">
          <summary className={`${cls.btn} cursor-pointer list-none px-2 py-1 text-xs`}>Concluir</summary>
          <FormAcao acao={concluirItemAcao} botao="Confirmar conclusão" classeBotao={`${cls.btn} text-xs`} className="mt-2 w-72 space-y-2 rounded-md border border-slate-200 bg-white p-3 shadow">
            {ocultos}
            <label className={cls.label}>Data de conclusão</label>
            <input type="date" name="dataConclusao" defaultValue={hoje} required className={cls.input} />
            <label className={cls.label}>Evidência</label>
            <textarea name="evidencia" rows={3} required className={cls.input} placeholder="Descreva a evidência (anexos em breve)" />
          </FormAcao>
        </details>
      )}
      {podeGerenciar && (
        <details>
          <summary className={`${cls.btnSec} cursor-pointer list-none px-2 py-1 text-xs`}>Editar</summary>
          <FormAcao acao={editarItemAcao} botao="Salvar" classeBotao={`${cls.btn} text-xs`} className="mt-2 w-80 space-y-2 rounded-md border border-slate-200 bg-white p-3 shadow">
            {ocultos}
            <label className={cls.label}>O quê</label>
            <input name="oQue" defaultValue={item.oQue} required className={cls.input} />
            <label className={cls.label}>Por quê</label>
            <input name="porQue" defaultValue={item.porQue ?? ""} className={cls.input} />
            <label className={cls.label}>Onde</label>
            <input name="onde" defaultValue={item.onde ?? ""} className={cls.input} />
            <label className={cls.label}>Quem</label>
            <select name="quemId" defaultValue={item.quemId} className={cls.input}>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
            <label className={cls.label}>Quando</label>
            <input type="date" name="quando" defaultValue={dataIso(item.quando)} required className={cls.input} />
            <label className={cls.label}>Como</label>
            <input name="como" defaultValue={item.como ?? ""} className={cls.input} />
            <label className={cls.label}>Quanto (R$)</label>
            <input type="number" min={0} step="0.01" name="quanto" defaultValue={item.quanto?.toString() ?? ""} className={cls.input} />
          </FormAcao>
        </details>
      )}
      {podeGerenciar && (
        <FormAcao acao={cancelarItemAcao} botao="Cancelar" confirmar="Cancelar este item?" classeBotao={`${cls.btnPerigo} px-2 py-1 text-xs`}>
          {ocultos}
        </FormAcao>
      )}
    </div>
  );
}
