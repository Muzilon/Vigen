/**
 * Handler de aprovação HIRA (decisão 5): aplica INCLUSAO (linha PENDENTE_APROVACAO → VIGENTE),
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
import type { DadosHira } from "./regras";
import { aplicarAlteracaoHira, aplicarExclusaoHira, aprovarInclusaoHira, registrarRejeicaoHira } from "./servico";

interface PayloadHira {
  linhaId?: string;
  versao?: number;
  dados?: DadosHira;
  motivo?: string | null;
}

const solicitante = (f: FluxoAprovacao) => ({ empresaId: f.empresaId, usuarioId: f.solicitanteId, obrasPermitidas: null });

async function rejeitar(tx: Tx, f: FluxoAprovacao, verbo: string) {
  const p = f.payload as PayloadHira;
  await registrarRejeicaoHira(tx, solicitante(f), p.linhaId ?? f.entidadeId, f.tipoAlteracao === "INCLUSAO", `Solicitação ${verbo}: ${f.resumo}`);
}

if (!obterHandlerAprovacao("HIRA")) {
  registrarHandlerAprovacao("HIRA", {
    async aoAprovar(tx, fluxo) {
      const p = fluxo.payload as PayloadHira;
      const id = p.linhaId ?? fluxo.entidadeId;
      const quem = solicitante(fluxo);
      const obs = `Aplicado via fluxo de aprovação: ${fluxo.resumo}${p.motivo ? ` (motivo: ${p.motivo})` : ""}`;
      if (fluxo.tipoAlteracao === "INCLUSAO" && p.dados) await aprovarInclusaoHira(tx, quem, id, p.dados, p.versao, obs);
      else if (fluxo.tipoAlteracao === "ALTERACAO" && p.dados) await aplicarAlteracaoHira(tx, quem, id, p.dados, p.versao, obs);
      else if (fluxo.tipoAlteracao === "EXCLUSAO") await aplicarExclusaoHira(tx, quem, id, p.versao, obs);
      // P4: com "usar tramitação de documentos", registra a nova revisão da planilha controlada da obra.
      await registrarRevisaoPlanilha(tx, quem, "HIRA", id, `${fluxo.resumo}${p.motivo ? ` (motivo: ${p.motivo})` : ""}`, fluxo.id);
    },
    async aoRejeitar(tx, fluxo) {
      await rejeitar(tx, fluxo, "rejeitada");
    },
    async aoCancelar(tx, fluxo) {
      await rejeitar(tx, fluxo, "cancelada pelo solicitante");
    },
    podeVer(ator) {
      return atorTem(ator, "HIRA_GERENCIAR");
    },
  });
}
