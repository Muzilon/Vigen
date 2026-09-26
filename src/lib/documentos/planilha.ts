/**
 * Integração HIRA/LAIA ↔ Tramitação de Documentos (decisão 5 do dono, P4).
 * Com o módulo DOCUMENTOS ativo e `usarTramitacao` na configuração de aprovação do módulo
 * (Empresa.config.aprovacao.<hira|laia>), cada alteração aprovada no motor (inclusão, alteração,
 * exclusão) registra uma NOVA REVISÃO do documento-planilha controlado da obra:
 *   - documento com chavePlanilha "HIRA:<obraId>" / "LAIA:<obraId>" (criado na 1ª vez, tipo PL
 *     "Planilha controlada", código automático PL-NNN);
 *   - revisão publicada direto (as assinaturas já aconteceram no fluxo), com `conteudo` = snapshot
 *     JSON das linhas vigentes da obra e vínculo ao fluxo de aprovação; a vigente anterior vira OBSOLETA.
 * Sem arquivo anexo: o snapshot é baixado em JSON pela rota /documentos/[id]/versoes/[versaoId]/conteudo.
 * Roda na transação da última assinatura (handler); erro aqui desfaz a aprovação inteira.
 */
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/ator";
import { lerConfigAprovacao, canalAprovacao } from "@/lib/aprovacao/config-modulo";
import { dataIso, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";
import { proximaSequencia } from "@/lib/rnc/numeracao";
import { formatarCodigoDocumento, rotuloRevisao } from "./regras";

export type ModuloPlanilha = "HIRA" | "LAIA";
export const SIGLA_PLANILHA = "PL";
export const chavePlanilha = (m: ModuloPlanilha, obraId: string) => `${m}:${obraId}`;

const cod = (p: string, n: number) => `${p}-${String(n).padStart(3, "0")}`;

/** Snapshot das linhas vigentes da obra (JSON exportável). */
async function snapshot(tx: Tx, m: ModuloPlanilha, obraId: string) {
  if (m === "HIRA") {
    const ls = await tx.linhaHira.findMany({ where: { obraId, status: "VIGENTE" }, orderBy: { numero: "asc" } });
    return ls.map((l) => ({
      codigo: cod("H", l.numero), setor: l.setor, atividade: l.atividade, rotineira: l.rotineira, perigo: l.perigo, risco: l.risco, condicao: l.condicao,
      controlesExistentes: l.controlesExistentes, hierarquiaControle: l.hierarquiaControle, controlesPropostos: l.controlesPropostos,
      probabilidade: l.probabilidade, severidade: l.severidade, score: l.score, faixa: l.faixa,
      probabilidadeResidual: l.probabilidadeResidual, severidadeResidual: l.severidadeResidual, scoreResidual: l.scoreResidual, faixaResidual: l.faixaResidual,
      requisitoLegal: l.requisitoLegal, versao: l.versao,
    }));
  }
  const ls = await tx.linhaLaia.findMany({ where: { obraId, status: "VIGENTE" }, orderBy: { numero: "asc" } });
  return ls.map((l) => ({
    codigo: cod("A", l.numero), atividade: l.atividade, aspecto: l.aspecto, impacto: l.impacto, situacao: l.situacao, temporalidade: l.temporalidade,
    incidencia: l.incidencia, severidade: l.severidade, frequencia: l.frequencia, abrangencia: l.abrangencia, requisitoLegal: l.requisitoLegal,
    partesInteressadas: l.partesInteressadas, score: l.score, faixa: l.faixa, significativo: l.significativo, controles: l.controles, versao: l.versao,
  }));
}

/**
 * Registra a revisão da planilha controlada se o canal do módulo for TRAMITACAO. Devolve
 * { documentoId, numero } ou null (canal MOTOR — nada a fazer).
 */
export async function registrarRevisaoPlanilha(
  tx: Tx,
  quem: { empresaId: string; usuarioId: string },
  modulo: ModuloPlanilha,
  linhaId: string,
  motivo: string,
  fluxoId: string,
): Promise<{ documentoId: string; numero: number } | null> {
  const emp = await tx.empresa.findFirst({ where: { id: quem.empresaId }, select: { config: true, modulosAtivos: true, fusoHorario: true } });
  if (!emp) return null;
  const cfg = lerConfigAprovacao(emp.config, modulo === "HIRA" ? "hira" : "laia");
  if (canalAprovacao(emp.modulosAtivos, cfg) !== "TRAMITACAO") return null;

  const linha = modulo === "HIRA"
    ? await tx.linhaHira.findFirst({ where: { id: linhaId }, select: { obraId: true, obra: { select: { nome: true } } } })
    : await tx.linhaLaia.findFirst({ where: { id: linhaId }, select: { obraId: true, obra: { select: { nome: true } } } });
  if (!linha) return null;
  const chave = chavePlanilha(modulo, linha.obraId);
  const hoje = hojeNoFuso(emp.fusoHorario);

  let doc = await tx.documento.findFirst({ where: { chavePlanilha: chave } });
  if (!doc) {
    const tipo =
      (await tx.tipoDocumentoEmpresa.findFirst({ where: { sigla: SIGLA_PLANILHA } })) ??
      (await tx.tipoDocumentoEmpresa.create({ data: { empresaId: quem.empresaId, sigla: SIGLA_PLANILHA, nome: "Planilha controlada", periodicidadeRevisaoMeses: 12 } }));
    const seq = await proximaSequencia(tx, quem.empresaId, "DOCUMENTO", 0, tipo.id);
    doc = await tx.documento.create({
      data: {
        empresaId: quem.empresaId,
        tipoId: tipo.id,
        sequencia: seq,
        codigo: formatarCodigoDocumento(tipo.sigla, seq),
        titulo: `${modulo === "HIRA" ? "Planilha HIRA — perigos e riscos" : "Planilha LAIA — aspectos e impactos"} — ${linha.obra.nome}`,
        descricao: `Planilha controlada gerada pela tramitação das aprovações do ${modulo}. Cada aprovação registra uma nova revisão com o snapshot das linhas vigentes.`,
        obraId: linha.obraId,
        responsavelId: quem.usuarioId,
        periodicidadeRevisaoMeses: tipo.periodicidadeRevisaoMeses,
        status: "PUBLICADO",
        chavePlanilha: chave,
        criadoPorId: quem.usuarioId,
      },
    });
    await tx.historicoDocumento.create({ data: { empresaId: quem.empresaId, documentoId: doc.id, acao: "CRIACAO", observacao: `Planilha controlada ${modulo} criada pela tramitação.`, usuarioId: quem.usuarioId } });
  }

  const max = await tx.versaoDocumento.aggregate({ where: { documentoId: doc.id }, _max: { numero: true } });
  const numero = (max._max.numero ?? -1) + 1;
  const agora = new Date();
  const linhas = await snapshot(tx, modulo, linha.obraId);
  if (doc.versaoVigenteId) {
    await tx.versaoDocumento.updateMany({ where: { id: doc.versaoVigenteId, status: "PUBLICADA" }, data: { status: "OBSOLETA", obsoletoEm: agora } });
  }
  const v = await tx.versaoDocumento.create({
    data: {
      empresaId: quem.empresaId,
      documentoId: doc.id,
      numero,
      motivo: motivo.slice(0, 1000) || "Alteração aprovada.",
      status: "PUBLICADA",
      elaboradorId: quem.usuarioId,
      conteudo: { modulo, obraId: linha.obraId, obra: linha.obra.nome, geradoEm: agora.toISOString(), fluxoAprovacaoId: fluxoId, linhas } as Prisma.InputJsonValue,
      fluxoAprovacaoId: fluxoId,
      aprovadoEm: agora,
      publicadoEm: agora,
      publicadoPorId: quem.usuarioId,
    },
  });
  await tx.publicacaoDocumento.create({
    data: { empresaId: quem.empresaId, documentoId: doc.id, versaoId: v.id, publicoTodos: false, obraIds: [linha.obraId], notificar: false, exigirCiencia: false, publicadoPorId: quem.usuarioId, publicadoEm: agora },
  });
  await tx.documento.updateMany({
    where: { id: doc.id },
    data: {
      versaoVigenteId: v.id,
      status: doc.status === "OBSOLETO" || doc.status === "CANCELADO" ? doc.status : "PUBLICADO",
      proximaRevisaoEm: paraDataDb(calcularProximaReavaliacao(hoje, doc.periodicidadeRevisaoMeses)),
      versao: { increment: 1 },
    },
  });
  await tx.historicoDocumento.create({
    data: {
      empresaId: quem.empresaId,
      documentoId: doc.id,
      versaoId: v.id,
      acao: "REVISAO_PLANILHA",
      observacao: `${rotuloRevisao(numero)} — ${motivo}`.slice(0, 1000),
      dados: { fluxoAprovacaoId: fluxoId, linhas: linhas.length, data: dataIso(agora) },
      usuarioId: quem.usuarioId,
    },
  });
  return { documentoId: doc.id, numero };
}

/** Planilha controlada vigente de uma obra (para exibir código e revisão na tela do módulo). */
export async function planilhaControlada(db: Pick<Tx, "documento">, modulo: ModuloPlanilha, obraId: string) {
  return db.documento.findFirst({
    where: { chavePlanilha: chavePlanilha(modulo, obraId) },
    select: { id: true, codigo: true, versaoVigente: { select: { numero: true } } },
  });
}
