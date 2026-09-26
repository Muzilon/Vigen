/**
 * Riscos e Oportunidades (ISO 9001 6.1) — serviço de domínio (docs/06-desenho-modulos.md, seção 2).
 * Leitura: usuários da empresa com o módulo RISCOS_OPORTUNIDADES (respeitando o escopo de obras).
 * Cadastro/edição/exclusão/revisão geral: RISCO_GERENCIAR. Tratamento, plano de ação, status e
 * reavaliação do item: RISCO_TRATAR, RISCO_GERENCIAR ou o responsável do registro.
 * Toda mudança de avaliação/tratamento/status grava HistoricoRiscoOportunidade (append-only).
 */
import { Prisma, type FaixaNivel, type ModoAprovacao, type StatusRiscoOportunidade, type TratamentoRisco } from "@prisma/client";
import { atorTem, fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { solicitarAprovacao } from "@/lib/aprovacao/servico";
import { hojeNoFuso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { resolverConfiguracaoEscala } from "@/lib/escala/resolver";
import type { ConfigEscala, ConfiguracaoEscalaRegistro } from "@/lib/escala/tipos";
import { notificarItensAtribuidos } from "@/lib/notificacoes/gatilhos";
import { criarPlanoNaTransacao, type DadosItem } from "@/lib/plano-acao/servico";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";
import {
  avaliar,
  codigoRisco,
  exigirPlanoSeNecessario,
  MAX_TEXTO,
  normalizarRisco,
  ROTULO_TIPO_RISCO,
  STATUS_RISCO,
  TRATAMENTOS,
  validarTratamento,
  type Avaliacao,
  type DadosRisco,
} from "./regras";

export const linkRisco = (id: string) => `/riscos/${id}`;

type AcaoHistorico = "CRIACAO" | "ALTERACAO" | "TRATAMENTO" | "REAVALIACAO" | "REVISAO_GERAL" | "STATUS" | "EXCLUSAO";

// ---------------------------------------------------------------- acesso

export async function moduloRiscosAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("RISCOS_OPORTUNIDADES");
}

export async function exigirModuloRiscos(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloRiscosAtivo(a))) throw new ErroNegocio("Módulo Riscos e Oportunidades não contratado para esta empresa.");
}

export const podeGerenciarRiscos = (a: Pick<Ator, "permissoes">) => atorTem(a, "RISCO_GERENCIAR");

export const podeTratarRisco = (a: Pick<Ator, "permissoes" | "usuarioId">, r: { responsavelId: string | null }) =>
  atorTem(a, "RISCO_GERENCIAR") || atorTem(a, "RISCO_TRATAR") || r.responsavelId === a.usuarioId;

async function exigirGestao(a: Ator) {
  await exigirModuloRiscos(a);
  if (!podeGerenciarRiscos(a)) throw new ErroNegocio("Sem permissão para gerenciar riscos e oportunidades (RISCO_GERENCIAR).");
}

/** Escopo de obras: registros sem obra são da empresa toda. */
export function filtroObraRisco(a: Pick<Ator, "obrasPermitidas">): Prisma.RiscoOportunidadeWhereInput {
  if (a.obrasPermitidas === null) return {};
  return { OR: [{ obraId: null }, { obraId: { in: [...a.obrasPermitidas] } }] };
}

// ---------------------------------------------------------------- escala

type DbLeitura = Pick<Ator["db"], "configuracaoEscala"> | Tx;

async function registrosEscala(db: DbLeitura): Promise<ConfiguracaoEscalaRegistro[]> {
  return db.configuracaoEscala.findMany({
    where: { tipo: "RISCO_OPORTUNIDADE" },
    select: { tipo: true, obraId: true, tamanho: true, eixos: true, faixas: true, criteriosExtras: true },
  });
}

/** Escala de riscos resolvida (obra → empresa → padrão do sistema). */
export async function configRisco(db: DbLeitura, obraId: string | null): Promise<ConfigEscala> {
  return resolverConfiguracaoEscala(await registrosEscala(db), "RISCO_OPORTUNIDADE", obraId);
}

/** Escalas por obra ("" = padrão da empresa) — para o cálculo ao vivo no formulário. */
export async function mapaEscalas(a: Pick<Ator, "db">, obraIds: readonly string[]): Promise<Record<string, ConfigEscala>> {
  const regs = await registrosEscala(a.db);
  const out: Record<string, ConfigEscala> = { "": resolverConfiguracaoEscala(regs, "RISCO_OPORTUNIDADE", null) };
  for (const id of obraIds) out[id] = resolverConfiguracaoEscala(regs, "RISCO_OPORTUNIDADE", id);
  return out;
}

/** Dados auxiliares das telas: processos ativos, obras acessíveis e usuários ativos. */
export async function opcoesFormulario(a: Ator) {
  const [processos, obras, usuarios] = await Promise.all([
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.obraUnidade.findMany({
      where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { processos, obras, usuarios, escalas: await mapaEscalas(a, obras.map((o) => o.id)) };
}

// ---------------------------------------------------------------- leitura

export interface FiltrosRisco {
  /** uuid do processo, ou "sem" (sem processo). */
  processo?: string;
  tipo?: "RISCO" | "OPORTUNIDADE";
  faixa?: FaixaNivel;
  status?: StatusRiscoOportunidade;
  obra?: string;
  /** Inclui os encerrados (padrão: não). */
  encerrados?: boolean;
}

export async function listarRiscos(a: Ator, f: FiltrosRisco = {}) {
  await exigirModuloRiscos(a);
  const where: Prisma.RiscoOportunidadeWhereInput = {
    AND: [
      { ativo: true },
      filtroObraRisco(a),
      f.processo === "sem" ? { processoId: null } : f.processo ? { processoId: f.processo } : {},
      f.tipo ? { tipo: f.tipo } : {},
      f.faixa ? { faixa: f.faixa } : {},
      f.status ? { status: f.status } : f.encerrados ? {} : { status: { not: "ENCERRADO" } },
      f.obra ? { obraId: f.obra } : {},
    ],
  };
  return a.db.riscoOportunidade.findMany({
    where,
    include: {
      processo: { select: { id: true, codigo: true, nome: true } },
      obra: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
    },
    orderBy: [{ score: "desc" }, { numero: "asc" }],
  });
}
export type RiscoListado = Awaited<ReturnType<typeof listarRiscos>>[number];

export async function obterRisco(a: Ator, id: string) {
  await exigirModuloRiscos(a);
  return a.db.riscoOportunidade.findFirst({
    where: { AND: [{ id, ativo: true }, filtroObraRisco(a)] },
    include: {
      processo: { select: { id: true, codigo: true, nome: true } },
      obra: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      planoAcao: {
        select: {
          id: true,
          titulo: true,
          itens: { orderBy: { ordem: "asc" }, select: { id: true, oQue: true, status: true, quando: true, quem: { select: { nome: true } } } },
        },
      },
      itensSwot: { select: { id: true, quadrante: true, descricao: true, ciclo: { select: { id: true, ano: true } } } },
    },
  });
}

export async function listarHistorico(a: Ator, riscoId: string) {
  await exigirModuloRiscos(a);
  const r = await a.db.riscoOportunidade.findFirst({ where: { AND: [{ id: riscoId }, filtroObraRisco(a)] }, select: { id: true } });
  if (!r) return [];
  return a.db.historicoRiscoOportunidade.findMany({
    where: { riscoId },
    include: { usuario: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
  });
}

/** Contagem de riscos/oportunidades abertos por faixa (dashboard). */
export async function contarPorFaixa(a: Ator) {
  if (!(await moduloRiscosAtivo(a))) return null;
  const g = await a.db.riscoOportunidade.groupBy({
    by: ["faixa"],
    where: { AND: [{ ativo: true, status: { not: "ENCERRADO" } }, filtroObraRisco(a)] },
    _count: { _all: true },
  });
  const out: Record<FaixaNivel, number> = { BAIXO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0 };
  for (const x of g) out[x.faixa] = x._count._all;
  return out;
}

/** Riscos ligados a um processo (detalhe do processo). */
export async function listarRiscosDoProcesso(a: Ator, processoId: string) {
  if (!(await moduloRiscosAtivo(a))) return null;
  return a.db.riscoOportunidade.findMany({
    where: { AND: [{ processoId, ativo: true }, filtroObraRisco(a)] },
    select: { id: true, numero: true, tipo: true, descricao: true, faixa: true, score: true, status: true },
    orderBy: [{ score: "desc" }, { numero: "asc" }],
  });
}

// ---------------------------------------------------------------- utilitários de escrita

function ehUnicoViolado(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function validarReferencias(tx: Tx, a: Pick<Ator, "obrasPermitidas">, d: { processoId: string | null; obraId: string | null; responsavelId: string | null }) {
  if (d.processoId && (await tx.processo.count({ where: { id: d.processoId, ativo: true } })) === 0) throw new ErroNegocio("Processo inválido.");
  if (d.obraId) {
    if (a.obrasPermitidas !== null && !a.obrasPermitidas.includes(d.obraId)) throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
    if ((await tx.obraUnidade.count({ where: { id: d.obraId, ativo: true } })) === 0) throw new ErroNegocio("Obra/unidade inválida ou sem acesso.");
  }
  if (d.responsavelId && (await tx.usuario.count({ where: { id: d.responsavelId, ativo: true } })) === 0) throw new ErroNegocio("Responsável inválido.");
}

async function carregar(tx: Tx, a: Pick<Ator, "obrasPermitidas">, id: string) {
  const r = await tx.riscoOportunidade.findFirst({ where: { AND: [{ id, ativo: true }, filtroObraRisco(a)] } });
  if (!r) throw new ErroNegocio("Risco/oportunidade não encontrado.");
  return r;
}
type Registro = Awaited<ReturnType<typeof carregar>>;

/** Trava otimista (versão lida); incrementa. */
async function travar(tx: Tx, r: { id: string; versao: number }, data: Prisma.RiscoOportunidadeUncheckedUpdateManyInput) {
  const res = await tx.riscoOportunidade.updateMany({ where: { id: r.id, versao: r.versao }, data: { ...data, versao: { increment: 1 } } });
  if (res.count === 0) throw new ErroConflito();
}

async function registrarHistorico(tx: Tx, empresaId: string, usuarioId: string, riscoId: string, acao: AcaoHistorico, observacao?: string | null) {
  const r = await tx.riscoOportunidade.findFirstOrThrow({ where: { id: riscoId } });
  await tx.historicoRiscoOportunidade.create({
    data: {
      empresaId,
      riscoId,
      acao,
      probabilidade: r.probabilidade,
      impacto: r.impacto,
      score: r.score,
      faixa: r.faixa,
      probabilidadeResidual: r.probabilidadeResidual,
      impactoResidual: r.impactoResidual,
      scoreResidual: r.scoreResidual,
      faixaResidual: r.faixaResidual,
      tratamento: r.tratamento,
      status: r.status,
      observacao: observacao?.trim().slice(0, 1000) || null,
      usuarioId,
    },
  });
}

function residualDe(config: ConfigEscala, p?: number | null, i?: number | null) {
  if (p == null && i == null) return { probabilidadeResidual: null, impactoResidual: null, scoreResidual: null, faixaResidual: null };
  if (p == null || i == null) throw new ErroNegocio("Informe probabilidade e impacto residuais (ou nenhum dos dois).");
  const r = avaliar(config, p, i);
  return { probabilidadeResidual: r.probabilidade, impactoResidual: r.impacto, scoreResidual: r.score, faixaResidual: r.faixa };
}

function normalizarObs(o?: string | null) {
  const t = o?.trim() || null;
  if (t && t.length > 1000) throw new ErroNegocio("Observação com no máximo 1000 caracteres.");
  return t;
}

/** Primeira ação do plano (quando o tratamento exige plano e ele é criado junto). */
export interface PrimeiraAcao {
  oQue: string;
  quemId: string;
  /** YYYY-MM-DD */
  quando: string;
}

async function criarPlanoDoRisco(tx: Tx, a: Ator, r: Registro, titulo: string | null, itens: DadosItem[]) {
  const plano = await criarPlanoNaTransacao(
    tx,
    a,
    { titulo: (titulo?.trim() || `Tratamento ${codigoRisco(r)} — ${r.descricao}`).slice(0, 200), descricao: `Plano de ação do ${ROTULO_TIPO_RISCO[r.tipo].toLowerCase()} ${codigoRisco(r)}.`, obraId: r.obraId, itens },
    { tipo: "RISCO_OPORTUNIDADE", id: r.id },
  );
  return plano;
}

// ---------------------------------------------------------------- criar / editar

export interface DadosCriacao extends DadosRisco {
  tratamento?: TratamentoRisco | null;
  descricaoTratamento?: string | null;
  primeiraAcao?: PrimeiraAcao | null;
}

export async function criarRisco(a: Ator, d: DadosCriacao) {
  await exigirGestao(a);
  const dados = normalizarRisco(d);
  validarTratamento(dados.tipo, d.tratamento);
  const descricaoTratamento = d.descricaoTratamento?.trim().slice(0, MAX_TEXTO) || null;
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const exec = () =>
    a.db.$transaction(async (tx) => {
      await validarReferencias(tx, a, dados);
      const aval = avaliar(await configRisco(tx, dados.obraId), dados.probabilidade, dados.impacto);
      exigirPlanoSeNecessario(d.tratamento, aval.faixa, !!d.primeiraAcao);
      const max = await tx.riscoOportunidade.aggregate({ _max: { numero: true } });
      const r = await tx.riscoOportunidade.create({
        data: {
          ...dados,
          ...aval,
          empresaId: a.empresaId,
          numero: (max._max.numero ?? 0) + 1,
          tratamento: d.tratamento ?? null,
          descricaoTratamento,
          status: d.tratamento ? "EM_TRATAMENTO" : "IDENTIFICADO",
          proximaReavaliacaoEm: paraDataDb(calcularProximaReavaliacao(hoje, dados.periodicidadeMeses)),
          criadoPorId: a.usuarioId,
        },
      });
      let itemIds: string[] = [];
      if (d.primeiraAcao && d.tratamento) {
        const plano = await criarPlanoDoRisco(tx, a, r, null, [d.primeiraAcao]);
        await tx.riscoOportunidade.updateMany({ where: { id: r.id }, data: { planoAcaoId: plano.id } });
        itemIds = plano.itemIds;
      }
      await registrarHistorico(tx, a.empresaId, a.usuarioId, r.id, "CRIACAO");
      return { id: r.id, itemIds };
    });
  let res: { id: string; itemIds: string[] };
  try {
    res = await exec();
  } catch (e) {
    if (!ehUnicoViolado(e)) throw e;
    res = await exec(); // corrida no número sequencial: tenta uma vez mais
  }
  if (res.itemIds.length) await notificarItensAtribuidos(a, res.itemIds, "criado");
  return { id: res.id };
}

/**
 * Aplica a edição dos dados principais (descrição, P×I, vínculos, reavaliação) na transação.
 * Usado pela edição direta e pelo handler de aprovação (ALTERACAO). `versao` = trava otimista.
 */
export async function aplicarEdicaoNaTransacao(
  tx: Tx,
  a: Pick<Ator, "empresaId" | "usuarioId" | "obrasPermitidas">,
  id: string,
  d: DadosRisco,
  versao?: number,
  observacao?: string | null,
) {
  const dados = normalizarRisco(d);
  const r = await carregar(tx, a, id);
  if (versao !== undefined && versao !== r.versao) throw new ErroConflito();
  if (dados.tipo !== r.tipo) validarTratamento(dados.tipo, r.tratamento);
  await validarReferencias(tx, a, dados);
  const config = await configRisco(tx, dados.obraId);
  const aval = avaliar(config, dados.probabilidade, dados.impacto);
  exigirPlanoSeNecessario(r.tratamento, aval.faixa, !!r.planoAcaoId);
  const residual = r.probabilidadeResidual != null ? residualDe(config, r.probabilidadeResidual, r.impactoResidual) : {};
  let proxima = r.proximaReavaliacaoEm;
  if (dados.periodicidadeMeses !== r.periodicidadeMeses) {
    const base = r.ultimaReavaliacaoEm ?? r.criadoEm;
    proxima = paraDataDb(calcularProximaReavaliacao(base.toISOString().slice(0, 10), dados.periodicidadeMeses));
  }
  await travar(tx, r, { ...dados, ...aval, ...residual, proximaReavaliacaoEm: proxima });
  await registrarHistorico(tx, a.empresaId, a.usuarioId, id, "ALTERACAO", observacao);
}

export async function editarRisco(a: Ator, id: string, d: DadosRisco, versao?: number) {
  await exigirGestao(a);
  await a.db.$transaction((tx) => aplicarEdicaoNaTransacao(tx, a, id, d, versao));
}

/** Exclusão lógica (histórico preservado). */
export async function excluirNaTransacao(tx: Tx, a: Pick<Ator, "empresaId" | "usuarioId" | "obrasPermitidas">, id: string, observacao?: string | null) {
  const r = await carregar(tx, a, id);
  await travar(tx, r, { ativo: false });
  await tx.itemSwot.updateMany({ where: { riscoOportunidadeId: id }, data: { riscoOportunidadeId: null } });
  await registrarHistorico(tx, a.empresaId, a.usuarioId, id, "EXCLUSAO", observacao);
}

export async function excluirRisco(a: Ator, id: string) {
  await exigirGestao(a);
  await a.db.$transaction((tx) => excluirNaTransacao(tx, a, id));
}

// ---------------------------------------------------------------- tratamento / plano / status

export interface DadosTratamento {
  tratamento: TratamentoRisco;
  descricaoTratamento?: string | null;
  probabilidadeResidual?: number | null;
  impactoResidual?: number | null;
  primeiraAcao?: PrimeiraAcao | null;
}

export async function definirTratamento(a: Ator, id: string, d: DadosTratamento, versao?: number) {
  await exigirModuloRiscos(a);
  if (!TRATAMENTOS.includes(d.tratamento)) throw new ErroNegocio("Tratamento inválido.");
  const desc = d.descricaoTratamento?.trim() || null;
  if (desc && desc.length > MAX_TEXTO) throw new ErroNegocio(`Descrição do tratamento com no máximo ${MAX_TEXTO} caracteres.`);
  const itemIds = await a.db.$transaction(async (tx) => {
    const r = await carregar(tx, a, id);
    if (!podeTratarRisco(a, r)) throw new ErroNegocio("Sem permissão para tratar este registro (RISCO_TRATAR).");
    if (versao !== undefined && versao !== r.versao) throw new ErroConflito();
    validarTratamento(r.tipo, d.tratamento);
    exigirPlanoSeNecessario(d.tratamento, r.faixa, !!r.planoAcaoId || !!d.primeiraAcao);
    const residual = residualDe(await configRisco(tx, r.obraId), d.probabilidadeResidual, d.impactoResidual);
    let planoAcaoId = r.planoAcaoId;
    let ids: string[] = [];
    if (!planoAcaoId && d.primeiraAcao) {
      const plano = await criarPlanoDoRisco(tx, a, r, null, [d.primeiraAcao]);
      planoAcaoId = plano.id;
      ids = plano.itemIds;
    }
    await travar(tx, r, {
      tratamento: d.tratamento,
      descricaoTratamento: desc,
      ...residual,
      planoAcaoId,
      status: r.status === "IDENTIFICADO" ? "EM_TRATAMENTO" : r.status,
    });
    await registrarHistorico(tx, a.empresaId, a.usuarioId, id, "TRATAMENTO");
    return ids;
  });
  if (itemIds.length) await notificarItensAtribuidos(a, itemIds, "criado");
}

/** Gera o plano de ação (origem RISCO_OPORTUNIDADE) e vincula ao registro. */
export async function gerarPlanoAcao(a: Ator, id: string, d: { titulo?: string | null; itens: DadosItem[] }) {
  await exigirModuloRiscos(a);
  const r = await a.db.$transaction(async (tx) => {
    const risco = await carregar(tx, a, id);
    if (!podeTratarRisco(a, risco)) throw new ErroNegocio("Sem permissão para tratar este registro (RISCO_TRATAR).");
    if (risco.planoAcaoId) throw new ErroNegocio("Este registro já tem plano de ação vinculado.");
    const plano = await criarPlanoDoRisco(tx, a, risco, d.titulo ?? null, d.itens);
    await travar(tx, risco, { planoAcaoId: plano.id, status: risco.status === "IDENTIFICADO" ? "EM_TRATAMENTO" : risco.status });
    return plano;
  });
  await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { id: r.id };
}

export async function alterarStatus(a: Ator, id: string, status: StatusRiscoOportunidade, observacao?: string | null, versao?: number) {
  await exigirModuloRiscos(a);
  if (!STATUS_RISCO.includes(status)) throw new ErroNegocio("Status inválido.");
  const obs = normalizarObs(observacao);
  await a.db.$transaction(async (tx) => {
    const r = await carregar(tx, a, id);
    if (!podeTratarRisco(a, r)) throw new ErroNegocio("Sem permissão para tratar este registro (RISCO_TRATAR).");
    if (versao !== undefined && versao !== r.versao) throw new ErroConflito();
    if (r.status === status) return;
    if ((status === "EM_TRATAMENTO" || status === "MONITORADO") && !r.tratamento) throw new ErroNegocio("Defina o tratamento antes de mudar o status.");
    await travar(tx, r, { status });
    await registrarHistorico(tx, a.empresaId, a.usuarioId, id, "STATUS", obs);
  });
}

// ---------------------------------------------------------------- reavaliação

export interface DadosReavaliacao {
  probabilidade: number;
  impacto: number;
  probabilidadeResidual?: number | null;
  impactoResidual?: number | null;
}

async function reavaliarNaTransacao(tx: Tx, a: Ator, r: Registro, d: DadosReavaliacao, hoje: string, acao: "REAVALIACAO" | "REVISAO_GERAL", obs: string | null) {
  const config = await configRisco(tx, r.obraId);
  const aval: Avaliacao = avaliar(config, d.probabilidade, d.impacto);
  try {
    exigirPlanoSeNecessario(r.tratamento, aval.faixa, !!r.planoAcaoId);
  } catch (e) {
    if (e instanceof ErroNegocio) throw new ErroNegocio(`${codigoRisco(r)}: ${e.message}`);
    throw e;
  }
  const residual = residualDe(config, d.probabilidadeResidual, d.impactoResidual);
  await travar(tx, r, {
    ...aval,
    ...residual,
    ultimaReavaliacaoEm: new Date(),
    proximaReavaliacaoEm: paraDataDb(calcularProximaReavaliacao(hoje, r.periodicidadeMeses)),
  });
  await registrarHistorico(tx, a.empresaId, a.usuarioId, r.id, acao, obs);
}

/** Reavaliação do item: nova avaliação P×I (e residual), histórico e próxima data. */
export async function reavaliar(a: Ator, id: string, d: DadosReavaliacao & { observacao?: string | null }, versao?: number) {
  await exigirModuloRiscos(a);
  const obs = normalizarObs(d.observacao);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  await a.db.$transaction(async (tx) => {
    const r = await carregar(tx, a, id);
    if (!podeTratarRisco(a, r)) throw new ErroNegocio("Sem permissão para reavaliar este registro.");
    if (versao !== undefined && versao !== r.versao) throw new ErroConflito();
    await reavaliarNaTransacao(tx, a, r, d, hoje, "REAVALIACAO", obs);
  });
}

/**
 * Revisão geral: reavalia de uma vez todos os registros ativos (não encerrados) do escopo —
 * um processo, "sem" processo, ou a empresa inteira (`processo` omitido). Todas as avaliações
 * na mesma transação (uma falha desfaz tudo). Registros do escopo sem avaliação enviada
 * mantêm P×I atuais (confirmados), mas também ganham histórico e nova data.
 */
export async function revisaoGeral(
  a: Ator,
  escopo: { processo?: string | null },
  avaliacoes: ({ id: string } & DadosReavaliacao)[],
  observacao?: string | null,
) {
  await exigirGestao(a);
  const obs = normalizarObs(observacao) ?? "Revisão geral.";
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const porId = new Map(avaliacoes.map((x) => [x.id, x]));
  return a.db.$transaction(
    async (tx) => {
      const where: Prisma.RiscoOportunidadeWhereInput = {
        AND: [
          { ativo: true, status: { not: "ENCERRADO" } },
          filtroObraRisco(a),
          escopo.processo === "sem" ? { processoId: null } : escopo.processo ? { processoId: escopo.processo } : {},
        ],
      };
      const itens = await tx.riscoOportunidade.findMany({ where, orderBy: { numero: "asc" } });
      if (itens.length === 0) throw new ErroNegocio("Nenhum registro ativo no escopo da revisão.");
      for (const id of porId.keys()) if (!itens.some((i) => i.id === id)) throw new ErroNegocio("Avaliação enviada para registro fora do escopo da revisão.");
      for (const r of itens) {
        const d = porId.get(r.id) ?? {
          probabilidade: r.probabilidade,
          impacto: r.impacto,
          probabilidadeResidual: r.probabilidadeResidual,
          impactoResidual: r.impactoResidual,
        };
        await reavaliarNaTransacao(tx, a, r, d, hoje, "REVISAO_GERAL", obs);
      }
      return { revisados: itens.length };
    },
    { timeout: 20_000 },
  );
}

// ---------------------------------------------------------------- aprovação (opcional)

/**
 * Pede a alteração dos dados principais via motor de aprovação. Ao aprovar, o handler
 * RISCO_OPORTUNIDADE (./aprovacao.ts) aplica a edição em nome do solicitante, conferindo a
 * versão lida (se o registro mudou no meio tempo, a aprovação falha com conflito).
 */
export async function solicitarAlteracao(a: Ator, id: string, d: DadosRisco, fluxo: { aprovadorIds: string[]; modo: ModoAprovacao; resumo?: string | null }) {
  await exigirGestao(a);
  const dados = normalizarRisco(d);
  const r = await a.db.riscoOportunidade.findFirst({ where: { AND: [{ id, ativo: true }, filtroObraRisco(a)] } });
  if (!r) throw new ErroNegocio("Risco/oportunidade não encontrado.");
  avaliar(await configRisco(a.db, dados.obraId), dados.probabilidade, dados.impacto);
  await import("./aprovacao");
  return solicitarAprovacao(a, {
    entidadeTipo: "RISCO_OPORTUNIDADE",
    entidadeId: r.id,
    tipoAlteracao: "ALTERACAO",
    modo: fluxo.modo,
    aprovadorIds: fluxo.aprovadorIds,
    payload: {
      riscoId: r.id,
      versao: r.versao,
      antes: { descricao: r.descricao, probabilidade: r.probabilidade, impacto: r.impacto, causa: r.causa, consequencia: r.consequencia },
      depois: { descricao: dados.descricao, probabilidade: dados.probabilidade, impacto: dados.impacto, causa: dados.causa, consequencia: dados.consequencia },
      dados: { ...dados } as unknown as Prisma.InputJsonValue,
    } as Prisma.InputJsonValue,
    resumo: (fluxo.resumo?.trim() || `Alterar ${codigoRisco(r)} — ${dados.descricao}`).slice(0, 300),
  });
}
