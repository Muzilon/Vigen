/**
 * LAIA — Aspectos e Impactos ambientais (ISO 14001) — serviço de domínio (docs/06-desenho-modulos.md, seção 5).
 * Leitura: usuários com o módulo LAIA, restrita às obras do escopo (filtroObras; a linha sempre tem obra).
 * Inclusão/alteração/exclusão: LAIA_GERENCIAR — passam pelo fluxo de aprovação quando a empresa
 * exige (Empresa.config.aprovacao.laia, decisão 5); senão são aplicadas direto. Reavaliação e
 * plano de ação: LAIA_GERENCIAR ou o responsável da linha. Todo evento grava HistoricoLinhaLaia
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
import { pontuarLaia } from "./regras";
import {
  calcularLinhaLaia,
  CAMPOS_DIFF_LAIA,
  codigoLaia,
  diffCampos,
  type DadosLaia,
} from "./regras";

export const linkLaia = (id: string) => `/laia/${id}`;

type AcaoHistorico = "INCLUSAO" | "ALTERACAO" | "EXCLUSAO" | "REAVALIACAO" | "REVISAO_GERAL" | "PLANO" | "APROVACAO" | "REJEICAO";
type Quem = Pick<Ator, "empresaId" | "usuarioId" | "obrasPermitidas">;

// ---------------------------------------------------------------- acesso

export async function moduloLaiaAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("LAIA");
}

export async function exigirModuloLaia(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloLaiaAtivo(a))) throw new ErroNegocio("Módulo LAIA não contratado para esta empresa.");
}

export const podeGerenciarLaia = (a: Pick<Ator, "permissoes">) => atorTem(a, "LAIA_GERENCIAR");
export const podeTratarLaia = (a: Pick<Ator, "permissoes" | "usuarioId">, l: { responsavelId: string | null }) =>
  atorTem(a, "LAIA_GERENCIAR") || l.responsavelId === a.usuarioId;

async function exigirGestao(a: Ator) {
  await exigirModuloLaia(a);
  if (!podeGerenciarLaia(a)) throw new ErroNegocio("Sem permissão para gerenciar o LAIA (LAIA_GERENCIAR).");
}

// ---------------------------------------------------------------- escala

type DbLeitura = Pick<Ator["db"], "configuracaoEscala"> | Tx;

async function registrosEscala(db: DbLeitura): Promise<ConfiguracaoEscalaRegistro[]> {
  return db.configuracaoEscala.findMany({
    where: { tipo: "ASPECTO_IMPACTO" },
    select: { tipo: true, obraId: true, tamanho: true, eixos: true, faixas: true, criteriosExtras: true },
  });
}

/** Escala ASPECTO_IMPACTO resolvida (obra → empresa → padrão do sistema). */
export async function configLaia(db: DbLeitura, obraId: string | null): Promise<ConfigEscala> {
  return resolverConfiguracaoEscala(await registrosEscala(db), "ASPECTO_IMPACTO", obraId);
}

/** Escalas por obra ("" = padrão da empresa) — para o cálculo ao vivo no formulário. */
export async function mapaEscalasLaia(a: Pick<Ator, "db">, obraIds: readonly string[]): Promise<Record<string, ConfigEscala>> {
  const regs = await registrosEscala(a.db);
  const out: Record<string, ConfigEscala> = { "": resolverConfiguracaoEscala(regs, "ASPECTO_IMPACTO", null) };
  for (const id of obraIds) out[id] = resolverConfiguracaoEscala(regs, "ASPECTO_IMPACTO", id);
  return out;
}

/** Dados auxiliares das telas: obras acessíveis, processos, usuários e escalas. */
export async function opcoesLaia(a: Ator) {
  const [processos, obras, usuarios] = await Promise.all([
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.obraUnidade.findMany({
      where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { processos, obras, usuarios, escalas: await mapaEscalasLaia(a, obras.map((o) => o.id)) };
}

// ---------------------------------------------------------------- leitura

export interface FiltrosLaia {
  obra?: string;
  /** Somente significativos. */
  significativos?: boolean;
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
} satisfies Prisma.LinhaLaiaInclude;

export async function listarLaia(a: Ator, f: FiltrosLaia = {}) {
  await exigirModuloLaia(a);
  return a.db.linhaLaia.findMany({
    where: {
      AND: [
        filtroObras(a),
        f.obra ? { obraId: f.obra } : {},
        f.significativos ? { significativo: true } : {},
        f.processo === "sem" ? { processoId: null } : f.processo ? { processoId: f.processo } : {},
        f.faixa ? { faixa: f.faixa } : {},
        f.status ? { status: f.status } : f.todas ? {} : { status: { in: ["VIGENTE", "PENDENTE_APROVACAO"] } },
      ],
    },
    include: incluirLista,
    orderBy: [{ obra: { nome: "asc" } }, { numero: "asc" }],
  });
}
export type LinhaLaiaListada = Awaited<ReturnType<typeof listarLaia>>[number];

export async function obterLaia(a: Ator, id: string) {
  await exigirModuloLaia(a);
  return a.db.linhaLaia.findFirst({
    where: { AND: [{ id }, filtroObras(a)] },
    include: {
      ...incluirLista,
      criadoPor: { select: { nome: true } },
      planoAcao: {
        select: {
          id: true,
          titulo: true,
          itens: { orderBy: { ordem: "asc" }, select: { id: true, oQue: true, status: true, quando: true, dataConclusao: true, semEvidencia: true, quem: { select: { nome: true } } } },
        },
      },
    },
  });
}

export async function listarHistoricoLaia(a: Ator, linhaId: string) {
  await exigirModuloLaia(a);
  const l = await a.db.linhaLaia.findFirst({ where: { AND: [{ id: linhaId }, filtroObras(a)] }, select: { id: true } });
  if (!l) return [];
  return a.db.historicoLinhaLaia.findMany({ where: { linhaId }, include: { usuario: { select: { nome: true } } }, orderBy: { criadoEm: "desc" } });
}

/** Fluxos pendentes das linhas LAIA (entidadeId → tipo de alteração) — badges da planilha. */
export async function pendenciasLaia(a: Ator) {
  const fs = await a.db.fluxoAprovacao.findMany({ where: { entidadeTipo: "LAIA", status: "PENDENTE" }, select: { id: true, entidadeId: true, tipoAlteracao: true } });
  return new Map(fs.map((f) => [f.entidadeId, f]));
}

/** Contagem por faixa das linhas vigentes + pendentes de aprovação (dashboard). null sem o módulo. */
export async function resumoLaia(a: Ator) {
  if (!(await moduloLaiaAtivo(a))) return null;
  const g = await a.db.linhaLaia.groupBy({ by: ["faixa"], where: { AND: [{ status: "VIGENTE" }, filtroObras(a)] }, _count: { _all: true } });
  const porFaixa: Record<FaixaNivel, number> = { BAIXO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 };
  for (const x of g) porFaixa[x.faixa] = x._count._all;
  const pendentes = await a.db.fluxoAprovacao.count({ where: { entidadeTipo: "LAIA", status: "PENDENTE" } });
  const significativos = await a.db.linhaLaia.count({ where: { AND: [{ status: "VIGENTE", significativo: true }, filtroObras(a)] } });
  return { porFaixa, pendentes, significativos };
}

/** Linhas LAIA ligadas a um processo (detalhe do processo). null sem o módulo. */
export async function listarLaiaDoProcesso(a: Ator, processoId: string) {
  if (!(await moduloLaiaAtivo(a))) return null;
  return a.db.linhaLaia.findMany({
    where: { AND: [{ processoId, status: { in: ["VIGENTE", "PENDENTE_APROVACAO"] } }, filtroObras(a)] },
    select: { id: true, numero: true, atividade: true, aspecto: true, impacto: true, faixa: true, score: true, significativo: true, status: true, obra: { select: { nome: true } } },
    orderBy: [{ score: "desc" }, { numero: "asc" }],
  });
}

// ---------------------------------------------------------------- utilitários de escrita

function ehUnicoViolado(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function validarReferencias(tx: Tx, a: Pick<Ator, "obrasPermitidas">, d: { processoId: string | null; obraId: string; responsavelId: string | null }) {
  if (!obraNoEscopo(a, d.obraId) || (await tx.obraUnidade.count({ where: { id: d.obraId, ativo: true } })) === 0) {
    throw new ErroNegocio("Unidade inválida ou sem acesso.");
  }
  if (d.processoId && (await tx.processo.count({ where: { id: d.processoId, ativo: true } })) === 0) throw new ErroNegocio("Processo inválido.");
  if (d.responsavelId && (await tx.usuario.count({ where: { id: d.responsavelId, ativo: true } })) === 0) throw new ErroNegocio("Responsável inválido.");
}

async function carregar(tx: Tx, a: Pick<Ator, "obrasPermitidas">, id: string, status: StatusLinhaSgi | null = "VIGENTE") {
  const l = await tx.linhaLaia.findFirst({ where: { AND: [{ id }, filtroObras(a), status ? { status } : {}] } });
  if (!l) throw new ErroNegocio(status === "VIGENTE" ? "Linha LAIA não encontrada ou não vigente." : "Linha LAIA não encontrada.");
  return l;
}
type Linha = Awaited<ReturnType<typeof carregar>>;

async function travar(tx: Tx, l: { id: string; versao: number }, data: Prisma.LinhaLaiaUncheckedUpdateManyInput) {
  const r = await tx.linhaLaia.updateMany({ where: { id: l.id, versao: l.versao }, data: { ...data, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
}

/** Snapshot dos dados da linha (JSON serializável) para o histórico e o payload "antes". */
export function snapshotLaia(l: Linha) {
  return {
    codigo: codigoLaia(l),
    obraId: l.obraId,
    processoId: l.processoId,
    atividade: l.atividade,
    aspecto: l.aspecto,
    impacto: l.impacto,
    situacao: l.situacao,
    temporalidade: l.temporalidade,
    incidencia: l.incidencia,
    severidade: l.severidade,
    frequencia: l.frequencia,
    abrangencia: l.abrangencia,
    partesInteressadas: l.partesInteressadas,
    score: l.score,
    faixa: l.faixa,
    significativo: l.significativo,
    controles: l.controles,
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
  const l = await tx.linhaLaia.findFirstOrThrow({ where: { id: linhaId } });
  await tx.historicoLinhaLaia.create({
    data: {
      empresaId: q.empresaId,
      linhaId,
      acao,
      versao: l.versao,
      dados: snapshotLaia(l) as Prisma.InputJsonValue,
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
async function calcular(tx: Tx, a: Pick<Ator, "obrasPermitidas">, d: DadosLaia) {
  const semCalculo = calcularLinhaLaia(await configLaia(tx, d.obraId || null), d);
  await validarReferencias(tx, a, semCalculo);
  return semCalculo;
}

/** Decide se a operação passa por aprovação (config da empresa) e com quais aprovadores. */
async function politicaAprovacao(tx: Tx, a: Quem) {
  const c = await obterConfigAprovacao(tx, a.empresaId, "laia");
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
export async function incluirLaia(a: Ator, d: DadosLaia): Promise<ResultadoOperacao> {
  await exigirGestao(a);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const exec = () =>
    a.db.$transaction(async (tx) => {
      const dados = await calcular(tx, a, d);
      const politica = await politicaAprovacao(tx, a);
      const max = await tx.linhaLaia.aggregate({ _max: { numero: true } });
      const l = await tx.linhaLaia.create({
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
            entidadeTipo: "LAIA",
            entidadeId: l.id,
            tipoAlteracao: "INCLUSAO",
            ...politica,
            payload: { linhaId: l.id, versao: l.versao, dados: { ...d } as unknown as Prisma.InputJsonValue, depois: snapshotLaia(l) } as Prisma.InputJsonValue,
            resumo: `Inclusão LAIA ${codigoLaia(l)} — ${dados.atividade}`.slice(0, 300),
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

export interface ResultadoClonagemLaia {
  total: number;
  criadas: number;
  erros: { atividade: string; mensagem: string }[];
}

/**
 * Clona todas as linhas LAIA vigentes de uma obra/unidade para outra (docs/ideias-implantadas/
 * 01-riscos-hira-laia.md, item 4 — "Clone Inteligente", mesmo padrão do HIRA). Reaproveita
 * `incluirLaia` linha a linha; cada cópia nasce sujeita à mesma política de aprovação já
 * configurada para LAIA. O responsável não é copiado.
 */
export async function clonarLaiaParaObra(a: Ator, origemObraId: string, destinoObraId: string): Promise<ResultadoClonagemLaia> {
  await exigirGestao(a);
  if (origemObraId === destinoObraId) throw new ErroNegocio("Escolha uma unidade de destino diferente da origem.");
  if (!obraNoEscopo(a, origemObraId) || !obraNoEscopo(a, destinoObraId)) throw new ErroNegocio("Unidade inválida ou sem acesso.");
  const linhas = await a.db.linhaLaia.findMany({ where: { empresaId: a.empresaId, obraId: origemObraId, status: "VIGENTE" } });
  const erros: ResultadoClonagemLaia["erros"] = [];
  let criadas = 0;
  for (const l of linhas) {
    const dados: DadosLaia = {
      obraId: destinoObraId,
      processoId: l.processoId,
      atividade: l.atividade,
      aspecto: l.aspecto,
      impacto: l.impacto,
      situacao: l.situacao,
      temporalidade: l.temporalidade,
      incidencia: l.incidencia,
      severidade: l.severidade,
      frequencia: l.frequencia,
      abrangencia: l.abrangencia,
      requisitoLegal: l.requisitoLegal,
      partesInteressadas: l.partesInteressadas,
      controles: l.controles,
      responsavelId: null,
      modoReavaliacao: l.modoReavaliacao,
      periodicidadeMeses: l.periodicidadeMeses,
    };
    try {
      await incluirLaia(a, dados);
      criadas++;
    } catch (e) {
      erros.push({ atividade: l.atividade, mensagem: e instanceof ErroNegocio ? e.message : "Falha ao clonar." });
    }
  }
  return { total: linhas.length, criadas, erros };
}

/** Aplica a alteração na transação (edição direta ou handler de aprovação). `versao` = trava otimista. */
export async function aplicarAlteracaoLaia(tx: Tx, q: Quem, id: string, d: DadosLaia, versao?: number, observacao?: string | null) {
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
export async function alterarLaia(a: Ator, id: string, d: DadosLaia, versao?: number, motivo?: string | null): Promise<ResultadoOperacao> {
  await exigirGestao(a);
  const obs = normalizarObs(motivo);
  const r = await a.db.$transaction(async (tx) => {
    const politica = await politicaAprovacao(tx, a);
    if (!politica) {
      await aplicarAlteracaoLaia(tx, a, id, d, versao, obs);
      return { id, aplicado: true, fluxoId: null };
    }
    const l = await carregar(tx, a, id);
    if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
    const dados = await calcular(tx, a, d);
    const { antes, depois } = diffCampos(snapshotLaia(l) as Record<string, unknown>, { ...snapshotLaia(l), ...dados } as Record<string, unknown>, CAMPOS_DIFF_LAIA);
    if (Object.keys(depois).length === 0 && dados.obraId === l.obraId && dados.processoId === l.processoId && dados.responsavelId === l.responsavelId
      && dados.modoReavaliacao === l.modoReavaliacao && dados.periodicidadeMeses === l.periodicidadeMeses) {
      throw new ErroNegocio("Nenhuma alteração em relação à versão vigente.");
    }
    const f = await criarFluxoNaTransacao(tx, a, {
      entidadeTipo: "LAIA",
      entidadeId: l.id,
      tipoAlteracao: "ALTERACAO",
      ...politica,
      payload: { linhaId: l.id, versao: l.versao, antes, depois, dados: { ...d } as unknown as Prisma.InputJsonValue, motivo: obs } as Prisma.InputJsonValue,
      resumo: `Alteração LAIA ${codigoLaia(l)} — ${dados.atividade}`.slice(0, 300),
    });
    return { id, aplicado: false, fluxoId: f.id };
  });
  if (r.fluxoId) await notificarFluxoCriado(a, r.fluxoId);
  return r;
}

/** Exclusão = inativação (histórico preservado). */
export async function aplicarExclusaoLaia(tx: Tx, q: Quem, id: string, versao?: number, observacao?: string | null) {
  const l = await carregar(tx, q, id);
  if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
  await travar(tx, l, { status: "INATIVA" });
  await registrarHistorico(tx, q, id, "EXCLUSAO", observacao);
}

export async function excluirLaia(a: Ator, id: string, motivo?: string | null, versao?: number): Promise<ResultadoOperacao> {
  await exigirGestao(a);
  const obs = normalizarObs(motivo);
  const r = await a.db.$transaction(async (tx) => {
    const politica = await politicaAprovacao(tx, a);
    if (!politica) {
      await aplicarExclusaoLaia(tx, a, id, versao, obs);
      return { id, aplicado: true, fluxoId: null };
    }
    const l = await carregar(tx, a, id);
    if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
    const f = await criarFluxoNaTransacao(tx, a, {
      entidadeTipo: "LAIA",
      entidadeId: l.id,
      tipoAlteracao: "EXCLUSAO",
      ...politica,
      payload: { linhaId: l.id, versao: l.versao, antes: { status: l.status }, depois: { status: "INATIVA" }, motivo: obs } as Prisma.InputJsonValue,
      resumo: `Exclusão LAIA ${codigoLaia(l)} — ${l.atividade}`.slice(0, 300),
    });
    return { id, aplicado: false, fluxoId: f.id };
  });
  if (r.fluxoId) await notificarFluxoCriado(a, r.fluxoId);
  return r;
}

/** Handler: INCLUSAO aprovada → recalcula pelos dados do payload e torna a linha VIGENTE. */
export async function aprovarInclusaoLaia(tx: Tx, q: Quem, id: string, d: DadosLaia, versao: number | undefined, observacao: string) {
  const l = await carregar(tx, q, id, "PENDENTE_APROVACAO");
  if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
  const dados = await calcular(tx, q, d);
  await travar(tx, l, { ...dados, status: "VIGENTE" });
  await registrarHistorico(tx, q, id, "APROVACAO", observacao);
}

/** Handler: rejeição/cancelamento. INCLUSAO → linha REJEITADA; demais → só histórico. */
export async function registrarRejeicaoLaia(tx: Tx, q: Quem, id: string, inclusao: boolean, observacao: string) {
  const l = await tx.linhaLaia.findFirst({ where: { id } });
  if (!l) return;
  if (inclusao && l.status === "PENDENTE_APROVACAO") await travar(tx, l, { status: "REJEITADA" });
  await registrarHistorico(tx, q, id, "REJEICAO", observacao);
}

// ---------------------------------------------------------------- reavaliação

export interface DadosReavaliacaoLaia {
  severidade: number;
  frequencia: number;
  abrangencia: number;
}

async function reavaliarNaTransacao(tx: Tx, a: Ator, l: Linha, d: DadosReavaliacaoLaia, hoje: string, acao: "REAVALIACAO" | "REVISAO_GERAL", obs: string | null) {
  const config = await configLaia(tx, l.obraId);
  await travar(tx, l, {
    severidade: d.severidade,
    frequencia: d.frequencia,
    abrangencia: d.abrangencia,
    ...(({ score, faixa, significativo }) => ({ score, faixa, significativo }))(pontuarLaia(config, { ...d, requisitoLegal: l.requisitoLegal, partesInteressadas: l.partesInteressadas })),
    ultimaReavaliacaoEm: new Date(),
    proximaReavaliacaoEm: paraDataDb(calcularProximaReavaliacao(hoje, l.periodicidadeMeses)),
  });
  await registrarHistorico(tx, a, l.id, acao, obs);
}

/** Reavaliação do item (severidade, frequência, abrangência): histórico e nova data. Não passa por aprovação. */
export async function reavaliarLaia(a: Ator, id: string, d: DadosReavaliacaoLaia & { observacao?: string | null }, versao?: number) {
  await exigirModuloLaia(a);
  const obs = normalizarObs(d.observacao);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  await a.db.$transaction(async (tx) => {
    const l = await carregar(tx, a, id);
    if (!podeTratarLaia(a, l)) throw new ErroNegocio("Sem permissão para reavaliar esta linha.");
    if (versao !== undefined && versao !== l.versao) throw new ErroConflito();
    await reavaliarNaTransacao(tx, a, l, d, hoje, "REAVALIACAO", obs);
  });
}

/**
 * Revisão geral da planilha de uma obra: todas as linhas vigentes numa transação. Linhas sem
 * avaliação enviada mantêm a avaliação (confirmadas), mas ganham histórico e nova data.
 */
export async function revisaoGeralLaia(a: Ator, obraId: string, avaliacoes: ({ id: string } & DadosReavaliacaoLaia)[], observacao?: string | null) {
  await exigirGestao(a);
  if (!obraNoEscopo(a, obraId)) throw new ErroNegocio("Unidade inválida ou sem acesso.");
  const obs = normalizarObs(observacao) ?? "Revisão geral.";
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const porId = new Map(avaliacoes.map((x) => [x.id, x]));
  return a.db.$transaction(
    async (tx) => {
      const itens = await tx.linhaLaia.findMany({ where: { obraId, status: "VIGENTE" }, orderBy: { numero: "asc" } });
      if (itens.length === 0) throw new ErroNegocio("Nenhuma linha vigente nesta unidade.");
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

/** Gera o plano de ação (origem LAIA) e vincula à linha vigente. */
export async function gerarPlanoLaia(a: Ator, id: string, d: { titulo?: string | null; itens: DadosItem[] }) {
  await exigirModuloLaia(a);
  const r = await a.db.$transaction(async (tx) => {
    const l = await carregar(tx, a, id);
    if (!podeTratarLaia(a, l)) throw new ErroNegocio("Sem permissão para gerar plano desta linha.");
    if (l.planoAcaoId) throw new ErroNegocio("Esta linha já tem plano de ação vinculado.");
    const plano = await criarPlanoNaTransacao(
      tx,
      a,
      {
        titulo: (d.titulo?.trim() || `Controle ${codigoLaia(l)} — ${l.aspecto}`).slice(0, 200),
        descricao: `Plano de ação da linha LAIA ${codigoLaia(l)} (${l.atividade}).`,
        obraId: l.obraId,
        itens: d.itens,
      },
      { tipo: "LAIA", id: l.id },
    );
    await travar(tx, l, { planoAcaoId: plano.id });
    await registrarHistorico(tx, a, l.id, "PLANO", `Plano de ação gerado: ${plano.itemIds.length} ação(ões).`);
    return plano;
  });
  await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { id: r.id };
}

/** Para as telas: a empresa exige aprovação? Com quais aprovadores (nomes, sem o próprio ator)? */
export async function infoAprovacaoLaia(a: Ator): Promise<{ aprovadores: string[] } | null> {
  const c = await obterConfigAprovacao(a.db, a.empresaId, "laia");
  if (!c.exigir) return null;
  const us = await a.db.usuario.findMany({ where: { id: { in: c.aprovadorIds.filter((id) => id !== a.usuarioId) }, ativo: true }, select: { id: true, nome: true } });
  return { aprovadores: c.aprovadorIds.map((id) => us.find((u) => u.id === id)?.nome).filter((n): n is string => !!n) };
}
