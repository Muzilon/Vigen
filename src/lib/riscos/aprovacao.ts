/**
 * Handler de aprovação RISCO_OPORTUNIDADE (opcional): aplica ALTERACAO (dados principais, com
 * trava pela versão lida na solicitação) e EXCLUSAO (exclusão lógica) em nome do solicitante,
 * na mesma transação da última assinatura. Registrado por efeito colateral — importe
 * "@/lib/aprovacao/handlers" em todo ponto de entrada que chame decidir().
 */
import { atorTem } from "@/lib/ator";
import { obterHandlerAprovacao, registrarHandlerAprovacao } from "@/lib/aprovacao/registry";
import type { DadosRisco } from "./regras";
import { aplicarEdicaoNaTransacao, excluirNaTransacao } from "./servico";

interface PayloadRisco {
  riscoId?: string;
  versao?: number;
  dados?: DadosRisco;
}

if (!obterHandlerAprovacao("RISCO_OPORTUNIDADE")) {
  registrarHandlerAprovacao("RISCO_OPORTUNIDADE", {
    async aoAprovar(tx, fluxo) {
      const p = fluxo.payload as PayloadRisco;
      const id = p.riscoId ?? fluxo.entidadeId;
      // Aplica em nome do solicitante; obrasPermitidas null: a checagem de escopo já ocorreu na solicitação.
      const quem = { empresaId: fluxo.empresaId, usuarioId: fluxo.solicitanteId, obrasPermitidas: null };
      const obs = `Aplicado via fluxo de aprovação: ${fluxo.resumo}`;
      if (fluxo.tipoAlteracao === "ALTERACAO" && p.dados) await aplicarEdicaoNaTransacao(tx, quem, id, p.dados, p.versao, obs);
      else if (fluxo.tipoAlteracao === "EXCLUSAO") await excluirNaTransacao(tx, quem, id, obs);
    },
    podeVer(ator) {
      return atorTem(ator, "RISCO_GERENCIAR");
    },
  });
}
