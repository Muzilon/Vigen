/**
 * Seed de Auditorias (P5) — Monto: programa 2026, 1 auditoria interna concluída (plano, constatações dos 4
 * tipos, 1 NC virando RNC real com evidência anexada) e 1 externa planejada. Feito pelo serviço.
 * Idempotente: só cria se a empresa ainda não tiver auditorias.
 */
import type { PrismaClient } from "@prisma/client";
import type { Ator } from "../src/lib/ator";
import { enviarAnexos } from "../src/lib/anexos/servico";
import {
  abrirRncDaConstatacao,
  concluirAuditoria,
  criarAuditoria,
  iniciarAuditoria,
  obterAuditoria,
  registrarConstatacao,
  salvarPrograma,
} from "../src/lib/auditorias/servico";
import { criarDbTenant } from "../src/lib/db-tenant";
import { permissoesEfetivas } from "../src/lib/permissoes";
import { gerarPngExemplo } from "../scripts/png-exemplo";

async function ator(prisma: PrismaClient, email: string): Promise<Ator> {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { perfil: true, acessosObra: true } });
  const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
  const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
  return { db: criarDbTenant(u.empresaId, prisma), empresaId: u.empresaId, usuarioId: u.id, permissoes, obrasPermitidas: todas ? null : u.acessosObra.map((x) => x.obraId) };
}

export async function semearAuditorias(prisma: PrismaClient, empresaId: string) {
  if ((await prisma.auditoria.count({ where: { empresaId } })) > 0) return;
  const q = await ator(prisma, "qualidade@monto.com.br");
  const adm = await ator(prisma, "admin@monto.com.br");
  const alfa = (await prisma.obraUnidade.findFirstOrThrow({ where: { empresaId, nome: "Obra Alfa" } })).id;
  const pf03 = (await prisma.processo.findUnique({ where: { empresaId_codigo: { empresaId, codigo: "PF-03" } } }))?.id ?? null;
  const prog = await salvarPrograma(q, {
    ano: 2026,
    objetivo: "Auditar todos os processos do SGI (ISO 9001, 14001 e 45001) ao menos uma vez no ano, priorizando obras em execução e processos com RNCs recorrentes; preparar a recertificação ISO 9001 em novembro.",
  });

  const a1 = await criarAuditoria(
    q,
    { programaId: prog.id, tipo: "INTERNA", norma: "ISO 9001:2015", escopo: "Execução de obra (PF-03) e controle de documentos na Obra Alfa", processoId: pf03, obraId: alfa, auditorLiderId: q.usuarioId, equipe: "Técnico de Segurança (observador)", dataInicio: "2026-08-18", dataFim: "2026-08-19" },
    [
      { requisito: "7.5.3 Controle de informação documentada", pergunta: "Documentos obsoletos são retirados dos pontos de uso?" },
      { requisito: "8.5.1 Controle de produção", pergunta: "As FVS (fichas de verificação de serviço) são preenchidas e assinadas?" },
      { requisito: "7.1.5 Recursos de monitoramento e medição", pergunta: "Equipamentos de medição estão calibrados e identificados?" },
      { requisito: "7.2 Competência", pergunta: "Há evidência de treinamento dos encarregados?" },
      { requisito: "10.2 Não conformidade e ação corretiva", pergunta: "RNCs abertas têm causa raiz e plano?" },
    ],
  );
  await iniciarAuditoria(q, a1.id);
  const it = (await obterAuditoria(q, a1.id))!.itens;
  const nc = await registrarConstatacao(q, a1.id, {
    itemAuditoriaId: it[0].id,
    tipo: "NAO_CONFORMIDADE",
    descricao: "Revisão 02 do procedimento de concretagem (obsoleta) em uso no canteiro, sem carimbo de cópia não controlada.",
    evidencia: "Pasta da frente de concretagem, bloco B, em 18/08/2026; encarregado desconhecia a Rev. 03.",
  });
  await enviarAnexos(q, { tipo: "CONSTATACAO_AUDITORIA", entidadeId: nc.id }, [{ nome: "procedimento-obsoleto.png", dados: gerarPngExemplo([60, 90, 170]) }]);
  await registrarConstatacao(q, a1.id, { itemAuditoriaId: it[2].id, tipo: "OBSERVACAO", descricao: "Trena digital sem etiqueta de calibração visível (certificado localizado no escritório)." });
  await registrarConstatacao(q, a1.id, { itemAuditoriaId: it[1].id, tipo: "OPORTUNIDADE_MELHORIA", descricao: "Digitalizar as FVS para reduzir retrabalho de lançamento." });
  await registrarConstatacao(q, a1.id, { itemAuditoriaId: it[4].id, tipo: "PONTO_FORTE", descricao: "RNCs da obra com análise de causa e planos em dia." });
  await abrirRncDaConstatacao(q, nc.id, { gravidade: "MEDIA", responsavelId: q.usuarioId });
  await concluirAuditoria(q, a1.id, "Sistema implementado e eficaz no escopo auditado, com 1 não conformidade menor em controle de documentos (RNC aberta).");

  await criarAuditoria(adm, {
    programaId: prog.id,
    tipo: "EXTERNA_CERTIFICACAO",
    norma: "ISO 9001:2015",
    escopo: "Auditoria de recertificação — todos os processos da sede e Obra Beta",
    auditorLiderId: q.usuarioId,
    equipe: "Organismo certificador (2 auditores)",
    dataInicio: "2026-11-10",
    dataFim: "2026-11-12",
  });
}
