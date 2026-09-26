/**
 * Handler de aprovação do tipo PROCESSO (publicação de versão pelo motor multi-assinante).
 * Módulo com efeito colateral: importe-o (import "@/lib/processos/aprovacao") em qualquer ponto
 * de entrada que chame decidir() — ex.: as actions de /aprovacoes — para o handler estar
 * registrado no processo do servidor.
 */
import { atorTem } from "@/lib/ator";
import { obterHandlerAprovacao, registrarHandlerAprovacao } from "@/lib/aprovacao/registry";
import { publicarNaTransacao } from "./servico";

interface PayloadPublicacao {
  processoId?: string;
  observacao?: string | null;
}

if (!obterHandlerAprovacao("PROCESSO")) {
  registrarHandlerAprovacao("PROCESSO", {
    async aoAprovar(tx, fluxo) {
      if (fluxo.tipoAlteracao !== "PUBLICACAO") return;
      const p = fluxo.payload as PayloadPublicacao;
      const obs = [p.observacao, "Publicado via fluxo de aprovação."].filter(Boolean).join(" ");
      await publicarNaTransacao(tx, fluxo.empresaId, p.processoId ?? fluxo.entidadeId, fluxo.solicitanteId, obs);
    },
    podeVer(ator) {
      return atorTem(ator, "PROCESSO_GERENCIAR");
    },
  });
}
