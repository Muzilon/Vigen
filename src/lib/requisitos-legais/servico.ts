/**
 * Requisitos legais (P6, docs/06-desenho-modulos.md) — serviço de domínio.
 * Registro de leis/normas aplicáveis (LEG-NNN-AA) com status de atendimento, verificação periódica
 * (reavaliação reutilizando src/lib/reavaliacao), plano de ação quando não atende/atende parcialmente e
 * histórico append-only (cada verificação = evidência de atendimento ao longo do tempo).
 */
import type { EsferaRequisito, Prisma, StatusRequisitoLegal, TemaRequisito, TipoRequisitoLegal } from "@prisma/client";
import { fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { anoNoFuso, dataIso, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { obraNoEscopo } from "@/lib/escopo-obras";
import { notificarItensAtribuidos } from "@/lib/notificacoes/gatilhos";
import { criarPlanoNaTransacao, type DadosItem } from "@/lib/plano-acao/servico";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";
import { formatarCodigoAnual, proximaSequencia } from "@/lib/rnc/numeracao";
import { exigirModuloRequisitos, filtroObraRequisito, moduloRequisitosAtivo, podeGerenciarRequisitos, podeVerificarRequisito } from "./acesso";
import {
  contarPorStatus,
  ESFERAS,
  exigirPlanoSeNecessario,
  MAX_TEXTO_REQUISITO,
  percentualAtendimento,
  STATUS_REQUISITO,
  TEMAS,
  TIPOS_REQUISITO,
  tituloPlanoRequisito,
} from "./regras";

export * from "./acesso";

async function exigirGestao(a: Ator) {
  await exigirModuloRequisitos(a);
  if (!podeGerenciarRequisitos(a)) throw new ErroNegocio("Sem permissão para gerenciar requisitos legais (REQUISITO_LEGAL_GERENCIAR).");
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
const dataValida = (s: string, nome: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(paraDataDb(s).getTime())) throw new ErroNegocio(`${nome} inválida.`);
  return s;
};

// ---------------------------------------------------------------- leitura

export interface FiltrosRequisito {
  tema?: TemaRequisito;
  esfera?: EsferaRequisito;
  status?: StatusRequisitoLegal;
  obra?: string;
  /** uuid do processo, ou "sem". */
  processo?: string;
  /** Somente com verificação vencida. */
  vencidos?: boolean;
}

export async function opcoesRequisitos(a: Ator) {
  const [obras, processos, usuarios] = await Promise.all([
    a.db.obraUnidade.findMany({ where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { obras, processos, usuarios };
}

export async function listarRequisitos(a: Ator, f: FiltrosRequisito = {}) {
  await exigirModuloRequisitos(a);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  return a.db.requisitoLegal.findMany({
    where: {
      AND: [
        { ativo: true },
        filtroObraRequisito(a),
        f.tema ? { tema: f.tema } : {},
        f.esfera ? { esfera: f.esfera } : {},
        f.status ? { status: f.status } : {},
        f.obra ? { obraId: f.obra } : {},
        f.processo === "sem" ? { processoId: null } : f.processo ? { processoId: f.processo } : {},
        f.vencidos ? { proximaVerificacaoEm: { lt: paraDataDb(hoje) }, status: { not: "NAO_APLICAVEL" } } : {},
      ],
    },
    include: {
      processo: { select: { id: true, codigo: true, nome: true } },
      obra: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      planoAcao: { select: { id: true } },
    },
    orderBy: [{ tema: "asc" }, { ano: "asc" }, { sequencia: "asc" }],
    take: 500,
  });
}
export type RequisitoListado = Awaited<ReturnType<typeof listarRequisitos>>[number];

export async function obterRequisito(a: Ator, id: string) {
  await exigirModuloRequisitos(a);
  return a.db.requisitoLegal.findFirst({
    where: { AND: [{ id, ativo: true }, filtroObraRequisito(a)] },
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
    },
  });
}

export async function listarHistoricoRequisito(a: Ator, requisitoId: string) {
  await exigirModuloRequisitos(a);
  const r = await a.db.requisitoLegal.findFirst({ where: { AND: [{ id: requisitoId }, filtroObraRequisito(a)] }, select: { id: true } });
  if (!r) return [];
  return a.db.historicoRequisitoLegal.findMany({ where: { requisitoId }, include: { usuario: { select: { nome: true } } }, orderBy: { criadoEm: "desc" } });
}

/** Requisitos ligados a um processo (detalhe do processo). null sem o módulo. */
export async function listarRequisitosDoProcesso(a: Ator, processoId: string) {
  if (!(await moduloRequisitosAtivo(a))) return null;
  return a.db.requisitoLegal.findMany({
    where: { AND: [{ processoId, ativo: true }, filtroObraRequisito(a)] },
    select: { id: true, codigo: true, numero: true, titulo: true, status: true, proximaVerificacaoEm: true },
    orderBy: [{ ano: "asc" }, { sequencia: "asc" }],
  });
}

/** Dashboard: % de atendimento e requisitos com verificação vencida. null sem o módulo. */
export async function resumoRequisitos(a: Ator) {
  if (!(await moduloRequisitosAtivo(a))) return null;
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const rs = await a.db.requisitoLegal.findMany({
    where: { AND: [{ ativo: true }, filtroObraRequisito(a)] },
    select: { status: true, proximaVerificacaoEm: true },
  });
  const status = rs.map((r) => r.status);
  return {
    total: rs.length,
    percentual: percentualAtendimento(status),
    porStatus: contarPorStatus(status),
    vencidos: rs.filter((r) => r.status !== "NAO_APLICAVEL" && r.proximaVerificacaoEm && dataIso(r.proximaVerificacaoEm) < hoje).length,
  };
}

// ---------------------------------------------------------------- escrita

export interface DadosRequisito {
  tipo: TipoRequisitoLegal;
  numero: string;
  titulo: string;
  esfera: EsferaRequisito;
  tema: TemaRequisito;
  orgaoEmissor?: string | null;
  resumo?: string | null;
  aplicabilidade?: string | null;
  /** YYYY-MM-DD */
  dataPublicacao?: string | null;
  processoId?: string | null;
  obraId?: string | null;
  responsavelId?: string | null;
  periodicidadeMeses?: number | null;
}

/** Primeira ação do plano (quando o status exige plano e ele é criado junto). */
export interface PrimeiraAcao {
  oQue: string;
  quemId: string;
  /** YYYY-MM-DD */
  quando: string;
}

async function dadosRequisito(tx: Tx, a: Ator, d: DadosRequisito) {
  if (!TIPOS_REQUISITO.includes(d.tipo)) throw new ErroNegocio("Tipo inválido.");
  if (!ESFERAS.includes(d.esfera)) throw new ErroNegocio("Esfera inválida.");
  if (!TEMAS.includes(d.tema)) throw new ErroNegocio("Tema inválido.");
  const periodicidadeMeses = d.periodicidadeMeses ?? 12;
  if (!Number.isInteger(periodicidadeMeses) || periodicidadeMeses < 1 || periodicidadeMeses > 60) throw new ErroNegocio("Periodicidade entre 1 e 60 meses.");
  if (d.obraId && (!obraNoEscopo(a, d.obraId) || !(await tx.obraUnidade.findFirst({ where: { id: d.obraId, ativo: true }, select: { id: true } })))) {
    throw new ErroNegocio("Unidade inválida ou sem acesso.");
  }
  if (d.processoId && !(await tx.processo.findFirst({ where: { id: d.processoId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Processo inválido.");
  if (d.responsavelId && !(await tx.usuario.findFirst({ where: { id: d.responsavelId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Responsável inválido.");
  return {
    tipo: d.tipo,
    numero: texto(d.numero, "o número (ex.: NR-35, Lei 12.305/2010)", 1, 120),
    titulo: texto(d.titulo, "o título/ementa", 3, 300),
    esfera: d.esfera,
    tema: d.tema,
    orgaoEmissor: opcional(d.orgaoEmissor, "Órgão emissor", 200),
    resumo: opcional(d.resumo, "Resumo", MAX_TEXTO_REQUISITO),
    aplicabilidade: opcional(d.aplicabilidade, "Aplicabilidade", MAX_TEXTO_REQUISITO),
    dataPublicacao: d.dataPublicacao ? paraDataDb(dataValida(d.dataPublicacao, "Data de publicação")) : null,
    processoId: d.processoId || null,
    obraId: d.obraId || null,
    responsavelId: d.responsavelId || null,
    periodicidadeMeses,
  };
}

async function carregar(tx: Tx, a: Pick<Ator, "obrasPermitidas">, id: string) {
  const r = await tx.requisitoLegal.findFirst({ where: { AND: [{ id, ativo: true }, filtroObraRequisito(a)] } });
  if (!r) throw new ErroNegocio("Requisito legal não encontrado ou sem acesso.");
  return r;
}
type Registro = Awaited<ReturnType<typeof carregar>>;

async function travar(tx: Tx, r: { id: string; versao: number }, data: Prisma.RequisitoLegalUncheckedUpdateManyInput) {
  const res = await tx.requisitoLegal.updateMany({ where: { id: r.id, versao: r.versao, ativo: true }, data: { ...data, versao: { increment: 1 } } });
  if (res.count === 0) throw new ErroConflito();
}

async function historico(
  tx: Tx,
  a: Pick<Ator, "empresaId" | "usuarioId">,
  requisitoId: string,
  acao: "CRIACAO" | "ALTERACAO" | "VERIFICACAO" | "REVISAO_GERAL" | "PLANO" | "EXCLUSAO",
  statusAnterior: StatusRequisitoLegal | null,
  statusNovo: StatusRequisitoLegal,
  dataVerificacao: string | null,
  observacao?: string | null,
) {
  await tx.historicoRequisitoLegal.create({
    data: {
      empresaId: a.empresaId,
      requisitoId,
      acao,
      statusAnterior,
      statusNovo,
      dataVerificacao: dataVerificacao ? paraDataDb(dataVerificacao) : null,
      observacao: observacao?.trim().slice(0, 2000) || null,
      usuarioId: a.usuarioId,
    },
  });
}

async function criarPlano(tx: Tx, a: Ator, r: Pick<Registro, "id" | "codigo" | "numero" | "titulo" | "obraId">, titulo: string | null, itens: DadosItem[]) {
  return criarPlanoNaTransacao(
    tx,
    a,
    { titulo: (titulo?.trim() || tituloPlanoRequisito(r)).slice(0, 200), descricao: `Plano de ação para atendimento do requisito legal ${r.codigo} (${r.numero}).`, obraId: r.obraId, itens },
    { tipo: "REQUISITO_LEGAL", id: r.id },
  );
}

/** Cadastra o requisito (código LEG-NNN-AA). Status NAO_ATENDE/ATENDE_PARCIAL exige a primeira ação do plano. */
export async function criarRequisito(a: Ator, d: DadosRequisito & { status?: StatusRequisitoLegal | null; observacao?: string | null; primeiraAcao?: PrimeiraAcao | null }) {
  await exigirGestao(a);
  const status = d.status ?? "EM_ANALISE";
  if (!STATUS_REQUISITO.includes(status)) throw new ErroNegocio("Status inválido.");
  exigirPlanoSeNecessario(status, !!d.primeiraAcao);
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const ano = anoNoFuso(fuso);
  const r = await a.db.$transaction(async (tx) => {
    const dados = await dadosRequisito(tx, a, d);
    const sequencia = await proximaSequencia(tx, a.empresaId, "REQUISITO_LEGAL", ano);
    const verificado = status !== "EM_ANALISE";
    const req = await tx.requisitoLegal.create({
      data: {
        ...dados,
        empresaId: a.empresaId,
        ano,
        sequencia,
        codigo: formatarCodigoAnual("LEG", sequencia, ano),
        status,
        ultimaVerificacaoEm: verificado ? paraDataDb(hoje) : null,
        proximaVerificacaoEm: paraDataDb(calcularProximaReavaliacao(hoje, dados.periodicidadeMeses)),
        criadoPorId: a.usuarioId,
      },
    });
    await historico(tx, a, req.id, "CRIACAO", null, status, verificado ? hoje : null, d.observacao);
    let itemIds: string[] = [];
    if (d.primeiraAcao) {
      const plano = await criarPlano(tx, a, req, null, [d.primeiraAcao]);
      await tx.requisitoLegal.updateMany({ where: { id: req.id }, data: { planoAcaoId: plano.id } });
      await historico(tx, a, req.id, "PLANO", status, status, null, "Plano de ação gerado no cadastro.");
      itemIds = plano.itemIds;
    }
    return { id: req.id, codigo: req.codigo, itemIds };
  });
  if (r.itemIds.length) await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { id: r.id, codigo: r.codigo };
}

/** Edita os dados cadastrais (não o status: status muda só por verificação, com histórico). */
export async function editarRequisito(a: Ator, id: string, d: DadosRequisito, versao?: number) {
  await exigirGestao(a);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  await a.db.$transaction(async (tx) => {
    const r = await carregar(tx, a, id);
    if (versao !== undefined && versao !== r.versao) throw new ErroConflito();
    const dados = await dadosRequisito(tx, a, d);
    let proxima = r.proximaVerificacaoEm;
    if (dados.periodicidadeMeses !== r.periodicidadeMeses) {
      proxima = paraDataDb(calcularProximaReavaliacao(r.ultimaVerificacaoEm ? dataIso(r.ultimaVerificacaoEm) : hoje, dados.periodicidadeMeses));
    }
    await travar(tx, r, { ...dados, proximaVerificacaoEm: proxima });
    await historico(tx, a, id, "ALTERACAO", r.status, r.status, null, "Dados cadastrais alterados.");
  });
}

export interface DadosVerificacao {
  status: StatusRequisitoLegal;
  /** YYYY-MM-DD (padrão: hoje). Não pode ser futura. */
  data?: string | null;
  observacao?: string | null;
  primeiraAcao?: PrimeiraAcao | null;
}

/**
 * Registra uma verificação de atendimento: status (evidência), data, observação e próxima verificação
 * (data + periodicidade). NAO_ATENDE/ATENDE_PARCIAL sem plano exige a primeira ação (o plano é criado junto).
 */
export async function registrarVerificacao(a: Ator, id: string, d: DadosVerificacao, versao?: number) {
  await exigirModuloRequisitos(a);
  if (!STATUS_REQUISITO.includes(d.status)) throw new ErroNegocio("Status inválido.");
  const obs = opcional(d.observacao, "Observação", 2000);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const data = d.data ? dataValida(d.data, "Data da verificação") : hoje;
  if (data > hoje) throw new ErroNegocio("A data da verificação não pode ser futura.");
  const itemIds = await a.db.$transaction(async (tx) => {
    const r = await carregar(tx, a, id);
    if (!podeVerificarRequisito(a, r)) throw new ErroNegocio("Sem permissão para verificar este requisito (REQUISITO_LEGAL_GERENCIAR ou responsável).");
    if (versao !== undefined && versao !== r.versao) throw new ErroConflito();
    exigirPlanoSeNecessario(d.status, !!r.planoAcaoId || !!d.primeiraAcao);
    let planoAcaoId = r.planoAcaoId;
    let ids: string[] = [];
    if (!planoAcaoId && d.primeiraAcao) {
      const plano = await criarPlano(tx, a, r, null, [d.primeiraAcao]);
      planoAcaoId = plano.id;
      ids = plano.itemIds;
    }
    await travar(tx, r, {
      status: d.status,
      planoAcaoId,
      ultimaVerificacaoEm: paraDataDb(data),
      proximaVerificacaoEm: paraDataDb(calcularProximaReavaliacao(data, r.periodicidadeMeses)),
    });
    await historico(tx, a, id, "VERIFICACAO", r.status, d.status, data, obs);
    if (ids.length) await historico(tx, a, id, "PLANO", d.status, d.status, null, "Plano de ação gerado na verificação.");
    return ids;
  });
  if (itemIds.length) await notificarItensAtribuidos(a, itemIds, "criado");
}

/** Gera o plano de ação (origem REQUISITO_LEGAL) e vincula ao requisito. */
export async function gerarPlanoRequisito(a: Ator, id: string, d: { titulo?: string | null; itens: DadosItem[] }) {
  await exigirModuloRequisitos(a);
  const r = await a.db.$transaction(async (tx) => {
    const req = await carregar(tx, a, id);
    if (!podeVerificarRequisito(a, req)) throw new ErroNegocio("Sem permissão para gerar plano neste requisito.");
    if (req.planoAcaoId) throw new ErroNegocio("Este requisito já tem plano de ação vinculado.");
    const plano = await criarPlano(tx, a, req, d.titulo ?? null, d.itens);
    await travar(tx, req, { planoAcaoId: plano.id });
    await historico(tx, a, id, "PLANO", req.status, req.status, null, "Plano de ação gerado.");
    return plano;
  });
  await notificarItensAtribuidos(a, r.itemIds, "criado");
  return { id: r.id };
}

/** Exclusão lógica (histórico preservado). */
export async function excluirRequisito(a: Ator, id: string, motivo?: string | null) {
  await exigirGestao(a);
  await a.db.$transaction(async (tx) => {
    const r = await carregar(tx, a, id);
    await travar(tx, r, { ativo: false });
    await historico(tx, a, id, "EXCLUSAO", r.status, r.status, null, motivo || "Requisito excluído.");
  });
}

/**
 * Revisão geral: marca um lote de requisitos como revisados numa data (status mantido). Cada um ganha
 * histórico REVISAO_GERAL, última verificação = data e próxima = data + periodicidade. Tudo numa transação.
 */
export async function revisaoGeralRequisitos(a: Ator, ids: readonly string[], dataRevisao: string, observacao?: string | null) {
  await exigirGestao(a);
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) throw new ErroNegocio("Selecione ao menos um requisito.");
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const data = dataValida(dataRevisao, "Data da revisão");
  if (data > hoje) throw new ErroNegocio("A data da revisão não pode ser futura.");
  const obs = opcional(observacao, "Observação", 2000) ?? "Revisão geral.";
  return a.db.$transaction(
    async (tx) => {
      const rs = await tx.requisitoLegal.findMany({ where: { AND: [{ id: { in: unicos }, ativo: true }, filtroObraRequisito(a)] } });
      if (rs.length !== unicos.length) throw new ErroNegocio("Requisito fora do escopo ou excluído na seleção.");
      for (const r of rs) {
        await travar(tx, r, { ultimaVerificacaoEm: paraDataDb(data), proximaVerificacaoEm: paraDataDb(calcularProximaReavaliacao(data, r.periodicidadeMeses)) });
        await historico(tx, a, r.id, "REVISAO_GERAL", r.status, r.status, data, obs);
      }
      return { revisados: rs.length };
    },
    { timeout: 20_000 },
  );
}
