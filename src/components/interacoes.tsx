import type { TipoEntidadeInteracao } from "@prisma/client";
import { enviarInteracaoAcao } from "@/app/(app)/rncs/actions";
import { AtualizarContadores } from "@/components/atualizar-contadores";
import { FormAcao } from "@/components/form-acao";
import { Cartao, cls } from "@/components/ui";
import type { Ator } from "@/lib/ator";
import { formatarDataHora } from "@/lib/datas";
import { listarInteracoes, marcarLidas } from "@/lib/interacoes/servico";
import { marcarLidasDaEntidade } from "@/lib/notificacoes/servico";

/** Seção "Interações" (thread da entidade). Ao exibir, marca as mensagens recebidas como lidas. */
export async function Interacoes({
  a,
  tipo,
  entidadeId,
  usuarios,
  fuso,
}: {
  a: Ator;
  tipo: TipoEntidadeInteracao;
  entidadeId: string;
  usuarios: { id: string; nome: string }[];
  fuso: string;
}) {
  const t = { tipo, entidadeId };
  const msgs = await listarInteracoes(a, t);
  // marcarLidas também marca as notificações INTERACAO_NOVA; contamos as duas para saber se o
  // contador do layout (sino) ficou desatualizado.
  const notifPendentes = await marcarLidasDaEntidade(a, tipo, entidadeId);
  const marcadas = (await marcarLidas(a, t)) + notifPendentes;
  return (
    <Cartao titulo="Interações">
      {marcadas > 0 && <AtualizarContadores />}
      {msgs.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma mensagem ainda.</p>
      ) : (
        <ul className="space-y-3">
          {msgs.map((m) => {
            const nova = m.destinatarioId === a.usuarioId && m.autorId !== a.usuarioId && m.leituras.length === 0;
            return (
              <li key={m.id} className={`rounded-md border p-3 text-sm ${m.autorId === a.usuarioId ? "border-emerald-100 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-800">{m.autor.nome}</span>
                  {m.destinatario && <span>para {m.destinatario.nome}</span>}
                  <span>· {formatarDataHora(m.criadoEm, fuso)}</span>
                  {nova && <span className="rounded bg-amber-100 px-1.5 text-amber-800">nova</span>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.mensagem}</p>
              </li>
            );
          })}
        </ul>
      )}
      <FormAcao acao={enviarInteracaoAcao} botao="Enviar" classeBotao={cls.btn} className="mt-4 space-y-2">
        <input type="hidden" name="entidadeTipo" value={tipo} />
        <input type="hidden" name="entidadeId" value={entidadeId} />
        <textarea name="mensagem" rows={3} required maxLength={4000} placeholder="Escreva uma mensagem" className={cls.input} />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500" htmlFor={`dest-${entidadeId}`}>Para</label>
          <select id={`dest-${entidadeId}`} name="destinatarioId" defaultValue="" className={`${cls.input} w-auto`}>
            <option value="">Padrão (responsável)</option>
            {usuarios.filter((u) => u.id !== a.usuarioId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      </FormAcao>
    </Cartao>
  );
}
