/**
 * Handler de aprovação LAIA (decisão 5): aplica INCLUSAO (linha PENDENTE_APROVACAO → VIGENTE),
 * ALTERACAO (dados recalculados no servidor, conferindo a versão lida na solicitação) e EXCLUSAO
 * (inativação) em nome do solicitante, na transação da última assinatura. Rejeição/cancelamento:
 * inclusão vira REJEITADA; alteração/exclusão só registram o histórico. Registrado por efeito
 * colateral — importe "@/lib/aprovacao/handlers" em todo ponto de entrada que chame decidir().
 */
import type { FluxoAprovacao } from "@prisma/client";
import { atorTem } from "@/lib/ator";
import { obterHandlerAprovacao, registrarHandlerAprovacao } from "@/lib/aprovacao/registry";
import type { Tx } from "@/lib/ator";
import { registrarRevisaoPlanilha } from "@/lib/documentos/planilha";
import type { DadosLaia } from "./regras";
import { aplicarAlteracaoLaia, aplicarExclusaoLaia, aprovarInclusaoLaia, registrarRejeicaoLaia } from "./servico";

interface PayloadLaia {
  linhaId?: string;
  versao?: number;
  dados?: DadosLaia;
  motivo?: string | null;
}

const solicitante = (f: FluxoAprovacao) => ({ empresaId: f.empresaId, usuarioId: f.solicitanteId, obrasPermitidas: null });

async function rejeitar(tx: Tx, f: FluxoAprovacao, verbo: string) {
  const p = f.payload as PayloadLaia;
  await registrarRejeicaoLaia(tx, solicitante(f), p.linhaId ?? f.entidadeId, f.tipoAlteracao === "INCLUSAO", `Solicitação ${verbo}: ${f.resumo}`);
}

if (!obterHandlerAprovacao("LAIA")) {
  registrarHandlerAprovacao("LAIA", {
    async aoAprovar(tx, fluxo) {
      const p = fluxo.payload as PayloadLaia;
      const id = p.linhaId ?? fluxo.entidadeId;
      const quem = solicitante(fluxo);
      const obs = `Aplicado via fluxo de aprovação: ${fluxo.resumo}${p.motivo ? ` (motivo: ${p.motivo})` : ""}`;
      if (fluxo.tipoAlteracao === "INCLUSAO" && p.dados) await aprovarInclusaoLaia(tx, quem, id, p.dados, p.versao, obs);
      else if (fluxo.tipoAlteracao === "ALTERACAO" && p.dados) await aplicarAlteracaoLaia(tx, quem, id, p.dados, p.versao, obs);
      else if (fluxo.tipoAlteracao === "EXCLUSAO") await aplicarExclusaoLaia(tx, quem, id, p.versao, obs);
      // P4: com "usar tramitação de documentos", registra a nova revisão da planilha controlada da obra.
      await registrarRevisaoPlanilha(tx, quem, "LAIA", id, `${fluxo.resumo}${p.motivo ? ` (motivo: ${p.motivo})` : ""}`, fluxo.id);
    },
    async aoRejeitar(tx, fluxo) {
      await rejeitar(tx, fluxo, "rejeitada");
    },
    async aoCancelar(tx, fluxo) {
      await rejeitar(tx, fluxo, "cancelada pelo solicitante");
    },
    podeVer(ator) {
      return atorTem(ator, "LAIA_GERENCIAR");
    },
  });
}
