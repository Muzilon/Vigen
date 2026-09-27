/**
 * Rotinas agendadas. ÚNICO lugar (além de seed/auth) que usa prismaAdmin: lista as empresas
 * e, para cada uma, trabalha com criarDbTenant(empresa.id) — toda consulta fica filtrada por
 * empresaId. Tudo é idempotente (flags no item + chaveIdempotencia única por empresa).
 */
import type { Modulo, PrismaClient } from "@prisma/client";
import { dataIso, hojeNoFuso, paraDataDb, somarDias } from "@/lib/datas";
import { criarDbTenant, type DbTenant } from "@/lib/db-tenant";
import { carregarIndicadores } from "@/lib/indicadores/servico";
import { prismaAdmin } from "@/lib/prisma";
import { gerarAlertasReavaliacao } from "@/lib/reavaliacao/fontes";
import "@/lib/riscos/reavaliacao";
import "@/lib/hira/reavaliacao";
import "@/lib/laia/reavaliacao";
import "@/lib/documentos/reavaliacao";
import "@/lib/requisitos-legais/reavaliacao";
import "@/lib/requisitos-legais/reavaliacao";
import { atorDoUsuario, usuariosAtivos } from "./destinatarios";
import { descricaoItem, linkItem } from "./gatilhos";
import { lerPreferencias, type PreferenciasNotificacao } from "./preferencias";
import { diasAte, segundaDaSemana, selecionarAlertas } from "./selecao";
import { criarNotificacoes, reenviarEmailsPendentes, type NovaNotificacao } from "./servico";

const DIA_MS = 86_400_000;
export const DIAS_RETENCAO_TENTATIVA_LOGIN = 30;

export interface OpcoesCron {
  agora?: Date;
  /** Cliente base (scripts de teste passam o próprio). */
  base?: PrismaClient;
  /** Restringe a execução a estas empresas (testes). */
  empresaIds?: string[];
}

interface EmpresaCron {
  id: string;
  nome: string;
  fusoHorario: string;
  diasAlertaPrazo: number;
  config: unknown;
  modulosAtivos: Modulo[];
}

async function empresasAtivas(base: PrismaClient, ids?: string[]): Promise<EmpresaCron[]> {
  return base.empresa.findMany({
    where: { ativo: true, ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, nome: true, fusoHorario: true, diasAlertaPrazo: true, config: true, modulosAtivos: true },
    orderBy: { criadoEm: "asc" },
  });
}

// ---------------------------------------------------------------- diário

export interface ResultadoDiarioEmpresa {
  empresaId: string;
  hoje: string;
  alertasPrazo: number;
  avisosAtraso: number;
  notificacoesCriadas: number;
  emailsReenviados: number;
  alertasReavaliacao: number;
  erro?: string;
}

/** Alertas de prazo e atraso de itens de ação de UMA empresa (db já isolado). */
export async function alertasDaEmpresa(db: DbTenant, empresa: EmpresaCron, prefs: PreferenciasNotificacao, agora: Date) {
  const hoje = hojeNoFuso(empresa.fusoHorario, agora);
  const limite = somarDias(hoje, prefs.diasAlertaPrazo);
  const itens = await db.itemAcao.findMany({
    where: {
      status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
      // M1: só o que ainda precisa de aviso, filtrado no banco (itens já tratados não ocupam o lote).
      OR: [
        { quando: { lt: paraDataDb(hoje) }, atrasoNotificadoEm: null },
        { quando: { gte: paraDataDb(hoje), lte: paraDataDb(limite) }, alertaEnviadoEm: null },
      ],
      planoAcao: {
        OR: [{ rnc: { is: null } }, { rnc: { is: { status: { notIn: ["ENCERRADO", "CANCELADO"] } } } }],
      },
    },
    orderBy: [{ quando: "asc" }, { id: "asc" }],
    select: {
      id: true,
      oQue: true,
      status: true,
      quando: true,
      quemId: true,
      alertaEnviadoEm: true,
      atrasoNotificadoEm: true,
      quem: { select: { nome: true } },
      planoAcao: {
        select: {
          criadoPorId: true,
          rnc: { select: { codigo: true, titulo: true, restrita: true, contemDadosPessoais: true, responsavelId: true } },
        },
      },
    },
    take: 5000,
  });
  const { prazo, atraso } = selecionarAlertas(itens, hoje, prefs.diasAlertaPrazo);

  const notifs: NovaNotificacao[] = [];
  for (const i of prazo) {
    const d = diasAte(hoje, i.quando);
    notifs.push({
      usuarioId: i.quemId,
      tipo: "ITEM_PRAZO_PROXIMO",
      entidadeTipo: "ITEM_ACAO",
      entidadeId: i.id,
      titulo: d === 0 ? "Ação vence hoje" : `Ação vence em ${d} dia${d > 1 ? "s" : ""}`,
      corpo: `${descricaoItem(i)}\nPrazo: ${dataIso(i.quando).split("-").reverse().join("/")}`,
      link: linkItem(i.id),
      chave: `item-prazo:${i.id}:${dataIso(i.quando)}`,
    });
  }
  for (const i of atraso) {
    const d = -diasAte(hoje, i.quando);
    // Aviso ao executor e ao responsável pela RNC (ou a quem criou o plano).
    const gestor = i.planoAcao.rnc ? i.planoAcao.rnc.responsavelId : i.planoAcao.criadoPorId;
    for (const uid of new Set([i.quemId, ...(gestor ? [gestor] : [])])) {
      notifs.push({
        usuarioId: uid,
        tipo: "ITEM_ATRASADO",
        entidadeTipo: "ITEM_ACAO",
        entidadeId: i.id,
        titulo: `Ação atrasada há ${d} dia${d > 1 ? "s" : ""}`,
        corpo: `${descricaoItem(i)}\nResponsável: ${i.quem.nome}\nPrazo: ${dataIso(i.quando).split("-").reverse().join("/")}`,
        link: linkItem(i.id),
        chave: `item-atraso:${i.id}:${dataIso(i.quando)}:${uid}`,
      });
    }
  }
  // Notifica primeiro (chave idempotente) e só depois marca o item: se cair no meio, a próxima
  // execução reprocessa sem duplicar.
  const criadas = await criarNotificacoes(db, empresa.id, notifs);
  if (prazo.length) {
    await db.itemAcao.updateMany({ where: { id: { in: prazo.map((i) => i.id) }, alertaEnviadoEm: null }, data: { alertaEnviadoEm: agora } });
  }
  if (atraso.length) {
    await db.itemAcao.updateMany({ where: { id: { in: atraso.map((i) => i.id) }, atrasoNotificadoEm: null }, data: { atrasoNotificadoEm: agora } });
  }
  return { hoje, alertasPrazo: prazo.length, avisosAtraso: atraso.length, notificacoesCriadas: criadas.length };
}

export async function executarCronDiario(opts: OpcoesCron = {}) {
  const base = opts.base ?? prismaAdmin;
  const agora = opts.agora ?? new Date();
  const empresas: ResultadoDiarioEmpresa[] = [];
  for (const e of await empresasAtivas(base, opts.empresaIds)) {
    const db = criarDbTenant(e.id, base);
    try {
      const r = await alertasDaEmpresa(db, e, lerPreferencias(e), agora);
      const alertasReavaliacao = await gerarAlertasReavaliacao(db, e, r.hoje);
      const emailsReenviados = await reenviarEmailsPendentes(db, new Date(agora.getTime() - 2 * DIA_MS));
      empresas.push({ empresaId: e.id, ...r, alertasReavaliacao, emailsReenviados });
    } catch (err) {
      console.error(`[cron diario] empresa ${e.id}`, err);
      empresas.push({
        empresaId: e.id, hoje: hojeNoFuso(e.fusoHorario, agora), alertasPrazo: 0, avisosAtraso: 0,
        notificacoesCriadas: 0, alertasReavaliacao: 0, emailsReenviados: 0, erro: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // tentativa_login é global (e-mail é único no sistema): limpeza única por execução.
  const corte = new Date(agora.getTime() - DIAS_RETENCAO_TENTATIVA_LOGIN * DIA_MS);
  const { count: tentativasRemovidas } = await base.tentativaLogin.deleteMany({ where: { criadoEm: { lt: corte } } });
  return { executadoEm: agora.toISOString(), empresas, tentativasRemovidas };
}

// ---------------------------------------------------------------- semanal

export async function executarCronSemanal(opts: OpcoesCron = {}) {
  const base = opts.base ?? prismaAdmin;
  const agora = opts.agora ?? new Date();
  const out: { empresaId: string; semana: string; destinatarios: number; notificacoesCriadas: number; pulada?: string; erro?: string }[] = [];
  for (const e of await empresasAtivas(base, opts.empresaIds)) {
    const semana = segundaDaSemana(hojeNoFuso(e.fusoHorario, agora));
    if (!lerPreferencias(e).resumoSemanal) {
      out.push({ empresaId: e.id, semana, destinatarios: 0, notificacoesCriadas: 0, pulada: "resumo semanal desativado" });
      continue;
    }
    const db = criarDbTenant(e.id, base);
    try {
      const gestores = (await usuariosAtivos(db)).filter((u) => u.papel === "GESTOR_SGI" || u.permissoes.includes("ADMIN_CONFIG"));
      const notifs: NovaNotificacao[] = [];
      for (const u of gestores) {
        // Indicadores na visão do destinatário (respeita obras/restritas dele).
        // B7: indicadores calculados no "agora" do cron (não na hora real).
        const { indicadores, periodo } = await carregarIndicadores(atorDoUsuario(db, e.id, u), {}, agora);
        const k = indicadores.kpis;
        const eficacia = k.eficaciaPrimeiraVerificacaoPct === null ? "sem verificações no período" : `${Math.round(k.eficaciaPrimeiraVerificacaoPct)}%`;
        notifs.push({
          usuarioId: u.id,
          tipo: "RESUMO_SEMANAL",
          titulo: `Resumo semanal — ${e.nome}`,
          corpo: `RNCs abertas: ${k.abertas}\nItens de ação atrasados: ${k.itensAtrasados}\nEficácia na 1ª verificação (12 meses): ${eficacia}`,
          link: "/dashboard",
          chave: `resumo:${semana}:${u.id}`,
          detalhesEmail: [
            { rotulo: "Semana de", valor: semana.split("-").reverse().join("/") },
            { rotulo: "Período dos indicadores", valor: `${periodo.inicio.split("-").reverse().join("/")} a ${periodo.fim.split("-").reverse().join("/")}` },
          ],
        });
      }
      const criadas = await criarNotificacoes(db, e.id, notifs);
      out.push({ empresaId: e.id, semana, destinatarios: gestores.length, notificacoesCriadas: criadas.length });
    } catch (err) {
      console.error(`[cron semanal] empresa ${e.id}`, err);
      out.push({ empresaId: e.id, semana, destinatarios: 0, notificacoesCriadas: 0, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return { executadoEm: agora.toISOString(), empresas: out };
}
