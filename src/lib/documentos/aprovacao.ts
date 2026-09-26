/**
 * Handler de aprovação DOCUMENTO (motor multi-assinante): assinatura intermediária → EM_APROVACAO
 * quando todos os revisores assinaram; última assinatura → revisão APROVADA (pronta para publicar);
 * rejeição/cancelamento → revisão volta a rascunho. Registrado por efeito colateral — importe
 * "@/lib/aprovacao/handlers" em todo ponto de entrada que chame decidir().
 */
import type { FluxoAprovacao } from "@prisma/client";
import { obterHandlerAprovacao, registrarHandlerAprovacao } from "@/lib/aprovacao/registry";
import { podeGerenciarDocumentos } from "./acesso";
import { aprovarRevisao, avancarDocumento, devolverRevisao } from "./servico";

const quem = (f: FluxoAprovacao, usuarioId: string) => ({ empresaId: f.empresaId, usuarioId });

if (!obterHandlerAprovacao("DOCUMENTO")) {
  registrarHandlerAprovacao("DOCUMENTO", {
    async aoAvancar(tx, fluxo, ator) {
      await avancarDocumento(tx, fluxo, quem(fluxo, ator.usuarioId));
    },
    async aoAprovar(tx, fluxo, ator) {
      await aprovarRevisao(tx, fluxo, quem(fluxo, ator.usuarioId));
    },
    async aoRejeitar(tx, fluxo, ator) {
      await devolverRevisao(tx, fluxo, quem(fluxo, ator.usuarioId), false);
    },
    async aoCancelar(tx, fluxo, ator) {
      await devolverRevisao(tx, fluxo, quem(fluxo, ator.usuarioId), true);
    },
    podeVer(ator) {
      return podeGerenciarDocumentos(ator);
    },
  });
}
