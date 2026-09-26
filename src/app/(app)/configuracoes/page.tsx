import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { Cabecalho, Cartao, cls } from "@/components/ui";
import { MAX_DIAS_ALERTA } from "@/lib/notificacoes/preferencias";
import { obterPreferencias } from "@/lib/notificacoes/preferencias-servico";
import { getContexto, temPermissao } from "@/lib/tenant";
import { salvarPreferenciasAcao } from "./actions";

export default async function Configuracoes() {
  const ctx = await getContexto();
  if (!temPermissao(ctx, "ADMIN_CONFIG")) notFound();
  const p = await obterPreferencias(ctx.empresaId);
  return (
    <div className="max-w-2xl">
      <Cabecalho titulo="Configurações" subtitulo={ctx.usuario.empresaNome} />
      <Cartao titulo="Notificações e alertas">
        <FormAcao acao={salvarPreferenciasAcao} botao="Salvar" classeBotao={cls.btn} className="space-y-4">
          <div>
            <label className={cls.label} htmlFor="diasAlertaPrazo">Alertar itens de ação com prazo em até (dias)</label>
            <input
              id="diasAlertaPrazo"
              name="diasAlertaPrazo"
              type="number"
              min={0}
              max={MAX_DIAS_ALERTA}
              required
              defaultValue={p.diasAlertaPrazo}
              className={`${cls.input} w-28`}
            />
            <p className="mt-1 text-xs text-slate-500">0 = alerta somente no dia do prazo. Itens atrasados geram um aviso ao executor e ao responsável.</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="resumoSemanal" defaultChecked={p.resumoSemanal} className="mt-0.5" />
            <span>
              Resumo semanal
              <span className="block text-xs text-slate-500">Toda segunda-feira, gestores do SGI e administradores recebem RNCs abertas, itens atrasados e taxa de eficácia.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="email" defaultChecked={p.email} className="mt-0.5" />
            <span>
              Enviar também por e-mail
              <span className="block text-xs text-slate-500">As notificações continuam disponíveis no sino do sistema.</span>
            </span>
          </label>
        </FormAcao>
      </Cartao>
    </div>
  );
}
