/**
 * Indicadores (P7, docs/06-desenho-modulos.md) — serviço do módulo formal de indicadores.
 * Complementa o dashboard (src/lib/indicadores/servico.ts, números calculados): aqui o usuário CADASTRA indicadores
 * com meta e periodicidade e registra resultados por período. Indicadores automáticos têm o valor calculado dos dados
 * reais (automaticos.ts) e o responsável só confirma o registro.
 *
 * Trilha: ResultadoIndicador é append-only (trigger). Correção = novo lançamento do mesmo período; o mais recente vale
 * e os anteriores continuam visíveis no histórico. Por isso não há HistoricoIndicador separado — a alteração da meta
 * fica registrada porque cada resultado guarda a meta/direção vigentes no lançamento.
 */
import type { DirecaoIndicador, FonteIndicador, PeriodicidadeIndicador, Prisma } from "@prisma/client";
import { fusoDaEmpresa, type Ator } from "@/lib/ator";
import { hojeNoFuso } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { exigirModuloIndicadores, moduloIndicadoresAtivo, podeGerenciarIndicadores, podeLancarResultado } from "./acesso";
import { calcularAutomatico, DEFINICAO_AUTOMATICA, ehAutomatico } from "./automaticos";
import {
  DIRECOES,
  FONTES,
  limitesPeriodo,
  PERIODICIDADES,
  situacaoNoPeriodo,
  ultimoPeriodoFechado,
  validarPeriodoLancamento,
  vigentesPorPeriodo,
  type ResultadoLancado,
  type SituacaoIndicador,
} from "./periodos";

export * from "./acesso";

async function exigirGestao(a: Ator) {
  await exigirModuloIndicadores(a);
  if (!podeGerenciarIndicadores(a)) throw new ErroNegocio("Sem permissão para gerenciar indicadores (INDICADOR_GERENCIAR).");
}

const texto = (s: string | null | undefined, nome: string, min: number, max: number) => {
  const t = (s ?? "").trim();
  if (t.length < min) throw new ErroNegocio(`Informe ${nome}.`);
  if (t.length > max) throw new ErroNegocio(`${nome[0].toUpperCase()}${nome.slice(1)} excede ${max} caracteres.`);
  return t;
};
const opcional = (s: string | null | undefined, nome: string, max: number) => {
  const t = s?.trim() || null;
  if (t && t.length > max) throw new ErroNegocio(`${nome} excede ${max} caracteres.`);
  return t;
};
const numero = (v: number, nome: string) => {
  if (!Number.isFinite(v) || Math.abs(v) >= 1e10) throw new ErroNegocio(`${nome} inválido.`);
  return Math.round(v * 10_000) / 10_000;
};

const paraResultado = (r: { periodo: string; valor: Prisma.Decimal; meta: Prisma.Decimal; direcao: DirecaoIndicador; criadoEm: Date }): ResultadoLancado => ({
  periodo: r.periodo,
  valor: Number(r.valor),
  meta: Number(r.meta),
  direcao: r.direcao,
  criadoEm: r.criadoEm,
});

// ---------------------------------------------------------------- leitura

export async function opcoesIndicadores(a: Ator) {
  const [processos, usuarios] = await Promise.all([
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { processos, usuarios };
}

export interface FiltrosIndicador {
  /** uuid do processo, ou "sem". */
  processo?: string;
  responsavelId?: string;
  situacao?: SituacaoIndicador;
  inativos?: boolean;
}

/** Lista com a situação no último período fechado (badge) e os últimos resultados vigentes. */
export async function listarIndicadores(a: Ator, f: FiltrosIndicador = {}) {
  await exigirModuloIndicadores(a);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const lista = await a.db.indicador.findMany({
    where: {
      AND: [
        f.inativos ? {} : { ativo: true },
        f.processo === "sem" ? { processoId: null } : f.processo ? { processoId: f.processo } : {},
        f.responsavelId ? { responsavelId: f.responsavelId } : {},
      ],
    },
    include: {
      processo: { select: { id: true, codigo: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      resultados: { select: { periodo: true, valor: true, meta: true, direcao: true, criadoEm: true }, orderBy: { criadoEm: "asc" } },
    },
    orderBy: [{ nome: "asc" }],
    take: 500,
  });
  const out = lista.map((i) => {
    const referencia = ultimoPeriodoFechado(hoje, i.periodicidade);
    const resultados = i.resultados.map(paraResultado);
    const s = situacaoNoPeriodo(resultados, referencia);
    const vigentes = [...vigentesPorPeriodo(resultados).values()].sort((x, y) => x.periodo.localeCompare(y.periodo));
    return {
      ...i,
      meta: Number(i.meta),
      resultados: undefined,
      periodoReferencia: referencia,
      situacao: s.situacao,
      resultadoReferencia: s.resultado,
      ultimos: vigentes.slice(-6),
    };
  });
  return f.situacao ? out.filter((i) => i.situacao === f.situacao) : out;
}
export type IndicadorListado = Awaited<ReturnType<typeof listarIndicadores>>[number];

export async function obterIndicador(a: Ator, id: string) {
  await exigirModuloIndicadores(a);
  const i = await a.db.indicador.findFirst({
    where: { id },
    include: {
      processo: { select: { id: true, codigo: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      resultados: { include: { registradoPor: { select: { nome: true } } }, orderBy: { criadoEm: "desc" } },
    },
  });
  if (!i) return null;
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const referencia = ultimoPeriodoFechado(hoje, i.periodicidade);
  const resultados = i.resultados.map((r) => ({ ...paraResultado(r), id: r.id, automatico: r.automatico, observacao: r.observacao, registradoPor: r.registradoPor }));
  return { ...i, meta: Number(i.meta), resultados, periodoReferencia: referencia, ...situacaoNoPeriodo(resultados, referencia) };
}

/** Valor calculado agora para um período (indicador automático). null = sem dados; erro se o indicador é manual. */
export async function calcularValorIndicador(a: Ator, id: string, periodo: string) {
  await exigirModuloIndicadores(a);
  const i = await a.db.indicador.findFirst({ where: { id }, select: { fonte: true, periodicidade: true } });
  if (!i) throw new ErroNegocio("Indicador não encontrado.");
  if (!ehAutomatico(i.fonte)) throw new ErroNegocio("Este indicador é manual: o valor é lançado pelo responsável.");
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  validarPeriodoLancamento(periodo, i.periodicidade, hoje);
  return calcularAutomatico(a, i.fonte, limitesPeriodo(periodo, i.periodicidade), hoje, fuso);
}

/** Indicadores de um processo (detalhe do processo). null sem o módulo. */
export async function listarIndicadoresDoProcesso(a: Ator, processoId: string) {
  if (!(await moduloIndicadoresAtivo(a))) return null;
  return listarIndicadores(a, { processo: processoId });
}

/** Dashboard: situação dos indicadores ativos no último período fechado. null sem o módulo. */
export async function resumoIndicadores(a: Ator) {
  if (!(await moduloIndicadoresAtivo(a))) return null;
  const lista = await listarIndicadores(a);
  const conta = (s: SituacaoIndicador) => lista.filter((i) => i.situacao === s).length;
  const atingidos = conta("ATINGIDO");
  const naoAtingidos = conta("NAO_ATINGIDO");
  return {
    total: lista.length,
    atingidos,
    naoAtingidos,
    semLancamento: conta("SEM_LANCAMENTO"),
    percentualAtingidos: atingidos + naoAtingidos === 0 ? null : Math.round((atingidos / (atingidos + naoAtingidos)) * 100),
    meus: lista.filter((i) => i.responsavelId === a.usuarioId && i.situacao === "SEM_LANCAMENTO").length,
  };
}

// ---------------------------------------------------------------- escrita

export interface DadosIndicador {
  nome: string;
  descricao?: string | null;
  processoId?: string | null;
  unidade: string;
  direcao: DirecaoIndicador;
  meta: number;
  periodicidade: PeriodicidadeIndicador;
  fonte?: FonteIndicador | null;
  formula?: string | null;
  responsavelId?: string | null;
}

async function dadosIndicador(a: Ator, d: DadosIndicador) {
  const fonte = d.fonte ?? "MANUAL";
  if (!FONTES.includes(fonte)) throw new ErroNegocio("Fonte inválida.");
  if (!DIRECOES.includes(d.direcao)) throw new ErroNegocio("Direção inválida.");
  if (!PERIODICIDADES.includes(d.periodicidade)) throw new ErroNegocio("Periodicidade inválida.");
  if (d.processoId && !(await a.db.processo.findFirst({ where: { id: d.processoId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Processo inválido.");
  if (d.responsavelId && !(await a.db.usuario.findFirst({ where: { id: d.responsavelId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Responsável inválido.");
  const auto = ehAutomatico(fonte) ? DEFINICAO_AUTOMATICA[fonte] : null;
  return {
    nome: texto(d.nome, "o nome do indicador", 3, 200),
    descricao: opcional(d.descricao, "Descrição", 2000),
    processoId: d.processoId || null,
    // Automático: unidade fixa da definição (o cálculo sempre devolve %).
    unidade: auto ? auto.unidade : texto(d.unidade, "a unidade (ex.: %, dias, un)", 1, 20),
    direcao: d.direcao,
    meta: numero(d.meta, "Meta"),
    periodicidade: d.periodicidade,
    fonte,
    formula: opcional(d.formula, "Fórmula/fonte", 2000) ?? auto?.formula ?? null,
    responsavelId: d.responsavelId || null,
  };
}

const erroNomeDuplicado = (e: unknown) => {
  if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") throw new ErroNegocio("Já existe um indicador com este nome.");
  throw e;
};

export async function criarIndicador(a: Ator, d: DadosIndicador) {
  await exigirGestao(a);
  const dados = await dadosIndicador(a, d);
  const i = await a.db.indicador.create({ data: { ...dados, empresaId: a.empresaId, criadoPorId: a.usuarioId } }).catch(erroNomeDuplicado);
  return { id: i.id };
}

/** Edita o cadastro (trava otimista por `versao`). Resultados já lançados guardam a meta da época. */
export async function editarIndicador(a: Ator, id: string, d: DadosIndicador, versao?: number) {
  await exigirGestao(a);
  const atual = await a.db.indicador.findFirst({ where: { id }, select: { versao: true } });
  if (!atual) throw new ErroNegocio("Indicador não encontrado.");
  if (versao !== undefined && versao !== atual.versao) throw new ErroConflito();
  const dados = await dadosIndicador(a, d);
  const r = await a.db.indicador
    .updateMany({ where: { id, versao: atual.versao }, data: { ...dados, versao: { increment: 1 } } })
    .catch(erroNomeDuplicado);
  if (r.count === 0) throw new ErroConflito();
}

/** Inativar/reativar (exclusão lógica; resultados preservados). */
export async function definirAtivoIndicador(a: Ator, id: string, ativo: boolean) {
  await exigirGestao(a);
  const r = await a.db.indicador.updateMany({ where: { id }, data: { ativo, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroNegocio("Indicador não encontrado.");
}

async function carregarParaLancar(a: Ator, id: string) {
  await exigirModuloIndicadores(a);
  const i = await a.db.indicador.findFirst({ where: { id } });
  if (!i) throw new ErroNegocio("Indicador não encontrado.");
  if (!i.ativo) throw new ErroNegocio("Indicador inativo: reative para lançar resultados.");
  if (!podeLancarResultado(a, i)) throw new ErroNegocio("Sem permissão para lançar resultado neste indicador (INDICADOR_GERENCIAR ou responsável).");
  return i;
}

/**
 * Lança o resultado de um período (manual). Não edita lançamentos anteriores: um novo lançamento do mesmo período
 * passa a valer (correção), e a observação é obrigatória nesse caso.
 */
export async function lancarResultado(a: Ator, id: string, d: { periodo: string; valor: number; observacao?: string | null }) {
  const i = await carregarParaLancar(a, id);
  if (ehAutomatico(i.fonte)) throw new ErroNegocio("Indicador automático: use \"Registrar valor calculado\".");
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const periodo = d.periodo.trim().toUpperCase();
  validarPeriodoLancamento(periodo, i.periodicidade, hoje);
  const observacao = opcional(d.observacao, "Observação", 2000);
  const jaTem = await a.db.resultadoIndicador.count({ where: { indicadorId: id, periodo } });
  if (jaTem && !observacao) throw new ErroNegocio("Já existe resultado para este período: informe na observação o motivo da correção.");
  const r = await a.db.resultadoIndicador.create({
    data: { empresaId: a.empresaId, indicadorId: id, periodo, valor: numero(d.valor, "Valor"), meta: i.meta, direcao: i.direcao, observacao, registradoPorId: a.usuarioId },
  });
  return { id: r.id, correcao: jaTem > 0 };
}

/** Registra o valor calculado dos dados reais (indicador automático) para o período. */
export async function registrarResultadoAutomatico(a: Ator, id: string, periodoInformado: string, observacao?: string | null) {
  const i = await carregarParaLancar(a, id);
  if (!ehAutomatico(i.fonte)) throw new ErroNegocio("Este indicador é manual: lance o valor.");
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const periodo = periodoInformado.trim().toUpperCase();
  validarPeriodoLancamento(periodo, i.periodicidade, hoje);
  const valor = await calcularAutomatico(a, i.fonte, limitesPeriodo(periodo, i.periodicidade), hoje, fuso);
  if (valor === null) throw new ErroNegocio("Sem dados no sistema para calcular este período.");
  const r = await a.db.resultadoIndicador.create({
    data: {
      empresaId: a.empresaId,
      indicadorId: id,
      periodo,
      valor,
      meta: i.meta,
      direcao: i.direcao,
      automatico: true,
      observacao: opcional(observacao, "Observação", 2000) ?? "Calculado automaticamente dos dados do sistema.",
      registradoPorId: a.usuarioId,
    },
  });
  return { id: r.id, valor };
}
