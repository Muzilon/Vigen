/**
 * Treinamentos e competências (P7, docs/06-desenho-modulos.md) — serviço de domínio.
 * Catálogo de treinamentos (validade em meses, obrigatoriedade por todos/setores), sessões (turmas) realizadas,
 * presença por pessoa com certificado (Anexo CERTIFICADO_TREINAMENTO) e a matriz de competências (usuário ×
 * treinamento: em dia / a vencer / vencido / não realizado). A validade da participação é gravada no lançamento
 * (data da sessão + validade do treinamento) e recalculada se a validade do treinamento mudar.
 */
import type { ModalidadeTreinamento, MotivoGatilhoReciclagem, Prisma, ResultadoEficacia, TipoTreinamento } from "@prisma/client";
import { fusoDaEmpresa, type Ator } from "@/lib/ator";
import { enviarAnexos, type ArquivoEnviado } from "@/lib/anexos/servico";
import { dataIso, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { exigirModuloTreinamentos, moduloTreinamentosAtivo, podeGerenciarTreinamentos } from "./acesso";
import {
  calcularValidade,
  MODALIDADES,
  montarMatriz,
  MOTIVOS_GATILHO,
  pendenciasNr1,
  situacaoEficacia,
  statusCompetencia,
  TIPOS_TREINAMENTO,
  ultimasRealizacoes,
  ultimosGatilhos,
  type GatilhoMatriz,
  type ParticipacaoMatriz,
} from "./regras";

export * from "./acesso";

async function exigirGestao(a: Ator) {
  await exigirModuloTreinamentos(a);
  if (!podeGerenciarTreinamentos(a)) throw new ErroNegocio("Sem permissão para gerenciar treinamentos (TREINAMENTO_GERENCIAR).");
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
const inteiroOpcional = (v: number | null | undefined, nome: string, min: number, max: number) => {
  if (v === null || v === undefined) return null;
  if (!Number.isInteger(v) || v < min || v > max) throw new ErroNegocio(`${nome} deve ser um inteiro entre ${min} e ${max}.`);
  return v;
};

// ---------------------------------------------------------------- leitura

export async function opcoesTreinamentos(a: Ator) {
  const [setores, funcoes, obras, usuarios, documentos] = await Promise.all([
    a.db.setor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.funcao.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.obraUnidade.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, setorId: true, funcaoId: true }, orderBy: { nome: "asc" } }),
    a.db.documento.findMany({ where: { status: "PUBLICADO" }, select: { id: true, codigo: true, titulo: true }, orderBy: { codigo: "asc" } }),
  ]);
  return { setores, funcoes, obras, usuarios, documentos };
}

export async function listarTreinamentos(a: Ator, f: { inativos?: boolean } = {}) {
  await exigirModuloTreinamentos(a);
  return a.db.treinamento.findMany({
    where: f.inativos ? {} : { ativo: true },
    include: {
      sessoes: {
        select: { id: true, dataRealizacao: true, instrutor: true, obra: { select: { nome: true } }, _count: { select: { participacoes: { where: { presente: true } } } } },
        orderBy: { dataRealizacao: "desc" },
      },
    },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
  });
}
export type TreinamentoListado = Awaited<ReturnType<typeof listarTreinamentos>>[number];

/** Detalhe: sessões com participantes (todos para quem gerencia; senão só a própria participação). */
export async function obterTreinamento(a: Ator, id: string) {
  await exigirModuloTreinamentos(a);
  const g = podeGerenciarTreinamentos(a);
  return a.db.treinamento.findFirst({
    where: { id },
    include: {
      criadoPor: { select: { nome: true } },
      documento: { select: { id: true, codigo: true, titulo: true } },
      sessoes: {
        orderBy: { dataRealizacao: "desc" },
        include: {
          obra: { select: { id: true, nome: true } },
          participacoes: {
            where: g ? {} : { usuarioId: a.usuarioId },
            include: {
              usuario: { select: { id: true, nome: true } },
              certificado: { select: { id: true, nomeArquivo: true } },
              avaliadorEficacia: { select: { nome: true } },
            },
            orderBy: { usuario: { nome: "asc" } },
          },
        },
      },
      gatilhos: {
        where: g ? {} : { usuarioId: a.usuarioId },
        include: { usuario: { select: { nome: true } }, registradoPor: { select: { nome: true } } },
        orderBy: { dataEvento: "desc" },
      },
    },
  });
}

async function participacoesMatriz(a: Ator, where: Prisma.ParticipacaoTreinamentoWhereInput): Promise<ParticipacaoMatriz[]> {
  const ps = await a.db.participacaoTreinamento.findMany({
    where,
    select: { usuarioId: true, presente: true, dataValidade: true, sessao: { select: { treinamentoId: true, dataRealizacao: true } } },
  });
  return ps.map((p) => ({
    usuarioId: p.usuarioId,
    treinamentoId: p.sessao.treinamentoId,
    presente: p.presente,
    dataRealizacao: dataIso(p.sessao.dataRealizacao),
    dataValidade: p.dataValidade ? dataIso(p.dataValidade) : null,
  }));
}

async function gatilhosMatriz(a: Ator, where: Prisma.GatilhoReciclagemWhereInput): Promise<GatilhoMatriz[]> {
  const gs = await a.db.gatilhoReciclagem.findMany({ where, select: { usuarioId: true, treinamentoId: true, dataEvento: true } });
  return gs.map((g) => ({ usuarioId: g.usuarioId, treinamentoId: g.treinamentoId, dataEvento: dataIso(g.dataEvento) }));
}

/**
 * Conscientização (ISO 9001 7.3): para treinamentos vinculados a documento, cada ciência vira uma realização (data da
 * confirmação no fuso) e a publicação da revisão vigente vira um gatilho — ciência só de revisão antiga = reciclagem pendente.
 */
async function realizacoesPorCiencia(
  a: Ator,
  treinamentos: readonly { id: string; documentoId: string | null; validadeMeses: number | null }[],
  usuarioIds: readonly string[],
  fuso: string,
): Promise<{ participacoes: ParticipacaoMatriz[]; gatilhos: GatilhoMatriz[] }> {
  const vinculados = treinamentos.filter((t) => t.documentoId);
  if (!vinculados.length || !usuarioIds.length) return { participacoes: [], gatilhos: [] };
  const docIds = [...new Set(vinculados.map((t) => t.documentoId!))];
  const [docs, ciencias] = await Promise.all([
    a.db.documento.findMany({ where: { id: { in: docIds } }, select: { id: true, versaoVigente: { select: { publicacao: { select: { publicadoEm: true } } } } } }),
    a.db.cienciaDocumento.findMany({
      where: { usuarioId: { in: [...usuarioIds] }, versao: { documentoId: { in: docIds } } },
      select: { usuarioId: true, confirmadoEm: true, versao: { select: { documentoId: true } } },
    }),
  ]);
  const publicado = new Map(docs.map((d) => [d.id, d.versaoVigente?.publicacao?.publicadoEm ?? null]));
  const participacoes: ParticipacaoMatriz[] = [];
  const gatilhos: GatilhoMatriz[] = [];
  for (const t of vinculados) {
    for (const c of ciencias.filter((x) => x.versao.documentoId === t.documentoId)) {
      const dia = hojeNoFuso(fuso, c.confirmadoEm);
      participacoes.push({ usuarioId: c.usuarioId, treinamentoId: t.id, presente: true, dataRealizacao: dia, dataValidade: calcularValidade(dia, t.validadeMeses) });
    }
    const pub = publicado.get(t.documentoId!);
    if (pub) {
      const dia = hojeNoFuso(fuso, pub);
      for (const u of usuarioIds) gatilhos.push({ usuarioId: u, treinamentoId: t.id, dataEvento: dia });
    }
  }
  return { participacoes, gatilhos };
}

export interface FiltrosMatriz {
  /** Só usuários com acesso explícito à obra. */
  obraId?: string;
  usuarioId?: string;
  treinamentoId?: string;
}

/** Matriz de competências (TREINAMENTO_GERENCIAR): usuários ativos × treinamentos ativos, com status por célula. */
export async function matrizCompetencias(a: Ator, f: FiltrosMatriz = {}) {
  await exigirGestao(a);
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const [usuarios, treinamentos] = await Promise.all([
    a.db.usuario.findMany({
      where: {
        AND: [{ ativo: true }, f.usuarioId ? { id: f.usuarioId } : {}, f.obraId ? { acessosObra: { some: { obraId: f.obraId } } } : {}],
      },
      select: { id: true, nome: true, setorId: true, funcaoId: true, setor: { select: { nome: true } }, funcao: { select: { nome: true } } },
      orderBy: { nome: "asc" },
    }),
    a.db.treinamento.findMany({
      where: { AND: [{ ativo: true }, f.treinamentoId ? { id: f.treinamentoId } : {}] },
      select: {
        id: true, nome: true, tipo: true, validadeMeses: true, obrigatorioTodos: true, obrigatorioSetorIds: true, obrigatorioFuncaoIds: true, critico: true, documentoId: true,
      },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    }),
  ]);
  const uIds = usuarios.map((u) => u.id);
  const tIds = treinamentos.map((t) => t.id);
  const [ps, gs, doc] = await Promise.all([
    participacoesMatriz(a, { usuarioId: { in: uIds }, sessao: { treinamentoId: { in: tIds } } }),
    gatilhosMatriz(a, { usuarioId: { in: uIds }, treinamentoId: { in: tIds } }),
    realizacoesPorCiencia(a, treinamentos, uIds, fuso),
  ]);
  return { treinamentos, hoje, ...montarMatriz(usuarios, treinamentos, [...ps, ...doc.participacoes], hoje, undefined, [...gs, ...doc.gatilhos]) };
}

/** "Meus treinamentos": o que fiz (última realização por treinamento, com status e certificado) e o obrigatório pendente. */
export async function meusTreinamentos(a: Ator) {
  await exigirModuloTreinamentos(a);
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const [eu, treinamentos, participacoes, gatilhos] = await Promise.all([
    a.db.usuario.findFirst({ where: { id: a.usuarioId }, select: { setorId: true, funcaoId: true } }),
    a.db.treinamento.findMany({
      where: { ativo: true },
      select: {
        id: true, nome: true, tipo: true, validadeMeses: true, cargaHoraria: true, obrigatorioTodos: true, obrigatorioSetorIds: true, obrigatorioFuncaoIds: true,
        critico: true, documentoId: true, documento: { select: { id: true, codigo: true } },
      },
      orderBy: { nome: "asc" },
    }),
    a.db.participacaoTreinamento.findMany({
      where: { usuarioId: a.usuarioId },
      include: { sessao: { select: { id: true, treinamentoId: true, dataRealizacao: true, instrutor: true, treinamento: { select: { nome: true } } } }, certificado: { select: { id: true, nomeArquivo: true } } },
      orderBy: { sessao: { dataRealizacao: "desc" } },
    }),
    gatilhosMatriz(a, { usuarioId: a.usuarioId }),
  ]);
  const doc = await realizacoesPorCiencia(a, treinamentos, [a.usuarioId], fuso);
  const { linhas, resumo } = montarMatriz([{ id: a.usuarioId, setorId: eu?.setorId ?? null, funcaoId: eu?.funcaoId ?? null }], treinamentos, [...participacoes.map((p) => ({
    usuarioId: p.usuarioId,
    treinamentoId: p.sessao.treinamentoId,
    presente: p.presente,
    dataRealizacao: dataIso(p.sessao.dataRealizacao),
    dataValidade: p.dataValidade ? dataIso(p.dataValidade) : null,
  })), ...doc.participacoes], hoje, undefined, [...gatilhos, ...doc.gatilhos]);
  const celulas = linhas[0].celulas;
  const itens = treinamentos
    .map((t, k) => ({ treinamento: t, ...celulas[k] }))
    .filter((c) => c.status !== null);
  return { itens, historico: participacoes, resumo, aptidao: linhas[0].aptidao, hoje };
}

/** Dashboard: resumo da matriz (quem gerencia) ou da própria situação (demais). null sem o módulo. */
export async function resumoTreinamentos(a: Ator) {
  if (!(await moduloTreinamentosAtivo(a))) return null;
  if (podeGerenciarTreinamentos(a)) return { escopo: "EMPRESA" as const, ...(await matrizCompetencias(a)).resumo };
  return { escopo: "PROPRIO" as const, ...(await meusTreinamentos(a)).resumo };
}

// ---------------------------------------------------------------- escrita

export interface DadosTreinamento {
  nome: string;
  tipo: TipoTreinamento;
  descricao?: string | null;
  cargaHoraria?: number | null;
  validadeMeses?: number | null;
  obrigatorioTodos?: boolean;
  obrigatorioSetorIds?: string[];
  obrigatorioFuncaoIds?: string[];
  documentoId?: string | null;
  critico?: boolean;
  diasAvaliacaoEficacia?: number | null;
}

async function dadosTreinamento(a: Ator, d: DadosTreinamento) {
  if (!TIPOS_TREINAMENTO.includes(d.tipo)) throw new ErroNegocio("Tipo inválido.");
  const setores = [...new Set(d.obrigatorioSetorIds ?? [])];
  if (setores.length && (await a.db.setor.count({ where: { id: { in: setores } } })) !== setores.length) throw new ErroNegocio("Setor inválido.");
  const funcoes = [...new Set(d.obrigatorioFuncaoIds ?? [])];
  if (funcoes.length && (await a.db.funcao.count({ where: { id: { in: funcoes } } })) !== funcoes.length) throw new ErroNegocio("Função inválida.");
  if (d.documentoId && !(await a.db.documento.findFirst({ where: { id: d.documentoId }, select: { id: true } }))) throw new ErroNegocio("Documento inválido.");
  return {
    nome: texto(d.nome, "o nome do treinamento", 3, 200),
    tipo: d.tipo,
    descricao: opcional(d.descricao, "Descrição", 4000),
    cargaHoraria: inteiroOpcional(d.cargaHoraria, "Carga horária", 1, 1000),
    validadeMeses: inteiroOpcional(d.validadeMeses, "Validade (meses)", 1, 120),
    obrigatorioTodos: !!d.obrigatorioTodos,
    obrigatorioSetorIds: d.obrigatorioTodos ? [] : setores,
    obrigatorioFuncaoIds: d.obrigatorioTodos ? [] : funcoes,
    documentoId: d.documentoId || null,
    critico: !!d.critico,
    diasAvaliacaoEficacia: inteiroOpcional(d.diasAvaliacaoEficacia, "Prazo da avaliação de eficácia (dias)", 1, 365),
  };
}

const erroNomeDuplicado = (e: unknown): never => {
  if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") throw new ErroNegocio("Já existe um treinamento com este nome.");
  throw e;
};

export async function criarTreinamento(a: Ator, d: DadosTreinamento) {
  await exigirGestao(a);
  const dados = await dadosTreinamento(a, d);
  const t = await a.db.treinamento.create({ data: { ...dados, empresaId: a.empresaId, criadoPorId: a.usuarioId } }).catch(erroNomeDuplicado);
  return { id: t.id };
}

/** Edita o cadastro. Se a validade mudar, recalcula a validade de todas as participações presentes (mesma transação). */
export async function editarTreinamento(a: Ator, id: string, d: DadosTreinamento, versao?: number) {
  await exigirGestao(a);
  const dados = await dadosTreinamento(a, d);
  await a.db.$transaction(async (tx) => {
    const t = await tx.treinamento.findFirst({ where: { id }, select: { versao: true, validadeMeses: true } });
    if (!t) throw new ErroNegocio("Treinamento não encontrado.");
    if (versao !== undefined && versao !== t.versao) throw new ErroConflito();
    const r = await tx.treinamento.updateMany({ where: { id, versao: t.versao }, data: { ...dados, versao: { increment: 1 } } }).catch(erroNomeDuplicado);
    if (r.count === 0) throw new ErroConflito();
    if (t.validadeMeses !== dados.validadeMeses) {
      const ps = await tx.participacaoTreinamento.findMany({ where: { presente: true, sessao: { treinamentoId: id } }, select: { id: true, sessao: { select: { dataRealizacao: true } } } });
      for (const p of ps) {
        const v = calcularValidade(dataIso(p.sessao.dataRealizacao), dados.validadeMeses);
        await tx.participacaoTreinamento.updateMany({ where: { id: p.id }, data: { dataValidade: v ? paraDataDb(v) : null } });
      }
    }
  });
}

export async function definirAtivoTreinamento(a: Ator, id: string, ativo: boolean) {
  await exigirGestao(a);
  const r = await a.db.treinamento.updateMany({ where: { id }, data: { ativo, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroNegocio("Treinamento não encontrado.");
}

export interface DadosSessao {
  /** YYYY-MM-DD, não futura. */
  dataRealizacao: string;
  instrutor: string;
  obraId?: string | null;
  cargaHoraria?: number | null;
  observacao?: string | null;
  modalidade?: ModalidadeTreinamento;
  conteudoProgramatico?: string | null;
  qualificacaoInstrutor?: string | null;
}

/** Registra uma sessão (turma) realizada do treinamento. */
export async function registrarSessao(a: Ator, treinamentoId: string, d: DadosSessao) {
  await exigirGestao(a);
  const t = await a.db.treinamento.findFirst({ where: { id: treinamentoId }, select: { ativo: true } });
  if (!t) throw new ErroNegocio("Treinamento não encontrado.");
  if (!t.ativo) throw new ErroNegocio("Treinamento inativo.");
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataRealizacao) || Number.isNaN(paraDataDb(d.dataRealizacao).getTime())) throw new ErroNegocio("Data de realização inválida.");
  if (d.dataRealizacao > hoje) throw new ErroNegocio("A data de realização não pode ser futura (registre a sessão depois de realizada).");
  if (d.modalidade && !MODALIDADES.includes(d.modalidade)) throw new ErroNegocio("Modalidade inválida.");
  if (d.obraId && !(await a.db.obraUnidade.findFirst({ where: { id: d.obraId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Unidade inválida.");
  const s = await a.db.sessaoTreinamento.create({
    data: {
      empresaId: a.empresaId,
      treinamentoId,
      dataRealizacao: paraDataDb(d.dataRealizacao),
      instrutor: texto(d.instrutor, "o instrutor", 2, 200),
      obraId: d.obraId || null,
      cargaHoraria: inteiroOpcional(d.cargaHoraria, "Carga horária", 1, 1000),
      observacao: opcional(d.observacao, "Observação", 2000),
      modalidade: d.modalidade ?? "PRESENCIAL",
      conteudoProgramatico: opcional(d.conteudoProgramatico, "Conteúdo programático", 4000),
      qualificacaoInstrutor: opcional(d.qualificacaoInstrutor, "Qualificação do instrutor", 500),
      criadoPorId: a.usuarioId,
    },
  });
  return { id: s.id };
}

export interface LinhaPresenca {
  usuarioId: string;
  presente: boolean;
  aproveitamento?: string | null;
}

/**
 * Lança presença em lote (upsert por usuário na sessão). Presente → validade = data da sessão + validade do treinamento;
 * ausente → sem validade. Devolve o id da participação por usuário (para anexar certificados).
 */
export async function lancarPresencas(a: Ator, sessaoId: string, linhas: readonly LinhaPresenca[]) {
  await exigirGestao(a);
  if (linhas.length === 0) throw new ErroNegocio("Marque ao menos um participante.");
  if (new Set(linhas.map((l) => l.usuarioId)).size !== linhas.length) throw new ErroNegocio("Participante repetido.");
  return a.db.$transaction(
    async (tx) => {
      const s = await tx.sessaoTreinamento.findFirst({ where: { id: sessaoId }, select: { dataRealizacao: true, treinamento: { select: { validadeMeses: true } } } });
      if (!s) throw new ErroNegocio("Sessão não encontrada.");
      const ids = linhas.map((l) => l.usuarioId);
      if ((await tx.usuario.count({ where: { id: { in: ids } } })) !== ids.length) throw new ErroNegocio("Participante inválido.");
      const validade = calcularValidade(dataIso(s.dataRealizacao), s.treinamento.validadeMeses);
      const out = new Map<string, string>();
      for (const l of linhas) {
        const dados = {
          presente: l.presente,
          aproveitamento: opcional(l.aproveitamento, "Aproveitamento", 60),
          dataValidade: l.presente && validade ? paraDataDb(validade) : null,
          registradoPorId: a.usuarioId,
          ...(l.presente ? {} : { eficaciaResultado: null, eficaciaObservacao: null, eficaciaAvaliadaEm: null, eficaciaAvaliadorId: null }),
        };
        const p = await tx.participacaoTreinamento.upsert({
          where: { empresaId_sessaoId_usuarioId: { empresaId: a.empresaId, sessaoId, usuarioId: l.usuarioId } },
          create: { empresaId: a.empresaId, sessaoId, usuarioId: l.usuarioId, ...dados },
          update: dados,
          select: { id: true },
        });
        out.set(l.usuarioId, p.id);
      }
      return out;
    },
    { timeout: 20_000 },
  );
}

/** Anexa o certificado da participação (Anexo CERTIFICADO_TREINAMENTO) e o vincula como certificado vigente. */
export async function anexarCertificado(a: Ator, participacaoId: string, arquivo: ArquivoEnviado) {
  await exigirGestao(a);
  const [anexo] = await enviarAnexos(a, { tipo: "CERTIFICADO_TREINAMENTO", entidadeId: participacaoId }, [arquivo]);
  await a.db.participacaoTreinamento.updateMany({ where: { id: participacaoId }, data: { certificadoAnexoId: anexo.id } });
  return { anexoId: anexo.id };
}

/** Status atual de um usuário num treinamento (para testes e telas pontuais). */
export async function statusDoUsuario(a: Ator, usuarioId: string, treinamentoId: string) {
  await exigirModuloTreinamentos(a);
  if (usuarioId !== a.usuarioId && !podeGerenciarTreinamentos(a)) throw new ErroNegocio("Sem permissão para ver a situação de outro usuário.");
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const k = `${usuarioId}:${treinamentoId}`;
  const t = await a.db.treinamento.findFirst({ where: { id: treinamentoId }, select: { id: true, documentoId: true, validadeMeses: true } });
  const [ps, gs, doc] = await Promise.all([
    participacoesMatriz(a, { usuarioId, sessao: { treinamentoId } }),
    gatilhosMatriz(a, { usuarioId, treinamentoId }),
    realizacoesPorCiencia(a, t ? [t] : [], [usuarioId], await fusoDaEmpresa(a)),
  ]);
  return statusCompetencia(ultimasRealizacoes([...ps, ...doc.participacoes]).get(k) ?? null, hoje, undefined, ultimosGatilhos([...gs, ...doc.gatilhos]).get(k) ?? null);
}

// ---------------------------------------------------------------- gatilhos de reciclagem

export interface DadosGatilho {
  usuarioId: string;
  treinamentoIds: string[];
  motivo: MotivoGatilhoReciclagem;
  /** YYYY-MM-DD, não futura. */
  dataEvento: string;
  descricao?: string | null;
}

/** Registra o evento (um gatilho por treinamento) que exige reciclagem da pessoa. */
export async function registrarGatilho(a: Ator, d: DadosGatilho) {
  await exigirGestao(a);
  if (!MOTIVOS_GATILHO.includes(d.motivo)) throw new ErroNegocio("Motivo inválido.");
  const ids = [...new Set(d.treinamentoIds)];
  if (ids.length === 0) throw new ErroNegocio("Selecione ao menos um treinamento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataEvento) || Number.isNaN(paraDataDb(d.dataEvento).getTime())) throw new ErroNegocio("Data do evento inválida.");
  if (d.dataEvento > hojeNoFuso(await fusoDaEmpresa(a))) throw new ErroNegocio("A data do evento não pode ser futura.");
  if (!(await a.db.usuario.findFirst({ where: { id: d.usuarioId, ativo: true }, select: { id: true } }))) throw new ErroNegocio("Pessoa inválida.");
  if ((await a.db.treinamento.count({ where: { id: { in: ids }, ativo: true } })) !== ids.length) throw new ErroNegocio("Treinamento inválido.");
  const descricao = opcional(d.descricao, "Descrição", 2000);
  await a.db.gatilhoReciclagem.createMany({
    data: ids.map((treinamentoId) => ({
      empresaId: a.empresaId,
      usuarioId: d.usuarioId,
      treinamentoId,
      motivo: d.motivo,
      dataEvento: paraDataDb(d.dataEvento),
      descricao,
      registradoPorId: a.usuarioId,
    })),
  });
}

/** Exclui um gatilho lançado por engano. */
export async function excluirGatilho(a: Ator, id: string) {
  await exigirGestao(a);
  const r = await a.db.gatilhoReciclagem.deleteMany({ where: { id } });
  if (r.count === 0) throw new ErroNegocio("Gatilho não encontrado.");
}

// ---------------------------------------------------------------- avaliação de eficácia

/** Registra (ou corrige) a avaliação de eficácia de um participante presente. "Não eficaz" exige a ação a tomar. */
export async function avaliarEficacia(a: Ator, participacaoId: string, resultado: ResultadoEficacia, observacao?: string | null) {
  await exigirGestao(a);
  if (resultado !== "EFICAZ" && resultado !== "NAO_EFICAZ") throw new ErroNegocio("Resultado inválido.");
  const obs = opcional(observacao, "Observação", 2000);
  if (resultado === "NAO_EFICAZ" && !obs) throw new ErroNegocio("Descreva por que o treinamento não foi eficaz e a ação a tomar.");
  const p = await a.db.participacaoTreinamento.findFirst({ where: { id: participacaoId }, select: { presente: true } });
  if (!p) throw new ErroNegocio("Participação não encontrada.");
  if (!p.presente) throw new ErroNegocio("Só se avalia a eficácia de quem esteve presente.");
  await a.db.participacaoTreinamento.updateMany({
    where: { id: participacaoId },
    data: { eficaciaResultado: resultado, eficaciaObservacao: obs, eficaciaAvaliadaEm: new Date(), eficaciaAvaliadorId: a.usuarioId },
  });
}

// ---------------------------------------------------------------- modo auditoria

/**
 * Evidências consolidadas para o auditor (ISO 9001 7.2): por treinamento ativo, sessões com conformidade NR-1,
 * presença, certificados e eficácia, mais o resumo da matriz. Só leitura, TREINAMENTO_GERENCIAR.
 */
export async function relatorioAuditoria(a: Ator) {
  await exigirGestao(a);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const [matriz, treinamentos] = await Promise.all([
    matrizCompetencias(a),
    a.db.treinamento.findMany({
      where: { ativo: true },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
      include: {
        sessoes: {
          orderBy: { dataRealizacao: "desc" },
          include: {
            obra: { select: { nome: true } },
            participacoes: { select: { presente: true, certificadoAnexoId: true, eficaciaResultado: true } },
          },
        },
      },
    }),
  ]);
  const itens = treinamentos.map((t) => {
    const sessoes = t.sessoes.map((s) => {
      const data = dataIso(s.dataRealizacao);
      const presentes = s.participacoes.filter((p) => p.presente);
      const situacoes = presentes.map((p) => situacaoEficacia({ presente: true, eficaciaResultado: p.eficaciaResultado }, data, t.diasAvaliacaoEficacia, hoje));
      return {
        id: s.id,
        data,
        instrutor: s.instrutor,
        qualificacaoInstrutor: s.qualificacaoInstrutor,
        modalidade: s.modalidade,
        obra: s.obra?.nome ?? null,
        cargaHoraria: s.cargaHoraria,
        presentes: presentes.length,
        ausentes: s.participacoes.length - presentes.length,
        certificados: presentes.filter((p) => p.certificadoAnexoId).length,
        eficazes: situacoes.filter((x) => x === "EFICAZ").length,
        naoEficazes: situacoes.filter((x) => x === "NAO_EFICAZ").length,
        eficaciaPendente: situacoes.filter((x) => x === "PENDENTE").length,
        pendenciasNr1: pendenciasNr1(t, s),
      };
    });
    const avaliadas = sessoes.reduce((n, s) => n + s.eficazes + s.naoEficazes, 0);
    return {
      id: t.id,
      nome: t.nome,
      tipo: t.tipo,
      critico: t.critico,
      validadeMeses: t.validadeMeses,
      diasAvaliacaoEficacia: t.diasAvaliacaoEficacia,
      sessoes,
      percentualEficaz: avaliadas ? Math.round((sessoes.reduce((n, s) => n + s.eficazes, 0) / avaliadas) * 100) : null,
    };
  });
  return { hoje, resumo: matriz.resumo, itens };
}
