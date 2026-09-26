/**
 * HIRA — Perigos e Riscos de SST (ISO 45001) — serviço de domínio (docs/06-desenho-modulos.md, seção 4).
 * Leitura: usuários com o módulo HIRA, restrita às obras do escopo (filtroObras; a linha sempre tem obra).
 * Inclusão/alteração/exclusão: HIRA_GERENCIAR — passam pelo fluxo de aprovação quando a empresa
 * exige (Empresa.config.aprovacao.hira, decisão 5); senão são aplicadas direto. Reavaliação e
 * plano de ação: HIRA_GERENCIAR ou o responsável da linha. Todo evento grava HistoricoLinhaHira
 * (append-only, com snapshot).
 */
import { Prisma, type FaixaNivel, type StatusLinhaSgi } from "@prisma/client";
import { atorTem, fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { aprovadoresEfetivos, obterConfigAprovacao } from "@/lib/aprovacao/config-modulo";
import { criarFluxoNaTransacao, notificarFluxoCriado } from "@/lib/aprovacao/servico";
import { dataIso, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { filtroObras, obraNoEscopo } from "@/lib/escopo-obras";
import { resolverConfiguracaoEscala } from "@/lib/escala/resolver";
import type { ConfigEscala, ConfiguracaoEscalaRegistro } from "@/lib/escala/tipos";
import { notificarItensAtribuidos } from "@/lib/notificacoes/gatilhos";
import { criarPlanoNaTransacao, type DadosItem } from "@/lib/plano-acao/servico";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";
import {
  avaliarPS,
  avaliarResidual,
  calcularLinhaHira,
  CAMPOS_DIFF_HIRA,
  codigoHira,
  diffCampos,
  type DadosHira,
} from "./regras";

export const linkHira = (id: string) => `/hira/${id}`;

type AcaoHistorico = "INCLUSAO" | "ALTERACAO" | "EXCLUSAO" | "REAVALIACAO" | "REVISAO_GERAL" | "PLANO" | "APROVACAO" | "REJEICAO";
type Quem = Pick<Ator, "empresaId" | "usuarioId" | "obrasPermitidas">;

// ---------------------------------------------------------------- acesso

export async function moduloHiraAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("HIRA");
}

export async function exigirModuloHira(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloHiraAtivo(a))) throw new ErroNegocio("Módulo HIRA não contratado para esta empresa.");
}

export const podeGerenciarHira = (a: Pick<Ator, "permissoes">) => atorTem(a, "HIRA_GERENCIAR");
export const podeTratarHira = (a: Pick<Ator, "permissoes" | "usuarioId">, l: { responsavelId: string | null }) =>
  atorTem(a, "HIRA_GERENCIAR") || l.responsavelId === a.usuarioId;

async function exigirGestao(a: Ator) {
  await exigirModuloHira(a);
  if (!podeGerenciarHira(a)) throw new ErroNegocio("Sem permissão para gerenciar o HIRA (HIRA_GERENCIAR).");
}

// ---------------------------------------------------------------- escala

type DbLeitura = Pick<Ator["db"], "configuracaoEscala"> | Tx;

async function registrosEscala(db: DbLeitura): Promise<ConfiguracaoEscalaRegistro[]> {
  return db.configuracaoEscala.findMany({
    where: { tipo: "HIRA" },
    select: { tipo: true, obraId: true, tamanho: true, eixos: true, faixas: true, criteriosExtras: true },
  });
}

/** Escala HIRA resolvida (obra → empresa → padrão do sistema). */
export async function configHira(db: DbLeitura, obraId: string | null): Promise<ConfigEscala> {
  return resolverConfiguracaoEscala(await registrosEscala(db), "HIRA", obraId);
}

/** Escalas por obra ("" = padrão da empresa) — para o cálculo ao vivo no formulário. */
export async function mapaEscalasHira(a: Pick<Ator, "db">, obraIds: readonly string[]): Promise<Record<string, ConfigEscala>> {
  const regs = await registrosEscala(a.db);
  const out: Record<string, ConfigEscala> = { "": resolverConfiguracaoEscala(regs, "HIRA", null) };
  for (const id of obraIds) out[id] = resolverConfiguracaoEscala(regs, "HIRA", id);
  return out;
}

/** Dados auxiliares das telas: obras acessíveis, processos, usuários, setores já usados e escalas. */
export async function opcoesHira(a: Ator) {
  const [processos, obras, usuarios, setores] = await Promise.all([
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.obraUnidade.findMany({
      where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.linhaHira.findMany({ where: filtroObras(a), distinct: ["setor"], select: { setor: true }, orderBy: { setor: "asc" } }),
  ]);
  return { processos, obras, usuarios, setores: setores.map((s) => s.setor), escalas: await mapaEscalasHira(a, obras.map((o) => o.id)) };
}

// ---------------------------------------------------------------- leitura

export interface FiltrosHira {
  obra?: string;
  setor?: string;
  /** uuid do processo ou "sem". */
  processo?: string;
  faixa?: FaixaNivel;
  status?: StatusLinhaSgi;
  /** Mostra rejeitadas e inativas (padrão: só vigentes e pendentes). */
  todas?: boolean;
}

const incluirLista = {
  obra: { select: { id: true, nome: true } },
  processo: { select: { id: true, codigo: true, nome: true } },
  responsavel: { select: { id: true, nome: true } },
} satisfies Prisma.LinhaHiraInclude;

export async function listarHira(a: Ator, f: FiltrosHira = {}) {
  await exigirModuloHira(a);
  return a.db.linhaHira.findMany({
    where: {
      AND: [
        filtroObras(a),
        f.obra ? { obraId: f.obra } : {},
        f.setor ? { setor: f.setor } : {},
        f.processo === "sem" ? { processoId: null } : f.processo ? { processoId: f.processo } : {},
        f.faixa ? { faixa: f.faixa } : {},
        f.status ? { status: f.status } : f.todas ? {} : { status: { in: ["VIGENTE", "PENDENTE_APROVACAO"] } },
      ],
    },
    include: incluirLista,
    orderBy: [{ obra: { nome: "asc" } }, { setor: "asc" }, { numero: "asc" }],
  });
}
export type LinhaHiraListada = Awaited<ReturnType<typeof listarHira>>[number];

export async function obterHira(a: Ator, id: string) {
  await exigirModuloHira(a);
  return a.db.linhaHira.findFirst({
    where: { AND: [{ id }, filtroObras(a)] },
    include: {
      ...incluirLista,
      criadoPor: { select: { nome: true } },
      planoAcao: {
        select: {
          id: true,
          titulo: true,
          itens: { orderBy: { ordem: "asc" }, select: { id: true, oQue: true, status: true, quando: true, quem: { select: { nome: true } } } },
        },
      },
    },
  });
}

export async function listarHistoricoHira(a: Ator, linhaId: string) {
  await exigirModuloHira(a);
  const l = await a.db.linhaHira.findFirst({ where: { AND: [{ id: linhaId }, filtroObras(a)] }, select: { id: true } });
  if (!l) return [];
  return a.db.historicoLinhaHira.findMany({ where: { linhaId }, include: { usuario: { select: { nome: true } } }, orderBy: { criadoEm: "desc" } });
}

/** Fluxos pendentes das linhas HIRA (entidadeId → tipo de alteração) — badges da planilha. */
export async function pendenciasHira(a: Ator) {
  const fs = await a.db.fluxoAprovacao.findMany({ where: { entidadeTipo: "HIRA", status: "PENDENTE" }, select: { id: true, entidadeId: true, tipoAlteracao: true } });
  return new Map(fs.map((f) => [f.entidadeId, f]));
}

/** Contagem por faixa das linhas vigentes + pendentes de aprovação (dashboard). null sem o módulo. */
export async function resumoHira(a: Ator) {
  if (!(await moduloHiraAtivo(a))) return null;
  const g = await a.db.linhaHira.groupBy({ by: ["faixa"], where: { AND: [{ status: "VIGENTE" }, filtroObras(a)] }, _count: { _all: true } });
  const porFaixa: Record<FaixaNivel, number> = { BAIXO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 };
  for (const x of g) porFaixa[x.faixa] = x._count._all;
  const pendentes = await a.db.fluxoAprovacao.count({ where: { entidadeTipo: "HIRA", status: "PENDENTE" } });
  return { porFaixa, pendentes };
}

/** Linhas HIRA ligadas a um processo (detalhe do processo). null sem o módulo. */
export async function listarHiraDoProcesso(a: Ator, processoId: string) {
  if (!(await moduloHiraAtivo(a))) return null;
  return a.db.linhaHira.findMany({
    where: { AND: [{ processoId, status: { in: ["VIGENTE", "PENDENTE_APROVACAO"] } }, filtroObras(a)] },
    select: { id: true, numero: true, atividade: true, perigo: true, faixa: true, score: true, status: true, obra: { select: { nome: true } } },
    orderBy: [{ score: "desc" }, { numero: "asc" }],
  });
}

// ---------------------------------------------------------------- utilitários de escrita

function ehUnicoViolado(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function validarReferencias(tx: Tx, a: Pick<Ator, "obrasPermitidas">, d: { processoId: string | null; obraId: string; responsavelId: string | null }) {
  if (!obraNoEscopo(a, d.obraId) || (await tx.obraUnidade.count({ where: { id: d.obraId, ativo: true } })) === 0) {
    throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
  }
  if (d.processoId && (await tx.processo.count({ where: { id: d.processoId, ativo: true } })) === 0) throw new ErroNegocio("Processo inválido.");
  if (d.responsavelId && (await tx.usuario.count({ where: { id: d.responsavelId, ativo: true } })) === 0) throw new ErroNegocio("Responsável inválido.");
}

async function carregar(tx: Tx, a: Pick<Ator, "obrasPermitidas">, id: string, status: StatusLinhaSgi | null = "VIGENTE") {
  const l = await tx.linhaHira.findFirst({ where: { AND: [{ id }, filtroObras(a), status ? { status } : {}] } });
  if (!l) throw new ErroNegocio(status === "VIGENTE" ? "Linha HIRA não encontrada ou não vigente." : "Linha HIRA não encontrada.");
  return l;
}
type Linha = Awaited<ReturnType<typeof carregar>>;

async function travar(tx: Tx, l: { id: string; versao: number }, data: Prisma.LinhaHiraUncheckedUpdateManyInput) {
  const r = await tx.linhaHira.updateMany({ where: { id: l.id, versao: l.versao }, data: { ...data, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
}

/** Snapshot dos dados da linha (JSON serializável) para o histórico e o payload "antes". */
export function snapshotHira(l: Linha) {
  return {
    codigo: codigoHira(l),
    obraId: l.obraId,
    setor: l.setor,
    processoId: l.processoId,
    atividade: l.atividade,
    rotineira: l.rotineira,
    perigo: l.perigo,
    risco: l.risco,
    condicao: l.condicao,
    controlesExistentes: l.controlesExistentes,
    hierarquiaControle: l.hierarquiaControle,
    controlesPropostos: l.controlesPropostos,
    probabilidade: l.probabilidade,
    severidade: l.severidade,
    score: l.score,
    faixa: l.faixa,
    probabilidadeResidual: l.probabilidadeResidual,
    severidadeResidual: l.severidadeResidual,
    scoreResidual: l.scoreResidual,
    faixaResidual: l.faixaResidual,
    requisitoLegal: l.requisitoLegal,
    responsavelId: l.responsavelId,
    planoAcaoId: l.planoAcaoId,
    modoReavaliacao: l.modoReavaliacao,
    periodicidadeMeses: l.periodicidadeMeses,
    proximaReavaliacaoEm: l.proximaReavaliacaoEm ? dataIso(l.proximaReavaliacaoEm) : null,
    status: l.status,
  };
}

async function registrarHistorico(tx: Tx, q: Pick<Ator, "empresaId" | "usuarioId">, linhaId: string, acao: AcaoHistorico, observacao?: string | null) {
  const l = await tx.linhaHira.findFirstOrThrow({ where: { id: linhaId } });
  await tx.historicoLinhaHira.create({
    data: {
      empresaId: q.empresaId,
      linhaId,
      acao,
      versao: l.versao,
      dados: snapshotHira(l) as Prisma.InputJsonValue,
      observacao: observacao?.trim().slice(0, 1000) || null,
      usuarioId: q.usuarioId,
    },
  });
}

function normalizarObs(o?: string | null) {
  const t = o?.trim() || null;
  if (t && t.length > 1000) throw new ErroNegocio("Observação com no máximo 1000 caracteres.");
  return t;
}

/** Recalcula no servidor (escala da obra) — nunca confia em score/faixa vindos do cliente/payload. */
async function calcular(tx: Tx, a: Pick<Ator, "obrasPermitidas">, d: DadosHira) {
  const semCalculo = calcularLinhaHira(await configHira(tx, d.obraId || null), d);
  await validarReferencias(tx, a, semCalculo);
  return semCalculo;
}

/** Decide se a operação passa por aprovação (config da empresa) e com quais aprovadores. */
async function politicaAprovacao(tx: Tx, a: Quem) {
  const c = await obterConfigAprovacao(tx, a.empresaId, "hira");
  if (!c.exigir) return null;
  // Canal "TRAMITACAO" (P4): as assinaturas são as mesmas do motor; o handler registra a revisão da
  // planilha controlada ao aprovar (src/lib/documentos/planilha.ts).
  return { aprovadorIds: aprovadoresEfetivos(c, a.usuarioId), modo: c.modo };
}

// ---------------------------------------------------------------- inclusão / alteração / exclusão

export interface ResultadoOperacao {
  id: string;
  /** Aplicado direto (sem aprovação) ou enviado para aprovação (fluxoId). */
  aplicado: boolean;
  fluxoId: string | null;
}

/**
 * Inclui uma linha. Com aprovação exigida: a linha nasce PENDENTE_APROVACAO e o fluxo de INCLUSAO
 * é criado na mesma transação; o handler a torna VIGENTE ao aprovar (ou REJEITADA).
 */
export async function incluirHira(a: Ator, d: DadosHira): Promise<ResultadoOperacao> {
  await exigirGestao(a);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const exec = () =>
    a.db.$transaction(async (tx) => {
      const dados = await calcular(tx, a, d);
      const politica = await politicaAprovacao(tx, a);
      const max = await tx.linhaHira.aggregate({ _max: { numero: true } });
      const l = await tx.linhaHira.create({
        data: {
          ...dados,
          empresaId: a.empresaId,
          numero: (max._max.numero ?? 0) + 1,
          status: politica ? "PENDENTE_APROVACAO" : "VIGENTE",
          proximaReavaliacaoEm: paraDataDb(calcularProximaReavaliacao(hoje, dados.periodicidadeMeses)),
          criadoPorId: a.usuarioId,
        },
      });
      await registrarHistorico(tx, a, l.id, "INCLUSAO", politica ? "Enviada para aprovação." : null);
      let fluxoId: string | null = null;
      if (politica) {
        fluxoId = (
          await criarFluxoNaTransacao(tx, a, {
            entidadeTipo: "HIRA",
            entidadeId: l.id,
            tipoAlteracao: "INCLUSAO",
            ...politica,
            payload: { linhaId: l.id, versao: l.versao, dados: { ...d } as unknown as Prisma.InputJsonValue, depois: snapshotHira(l) } as Prisma.InputJsonValue,
            resumo: `Inclusão HIRA ${codigoHira(l)} — ${dados.atividade}`.slice(0, 300),
          })
        ).id;
      }
      return { id: l.id, aplicado: !politica, fluxoId };
    });
  let r: ResultadoOperacao;
  try {
    r = await exec();
  } catch (e) {
    if (!ehUnicoViolado(e)) throw e;
    r = await exec(); // corrida no número sequencial
  }
  if (r.fluxoId) await notificarFluxoCriado(a, r.fluxoId);
  return r;
}

/** Aplica a alteração na transação (edição direta ou handler de aprovação). `versao` = trava otimista. */
export async function aplicarAlteracaoHira(tx: Tx, q: Quem, id: string, d: DadosHira, versao?: number, observacao?: string | null) {
  const l = await carregar(tx, q, id);
  if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
  const dados = await calcular(tx, q, d);
  let proxima = l.proximaReavaliacaoEm;
  if (dados.periodicidadeMeses !== l.periodicidadeMeses) {
    proxima = paraDataDb(calcularProximaReavaliacao(dataIso(l.ultimaReavaliacaoEm ?? l.criadoEm), dados.periodicidadeMeses));
  }
  await travar(tx, l, { ...dados, proximaReavaliacaoEm: proxima });
  await registrarHistorico(tx, q, id, "ALTERACAO", observacao);
}

/** Altera uma linha vigente: direto ou via aprovação (payload { antes, depois, dados, versao }). */
export async function alterarHira(a: Ator, id: string, d: DadosHira, versao?: number, motivo?: string | null): Promise<ResultadoOperacao> {
  await exigirGestao(a);
  const obs = normalizarObs(motivo);
  const r = await a.db.$transaction(async (tx) => {
    const politica = await politicaAprovacao(tx, a);
    if (!politica) {
      await aplicarAlteracaoHira(tx, a, id, d, versao, obs);
      return { id, aplicado: true, fluxoId: null };
    }
    const l = await carregar(tx, a, id);
    if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
    const dados = await calcular(tx, a, d);
    const { antes, depois } = diffCampos(snapshotHira(l) as Record<string, unknown>, { ...snapshotHira(l), ...dados } as Record<string, unknown>, CAMPOS_DIFF_HIRA);
    if (Object.keys(depois).length === 0 && dados.obraId === l.obraId && dados.processoId === l.processoId && dados.responsavelId === l.responsavelId
      && dados.modoReavaliacao === l.modoReavaliacao && dados.periodicidadeMeses === l.periodicidadeMeses) {
      throw new ErroNegocio("Nenhuma alteração em relação à versão vigente.");
    }
    const f = await criarFluxoNaTransacao(tx, a, {
      entidadeTipo: "HIRA",
      entidadeId: l.id,
      tipoAlteracao: "ALTERACAO",
      ...politica,
      payload: { linhaId: l.id, versao: l.versao, antes, depois, dados: { ...d } as unknown as Prisma.InputJsonValue, motivo: obs } as Prisma.InputJsonValue,
      resumo: `Alteração HIRA ${codigoHira(l)} — ${dados.atividade}`.slice(0, 300),
    });
    return { id, aplicado: false, fluxoId: f.id };
  });
  if (r.fluxoId) await notificarFluxoCriado(a, r.fluxoId);
  return r;
}

/** Exclusão = inativação (histórico preservado). */
export async function aplicarExclusaoHira(tx: Tx, q: Quem, id: string, versao?: number, observacao?: string | null) {
  const l = await carregar(tx, q, id);
  if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
  await travar(tx, l, { status: "INATIVA" });
  await registrarHistorico(tx, q, id, "EXCLUSAO", observacao);
}

export async function excluirHira(a: Ator, id: string, motivo?: string | null, versao?: number): Promise<ResultadoOperacao> {
  await exigirGestao(a);
  const obs = normalizarObs(motivo);
  const r = await a.db.$transaction(async (tx) => {
    const politica = await politicaAprovacao(tx, a);
    if (!politica) {
      await aplicarExclusaoHira(tx, a, id, versao, obs);
      return { id, aplicado: true, fluxoId: null };
    }
    const l = await carregar(tx, a, id);
    if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
    const f = await criarFluxoNaTransacao(tx, a, {
      entidadeTipo: "HIRA",
      entidadeId: l.id,
      tipoAlteracao: "EXCLUSAO",
      ...politica,
      payload: { linhaId: l.id, versao: l.versao, antes: { status: l.status }, depois: { status: "INATIVA" }, motivo: obs } as Prisma.InputJsonValue,
      resumo: `Exclusão HIRA ${codigoHira(l)} — ${l.atividade}`.slice(0, 300),
    });
    return { id, aplicado: false, fluxoId: f.id };
  });
  if (r.fluxoId) await notificarFluxoCriado(a, r.fluxoId);
  return r;
}

/** Handler: INCLUSAO aprovada → recalcula pelos dados do payload e torna a linha VIGENTE. */
export async function aprovarInclusaoHira(tx: Tx, q: Quem, id: string, d: DadosHira, versao: number | undefined, observacao: string) {
  const l = await carregar(tx, q, id, "PENDENTE_APROVACAO");
  if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
  const dados = await calcular(tx, q, d);
  await travar(tx, l, { ...dados, status: "VIGENTE" });
  await registrarHistorico(tx, q, id, "APROVACAO", observacao);
}

/** Handler: rejeição/cancelamento. INCLUSAO → linha REJEITADA; demais → só histórico. */
export async function registrarRejeicaoHira(tx: Tx, q: Quem, id: string, inclusao: boolean, observacao: string) {
  const l = await tx.linhaHira.findFirst({ where: { id } });
  if (!l) return;
  if (inclusao && l.status === "PENDENTE_APROVACAO") await travar(tx, l, { status: "REJEITADA" });
  await registrarHistorico(tx, q, id, "REJEICAO", observacao);
}

// ---------------------------------------------------------------- reavaliação

export interface DadosReavaliacaoHira {
  probabilidade: number;
  severidade: number;
  probabilidadeResidual?: number | null;
  severidadeResidual?: number | null;
}

async function reavaliarNaTransacao(tx: Tx, a: Ator, l: Linha, d: DadosReavaliacaoHira, hoje: string, acao: "REAVALIACAO" | "REVISAO_GERAL", obs: string | null) {
  const config = await configHira(tx, l.obraId);
  await travar(tx, l, {
    ...avaliarPS(config, d.probabilidade, d.severidade),
    ...avaliarResidual(config, d.probabilidadeResidual, d.severidadeResidual),
    ultimaReavaliacaoEm: new Date(),
    proximaReavaliacaoEm: paraDataDb(calcularProximaReavaliacao(hoje, l.periodicidadeMeses)),
  });
  await registrarHistorico(tx, a, l.id, acao, obs);
}

/** Reavaliação do item (P×S inicial e residual): histórico e nova data. Não passa por aprovação. */
export async function reavaliarHira(a: Ator, id: string, d: DadosReavaliacaoHira & { observacao?: string | null }, versao?: number) {
  await exigirModuloHira(a);
  const obs = normalizarObs(d.observacao);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  await a.db.$transaction(async (tx) => {
    const l = await carregar(tx, a, id);
    if (!podeTratarHira(a, l)) throw new ErroNegocio("Sem permissão para reavaliar esta linha.");
    if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
    await reavaliarNaTransacao(tx, a, l, d, hoje, "REAVALIACAO", obs);
  });
}

/**
 * Revisão geral da planilha de uma obra: todas as linhas vigentes numa transação. Linhas sem
 * avaliação enviada mantêm P×S (confirmadas), mas ganham histórico e nova data.
 */
export async function revisaoGeralHira(a: Ator, obraId: string, avaliacoes: ({ id: string } & DadosReavaliacaoHira)[], observacao?: string | null) {
  await exigirGestao(a);
  if (!obraNoEscopo(a, obraId)) throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
  const obs = normalizarObs(observacao) ?? "Revisão geral.";
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const porId = new Map(avaliacoes.map((x) => [x.id, x]));
  return a.db.$transaction(
    async (tx) => {
      const itens = await tx.linhaHira.findMany({ where: { obraId, status: "VIGENTE" }, orderBy: { numero: "asc" } });
      if (itens.length === 0) throw new ErroNegocio("Nenhuma linha vigente nesta obra.");
      for (const id of porId.keys()) if (!itens.some((i) => i.id === id)) throw new ErroNegocio("Avaliação enviada para linha fora do escopo da revisão.");
      for (const l of itens) {
        const d = porId.get(l.id) ?? l;
        await reavaliarNaTransacao(tx, a, l, d, hoje, "REVISAO_GERAL", obs);
      }
      return { revisados: itens.length };
    },
    { timeout: 20_000 },
  );
}

// ---------------------------------------------------------------- plano de ação

/** Gera o plano de ação (origem HIRA) e vincula à linha vigente. */
export async function gerarPlanoHira(a: Ator, id: string, d: { titulo?: string | null; itens: DadosItem[] }) {
  await exigirModuloHira(a);
  const r = await a.db.$transaction(async (tx) => {
    const l = await carregar(tx, a, id);
    if (!podeTratarHira(a, l)) throw new ErroNegocio("Sem permissão para gerar plano desta linha.");
    if (l.planoAcaoId) throw new ErroNegocio("Esta linha já tem plano de ação vinculado.");
    const plano = await criarPlanoNaTransacao(
      tx,
      a,
      {
        titulo: (d.titulo?.trim() || `Controle ${codigoHira(l)} — ${l.perigo}`).slice(0, 200),
        descricao: `Plano de ação da linha HIRA ${codigoHira(l)} (${l.atividade}).`,
        obraId: l.obraId,
        itens: d.itens,
      },
      { tipo: "HIRA", id: l.id },
    );
    await travar(tx, l, { planoAcaoId: plano.id });
    await registrarHistorico(tx, a, l.id, "PLANO", `Plano de ação gerado: ${plano.itemIds.length} ação(ões).`);
    return plano;
  });
  await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { id: r.id };
}

/** Para as telas: a empresa exige aprovação? Com quais aprovadores (nomes, sem o próprio ator)? */
export async function infoAprovacaoHira(a: Ator): Promise<{ aprovadores: string[] } | null> {
  const c = await obterConfigAprovacao(a.db, a.empresaId, "hira");
  if (!c.exigir) return null;
  const us = await a.db.usuario.findMany({ where: { id: { in: c.aprovadorIds.filter((id) => id !== a.usuarioId) }, ativo: true }, select: { id: true, nome: true } });
  return { aprovadores: c.aprovadorIds.map((id) => us.find((u) => u.id === id)?.nome).filter((n): n is string => !!n) };
}
