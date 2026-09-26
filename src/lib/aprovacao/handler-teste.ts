/**
 * Handler do tipo TESTE para a aplicação (fora de produção): permite exercitar as telas de
 * aprovação ponta a ponta. Não aplica nada — só marca o resumo, como o script de teste.
 */
import { registrarHandlerAprovacao, obterHandlerAprovacao } from "./registry";

if (process.env.NODE_ENV !== "production" && !obterHandlerAprovacao("TESTE")) {
  registrarHandlerAprovacao("TESTE", {
    async aoAprovar(tx, fluxo) {
      await tx.fluxoAprovacao.updateMany({ where: { id: fluxo.id }, data: { resumo: `${fluxo.resumo} [aplicado]` } });
    },
  });
}
