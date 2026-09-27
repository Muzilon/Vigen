/**
 * Tramitação de Documentos (ISO 9001 7.5) — serviço de domínio (docs/06-desenho-modulos.md, seção 6 e P4).
 * Ciclo: elaborar (arquivo + motivo) → enviar para revisão/aprovação (motor multi-assinante: revisores e
 * aprovadores numa lista ordenada, sequencial ou paralela) → APROVADO → publicar escolhendo o público,
 * se notifica e se exige ciência → a revisão vigente anterior vira OBSOLETA na mesma transação.
 * Nova revisão parte da vigente; cancelamento e obsolescência; revisão periódica (fonte de reavaliação).
 * Escrita: DOCUMENTO_ELABORAR (elaborar/enviar) e DOCUMENTO_GERENCIAR (publicar, tipos, obsoletar).
 * Todo evento grava HistoricoDocumento (append-only). Revisão publicada é imutável (trigger).
 */
import { Prisma, type ModoAprovacao, type StatusDocumento, type FluxoAprovacao } from "@prisma/client";
import { atorTem, fusoDaEmpresa, type Ator, type Tx } from "@/lib/ator";
import { validarArquivos, type ArquivoEnviado } from "@/lib/anexos/servico";
import { criarFluxoNaTransacao, notificarFluxoCriado } from "@/lib/aprovacao/servico";
import { getArmazenamento, montarChave } from "@/lib/armazenamento";
import { dataIso, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import { comSeguranca, criarNotificacoes } from "@/lib/notificacoes/servico";
import { calcularProximaReavaliacao } from "@/lib/reavaliacao/regras";
import { proximaSequencia } from "@/lib/rnc/numeracao";
import {
  acessoDocumento,
  exigirModuloDocumentos,
  moduloDocumentosAtivo,
  podeElaborarDocumentos,
  podeGerenciarDocumentos,
  usuarioPublico,
  usuariosPublico,
  veListaMestra,
} from "./acesso";
import {
  estaNoPublico,
  exigirTransicao,
  formatarCodigoDocumento,
  MAX_TITULO,
  montarSignatarios,
  normalizarMotivo,
  normalizarSigla,
  respostasCorretas,
  revisaoVencida,
  rotuloRevisao,
  situacaoCiencias,
  statusAoEnviar,
  statusAposAssinatura,
  STATUS_EM_TRAMITACAO,
  validarPeriodicidade,
  validarPublico,
  type PerguntaCiencia,
  type PublicoDocumento,
} from "./regras";

export const linkDocumento = (id: string) => `/documentos/${id}`;

type Quem = Pick<Ator, "empresaId" | "usuarioId">;

// ---------------------------------------------------------------- utilitários

function ehUnicoViolado(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function exigirElaborar(a: Ator) {
  await exigirModuloDocumentos(a);
  if (!podeElaborarDocumentos(a)) throw new ErroNegocio("Sem permissão para elaborar documentos (DOCUMENTO_ELABORAR).");
}

async function exigirGerenciar(a: Ator) {
  await exigirModuloDocumentos(a);
  if (!podeGerenciarDocumentos(a)) throw new ErroNegocio("Sem permissão para gerenciar documentos (DOCUMENTO_GERENCIAR).");
}

async function historico(
  tx: Tx,
  q: Quem,
  documentoId: string,
  acao: Prisma.HistoricoDocumentoUncheckedCreateInput["acao"],
  extra: { versaoId?: string | null; observacao?: string | null; dados?: Prisma.InputJsonValue } = {},
) {
  await tx.historicoDocumento.create({
    data: {
      empresaId: q.empresaId,
      documentoId,
      versaoId: extra.versaoId ?? null,
      acao,
      observacao: extra.observacao?.trim().slice(0, 1000) || null,
      dados: extra.dados,
      usuarioId: q.usuarioId,
    },
  });
}

/** Trava otimista do documento (versao) — conflito se mudou. */
async function travar(tx: Tx, d: { id: string; versao: number }, data: Prisma.DocumentoUncheckedUpdateManyInput) {
  const r = await tx.documento.updateMany({ where: { id: d.id, versao: d.versao }, data: { ...data, versao: { increment: 1 } } });
  if (r.count === 0) throw new ErroConflito();
}

async function carregarDocumento(tx: Tx, id: string) {
  const d = await tx.documento.findFirst({ where: { id }, include: { tipo: { select: { sigla: true, nome: true } } } });
  if (!d) throw new ErroNegocio("Documento não encontrado.");
  return d;
}

/** Revisão em trabalho (não publicada/obsoleta/cancelada), se houver — no máximo uma por documento. */
function revisaoEmTrabalho(tx: Tx | Ator["db"], documentoId: string) {
  return tx.versaoDocumento.findFirst({ where: { documentoId, status: { in: ["RASCUNHO", "EM_APROVACAO", "APROVADA"] } }, orderBy: { numero: "desc" } });
}

// ---------------------------------------------------------------- arquivo da revisão

interface ArquivoPreparado {
  chave: string;
  nome: string;
  mimeType: string;
  tamanho: number;
}

/** Valida (magic bytes, extensão, tamanho — recusa arquivo inválido) e grava no armazenamento. */
async function prepararArquivo(a: Ator, arquivo: ArquivoEnviado | null | undefined): Promise<ArquivoPreparado> {
  if (!arquivo || arquivo.dados.byteLength === 0) throw new ErroNegocio("Anexe o arquivo do documento.");
  const [{ dados, v }] = await validarArquivos(a, [arquivo]);
  const chave = await getArmazenamento().salvar(montarChave(a.empresaId, "DOCUMENTO_VERSAO", v.nomeSanitizado), dados, v.mimeType);
  return { chave, nome: v.nome, mimeType: v.mimeType, tamanho: dados.byteLength };
}

async function descartarArquivo(p: ArquivoPreparado | null) {
  if (p) await getArmazenamento().excluir(p.chave).catch(() => undefined);
}

async function gravarAnexo(tx: Tx, q: Quem, versaoId: string, p: ArquivoPreparado) {
  const an = await tx.anexo.create({
    data: {
      empresaId: q.empresaId,
      entidadeTipo: "DOCUMENTO_VERSAO",
      entidadeId: versaoId,
      nomeArquivo: p.nome,
      mimeType: p.mimeType,
      tamanhoBytes: p.tamanho,
      chaveArmazenamento: p.chave,
      url: null,
      sensivel: false,
      enviadoPorId: q.usuarioId,
    },
    select: { id: true },
  });
  await tx.versaoDocumento.updateMany({ where: { id: versaoId }, data: { anexoId: an.id } });
  return an.id;
}

// ---------------------------------------------------------------- tipos de documento

export async function listarTipos(a: Pick<Ator, "db">, opts: { incluirInativos?: boolean } = {}) {
  return a.db.tipoDocumentoEmpresa.findMany({
    where: opts.incluirInativos ? {} : { ativo: true },
    include: { _count: { select: { documentos: true } } },
    orderBy: { sigla: "asc" },
  });
}

export interface DadosTipo {
  id?: string | null;
  nome: string;
  sigla: string;
  periodicidadeRevisaoMeses: number;
  ativo?: boolean;
}

/** Cria/edita tipo (DOCUMENTO_GERENCIAR ou ADMIN_CONFIG). A sigla não muda depois de usada. */
export async function salvarTipo(a: Ator, d: DadosTipo) {
  await exigirModuloDocumentos(a);
  if (!podeGerenciarDocumentos(a) && !atorTem(a, "ADMIN_CONFIG")) throw new ErroNegocio("Sem permissão para configurar tipos de documento.");
  const nome = d.nome.trim();
  if (nome.length < 2 || nome.length > 80) throw new ErroNegocio("Nome do tipo entre 2 e 80 caracteres.");
  const sigla = normalizarSigla(d.sigla);
  validarPeriodicidade(d.periodicidadeRevisaoMeses);
  try {
    if (!d.id) {
      return await a.db.tipoDocumentoEmpresa.create({ data: { empresaId: a.empresaId, nome, sigla, periodicidadeRevisaoMeses: d.periodicidadeRevisaoMeses } });
    }
    const atual = await a.db.tipoDocumentoEmpresa.findFirst({ where: { id: d.id }, include: { _count: { select: { documentos: true } } } });
    if (!atual) throw new ErroNegocio("Tipo não encontrado.");
    if (atual.sigla !== sigla && atual._count.documentos > 0) throw new ErroNegocio("A sigla não pode mudar: já há documentos codificados com ela.");
    await a.db.tipoDocumentoEmpresa.updateMany({ where: { id: d.id }, data: { nome, sigla, periodicidadeRevisaoMeses: d.periodicidadeRevisaoMeses, ativo: d.ativo ?? atual.ativo } });
    return atual;
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio("Já existe um tipo com este nome ou sigla.");
    throw e;
  }
}

// ---------------------------------------------------------------- criação e revisões

export interface DadosDocumento {
  tipoId: string;
  titulo: string;
  descricao?: string | null;
  processoId?: string | null;
  obraId?: string | null;
  setorId?: string | null;
  responsavelId: string;
  /** Vazio = periodicidade padrão do tipo. */
  periodicidadeRevisaoMeses?: number | null;
}

async function validarReferencias(tx: Tx, d: DadosDocumento) {
  if (d.processoId && (await tx.processo.count({ where: { id: d.processoId, ativo: true } })) === 0) throw new ErroNegocio("Processo inválido.");
  if (d.obraId && (await tx.obraUnidade.count({ where: { id: d.obraId, ativo: true } })) === 0) throw new ErroNegocio("Unidade inválida.");
  if (d.setorId && (await tx.setor.count({ where: { id: d.setorId, ativo: true } })) === 0) throw new ErroNegocio("Setor inválido.");
  if ((await tx.usuario.count({ where: { id: d.responsavelId, ativo: true } })) === 0) throw new ErroNegocio("Responsável inválido.");
}

/**
 * Cria o documento com a revisão 00 em RASCUNHO (arquivo obrigatório). Código automático
 * SIGLA-NNN pela sequência do tipo (ContadorSequencial DOCUMENTO, subtipo = id do tipo).
 */
export async function criarDocumento(a: Ator, d: DadosDocumento & { motivo?: string | null; arquivo: ArquivoEnviado | null }) {
  await exigirElaborar(a);
  const titulo = d.titulo.trim();
  if (titulo.length < 3 || titulo.length > MAX_TITULO) throw new ErroNegocio(`Título entre 3 e ${MAX_TITULO} caracteres.`);
  const motivo = normalizarMotivo(d.motivo || "Emissão inicial.");
  const tipo = await a.db.tipoDocumentoEmpresa.findFirst({ where: { id: d.tipoId, ativo: true } });
  if (!tipo) throw new ErroNegocio("Tipo de documento inválido.");
  const periodicidade = d.periodicidadeRevisaoMeses || tipo.periodicidadeRevisaoMeses;
  validarPeriodicidade(periodicidade);
  const arq = await prepararArquivo(a, d.arquivo);
  try {
    return await a.db.$transaction(async (tx) => {
      await validarReferencias(tx, d);
      const seq = await proximaSequencia(tx, a.empresaId, "DOCUMENTO", 0, tipo.id);
      const doc = await tx.documento.create({
        data: {
          empresaId: a.empresaId,
          tipoId: tipo.id,
          sequencia: seq,
          codigo: formatarCodigoDocumento(tipo.sigla, seq),
          titulo,
          descricao: d.descricao?.trim() || null,
          processoId: d.processoId || null,
          obraId: d.obraId || null,
          setorId: d.setorId || null,
          responsavelId: d.responsavelId,
          periodicidadeRevisaoMeses: periodicidade,
          status: "ELABORACAO",
          criadoPorId: a.usuarioId,
        },
      });
      const v = await tx.versaoDocumento.create({ data: { empresaId: a.empresaId, documentoId: doc.id, numero: 0, motivo, elaboradorId: a.usuarioId } });
      await gravarAnexo(tx, a, v.id, arq);
      await historico(tx, a, doc.id, "CRIACAO", { versaoId: v.id, observacao: `${doc.codigo} ${rotuloRevisao(0)} — ${motivo}` });
      return { id: doc.id, codigo: doc.codigo, versaoId: v.id };
    });
  } catch (e) {
    await descartarArquivo(arq);
    if (ehUnicoViolado(e)) throw new ErroConflito();
    throw e;
  }
}

/** Nova revisão a partir da vigente (documento PUBLICADO, sem revisão em trabalho). */
export async function novaRevisao(a: Ator, documentoId: string, d: { motivo: string; arquivo: ArquivoEnviado | null }, versaoLida?: number) {
  await exigirElaborar(a);
  const motivo = normalizarMotivo(d.motivo);
  const arq = await prepararArquivo(a, d.arquivo);
  try {
    return await a.db.$transaction(async (tx) => {
      const doc = await carregarDocumento(tx, documentoId);
      if (versaoLida !== undefined && versaoLida !== doc.versao) throw new ErroConflito();
      if (!doc.versaoVigenteId) throw new ErroNegocio("Nova revisão só a partir de um documento publicado.");
      exigirTransicao(doc.status, "ELABORACAO");
      if (await revisaoEmTrabalho(tx, doc.id)) throw new ErroNegocio("Já existe uma revisão em elaboração/aprovação para este documento.");
      const max = await tx.versaoDocumento.aggregate({ where: { documentoId: doc.id }, _max: { numero: true } });
      const numero = (max._max.numero ?? -1) + 1;
      const v = await tx.versaoDocumento.create({ data: { empresaId: a.empresaId, documentoId: doc.id, numero, motivo, elaboradorId: a.usuarioId } });
      await gravarAnexo(tx, a, v.id, arq);
      await travar(tx, doc, { status: "ELABORACAO" });
      await historico(tx, a, doc.id, "NOVA_REVISAO", { versaoId: v.id, observacao: `${rotuloRevisao(numero)} — ${motivo}` });
      return { versaoId: v.id, numero };
    });
  } catch (e) {
    await descartarArquivo(arq);
    if (ehUnicoViolado(e)) throw new ErroConflito();
    throw e;
  }
}

/** Substitui o arquivo (e opcionalmente o motivo) da revisão em RASCUNHO. O anexo anterior é inativado. */
export async function substituirArquivo(a: Ator, documentoId: string, d: { arquivo: ArquivoEnviado | null; motivo?: string | null }) {
  await exigirElaborar(a);
  const arq = await prepararArquivo(a, d.arquivo);
  try {
    await a.db.$transaction(async (tx) => {
      const doc = await carregarDocumento(tx, documentoId);
      const v = await revisaoEmTrabalho(tx, doc.id);
      if (!v || v.status !== "RASCUNHO") throw new ErroNegocio("Só é possível trocar o arquivo de uma revisão em elaboração (rascunho).");
      if (v.elaboradorId !== a.usuarioId && !podeGerenciarDocumentos(a)) throw new ErroNegocio("Somente quem elaborou a revisão ou um gestor de documentos pode trocar o arquivo.");
      const anterior = v.anexoId;
      await gravarAnexo(tx, a, v.id, arq);
      if (anterior) await tx.anexo.updateMany({ where: { id: anterior, excluidoEm: null }, data: { excluidoEm: new Date(), excluidoPorId: a.usuarioId } });
      const motivo = d.motivo?.trim() ? normalizarMotivo(d.motivo) : null;
      if (motivo) await tx.versaoDocumento.updateMany({ where: { id: v.id, status: "RASCUNHO" }, data: { motivo } });
      await travar(tx, doc, {});
      await historico(tx, a, doc.id, "ARQUIVO_SUBSTITUIDO", { versaoId: v.id, observacao: `${rotuloRevisao(v.numero)}: ${arq.nome}` });
    });
  } catch (e) {
    await descartarArquivo(arq);
    throw e;
  }
}

// ---------------------------------------------------------------- fluxo de revisão/aprovação

export interface DadosEnvio {
  revisorIds: string[];
  aprovadorIds: string[];
  modo: ModoAprovacao;
  resumo?: string | null;
}

interface PayloadDocumento {
  documentoId: string;
  versaoId: string;
  numero: number;
  revisorIds: string[];
  aprovadorIds: string[];
}

/**
 * Envia a revisão em RASCUNHO para o motor de aprovação: um fluxo com revisores (primeiro) e
 * aprovadores, sequencial ou paralelo. Documento → EM_REVISAO (com revisores) ou EM_APROVACAO.
 */
export async function enviarParaAprovacao(a: Ator, documentoId: string, d: DadosEnvio, versaoLida?: number) {
  await exigirElaborar(a);
  const signatarios = montarSignatarios(d.revisorIds, d.aprovadorIds);
  const r = await a.db.$transaction(async (tx) => {
    const doc = await carregarDocumento(tx, documentoId);
    if (versaoLida !== undefined && versaoLida !== doc.versao) throw new ErroConflito();
    const v = await revisaoEmTrabalho(tx, doc.id);
    if (!v || v.status !== "RASCUNHO") throw new ErroNegocio("Não há revisão em elaboração para enviar.");
    if (!v.anexoId) throw new ErroNegocio("Anexe o arquivo da revisão antes de enviar.");
    const novo = statusAoEnviar(d.revisorIds.length);
    exigirTransicao(doc.status, novo);
    const payload: PayloadDocumento = { documentoId: doc.id, versaoId: v.id, numero: v.numero, revisorIds: d.revisorIds, aprovadorIds: d.aprovadorIds };
    const f = await criarFluxoNaTransacao(tx, a, {
      entidadeTipo: "DOCUMENTO",
      entidadeId: doc.id,
      tipoAlteracao: v.numero === 0 ? "INCLUSAO" : "ALTERACAO",
      modo: d.modo,
      aprovadorIds: signatarios,
      payload: { ...payload, codigo: doc.codigo, revisao: rotuloRevisao(v.numero), motivo: v.motivo } as Prisma.InputJsonValue,
      resumo: (d.resumo?.trim() || `${doc.codigo} ${rotuloRevisao(v.numero)} — ${doc.titulo}`).slice(0, 300),
    });
    const u = await tx.versaoDocumento.updateMany({ where: { id: v.id, status: "RASCUNHO" }, data: { status: "EM_APROVACAO", fluxoAprovacaoId: f.id } });
    if (u.count === 0) throw new ErroConflito();
    await travar(tx, doc, { status: novo });
    await historico(tx, a, doc.id, "ENVIO_APROVACAO", {
      versaoId: v.id,
      observacao: `${d.revisorIds.length} revisor(es), ${d.aprovadorIds.length} aprovador(es) — ${d.modo === "SEQUENCIAL" ? "sequencial" : "paralelo"}.`,
    });
    return f;
  });
  await notificarFluxoCriado(a, r.id);
  return { fluxoId: r.id };
}

/** Handler — assinatura intermediária: todos os revisores assinaram → EM_APROVACAO. */
export async function avancarDocumento(tx: Tx, fluxo: FluxoAprovacao, ator: Quem) {
  const p = fluxo.payload as unknown as PayloadDocumento;
  const doc = await tx.documento.findFirst({ where: { id: p.documentoId } });
  if (!doc) return;
  const etapas = await tx.etapaAprovacao.findMany({ where: { fluxoId: fluxo.id }, select: { aprovadorId: true, status: true } });
  const novo = statusAposAssinatura(doc.status, p.revisorIds ?? [], etapas);
  if (novo === doc.status) return;
  await travar(tx, doc, { status: novo });
  await historico(tx, ator, doc.id, "REVISADO", { versaoId: p.versaoId, observacao: "Revisores assinaram; segue para os aprovadores." });
}

/** Handler — última assinatura: revisão APROVADA e documento APROVADO (pronto para publicar). */
export async function aprovarRevisao(tx: Tx, fluxo: FluxoAprovacao, ator: Quem) {
  const p = fluxo.payload as unknown as PayloadDocumento;
  const doc = await carregarDocumento(tx, p.documentoId);
  const u = await tx.versaoDocumento.updateMany({ where: { id: p.versaoId, status: "EM_APROVACAO", fluxoAprovacaoId: fluxo.id }, data: { status: "APROVADA", aprovadoEm: new Date() } });
  if (u.count === 0) throw new ErroConflito();
  exigirTransicao(doc.status, "APROVADO");
  await travar(tx, doc, { status: "APROVADO" });
  await historico(tx, ator, doc.id, "APROVACAO", { versaoId: p.versaoId, observacao: `${rotuloRevisao(p.numero)} aprovada — pronta para publicar.` });
}

/** Handler — rejeição ou cancelamento: revisão volta a RASCUNHO e o documento a ELABORACAO. */
export async function devolverRevisao(tx: Tx, fluxo: FluxoAprovacao, ator: Quem, cancelado: boolean) {
  const p = fluxo.payload as unknown as PayloadDocumento;
  const doc = await tx.documento.findFirst({ where: { id: p.documentoId } });
  if (!doc) return;
  await tx.versaoDocumento.updateMany({ where: { id: p.versaoId, status: "EM_APROVACAO" }, data: { status: "RASCUNHO" } });
  if (doc.status === "EM_REVISAO" || doc.status === "EM_APROVACAO") await travar(tx, doc, { status: "ELABORACAO" });
  await historico(tx, ator, doc.id, cancelado ? "CANCELAMENTO_APROVACAO" : "REJEICAO", {
    versaoId: p.versaoId,
    observacao: cancelado ? "Solicitação cancelada pelo solicitante; revisão volta a rascunho." : "Revisão rejeitada no fluxo; volta a rascunho para ajustes.",
  });
}

// ---------------------------------------------------------------- publicação

export interface DadosPublicacao extends PublicoDocumento {
  notificar: boolean;
  exigirCiencia: boolean;
  /** Micro-quiz de ciência de leitura (opcional, até 3 perguntas). */
  perguntasCiencia?: PerguntaCiencia[];
}

async function validarIdsPublico(tx: Tx, p: PublicoDocumento) {
  const confere = async (n: number, ids: readonly string[], rotulo: string) => {
    if (n !== new Set(ids).size) throw new ErroNegocio(`${rotulo} inválido(s) no público.`);
  };
  await confere(await tx.setor.count({ where: { id: { in: [...p.setorIds] } } }), p.setorIds, "Setor");
  await confere(await tx.obraUnidade.count({ where: { id: { in: [...p.obraIds] } } }), p.obraIds, "Unidade");
  await confere(await tx.perfil.count({ where: { id: { in: [...p.perfilIds] } } }), p.perfilIds, "Perfil");
  await confere(await tx.usuario.count({ where: { id: { in: [...p.usuarioIds] }, ativo: true } }), p.usuarioIds, "Usuário");
}

/** Publica a revisão APROVADA; a vigente anterior vira OBSOLETA na mesma transação. */
export async function publicar(a: Ator, documentoId: string, d: DadosPublicacao, versaoLida?: number) {
  await exigirGerenciar(a);
  const publico: PublicoDocumento & { setorIds: string[]; obraIds: string[]; perfilIds: string[]; usuarioIds: string[] } = {
    publicoTodos: d.publicoTodos,
    setorIds: d.publicoTodos ? [] : [...new Set(d.setorIds)],
    obraIds: d.publicoTodos ? [] : [...new Set(d.obraIds)],
    perfilIds: d.publicoTodos ? [] : [...new Set(d.perfilIds)],
    usuarioIds: d.publicoTodos ? [] : [...new Set(d.usuarioIds)],
  };
  validarPublico(publico);
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const r = await a.db.$transaction(async (tx) => {
    const doc = await carregarDocumento(tx, documentoId);
    if (versaoLida !== undefined && versaoLida !== doc.versao) throw new ErroConflito();
    exigirTransicao(doc.status, "PUBLICADO");
    const v = await revisaoEmTrabalho(tx, doc.id);
    if (!v || v.status !== "APROVADA") throw new ErroNegocio("Só uma revisão aprovada pode ser publicada.");
    await validarIdsPublico(tx, publico);
    const agora = new Date();
    let anterior: number | null = null;
    if (doc.versaoVigenteId) {
      const old = await tx.versaoDocumento.findFirst({ where: { id: doc.versaoVigenteId } });
      const o = await tx.versaoDocumento.updateMany({ where: { id: doc.versaoVigenteId, status: "PUBLICADA" }, data: { status: "OBSOLETA", obsoletoEm: agora } });
      if (o.count === 0) throw new ErroConflito();
      anterior = old?.numero ?? null;
    }
    const u = await tx.versaoDocumento.updateMany({ where: { id: v.id, status: "APROVADA" }, data: { status: "PUBLICADA", publicadoEm: agora, publicadoPorId: a.usuarioId } });
    if (u.count === 0) throw new ErroConflito();
    await tx.publicacaoDocumento.create({
      data: {
        empresaId: a.empresaId,
        documentoId: doc.id,
        versaoId: v.id,
        ...publico,
        notificar: d.notificar,
        exigirCiencia: d.exigirCiencia,
        perguntasCiencia: d.perguntasCiencia?.length ? (d.perguntasCiencia as unknown as Prisma.InputJsonValue) : undefined,
        publicadoPorId: a.usuarioId,
        publicadoEm: agora,
      },
    });
    await travar(tx, doc, {
      status: "PUBLICADO",
      versaoVigenteId: v.id,
      proximaRevisaoEm: paraDataDb(calcularProximaReavaliacao(hoje, doc.periodicidadeRevisaoMeses)),
    });
    if (anterior !== null) {
      await historico(tx, a, doc.id, "OBSOLESCENCIA", { versaoId: doc.versaoVigenteId, observacao: `${rotuloRevisao(anterior)} substituída pela ${rotuloRevisao(v.numero)}.` });
    }
    await historico(tx, a, doc.id, "PUBLICACAO", {
      versaoId: v.id,
      observacao: `${rotuloRevisao(v.numero)} publicada${d.exigirCiencia ? " (exige ciência)" : ""}${d.notificar ? ", público notificado" : ""}.`,
      dados: { ...publico, notificar: d.notificar, exigirCiencia: d.exigirCiencia } as unknown as Prisma.InputJsonValue,
    });
    return { versaoId: v.id, numero: v.numero, codigo: doc.codigo, titulo: doc.titulo };
  });
  if (d.notificar) await notificarPublicacao(a, documentoId, r, publico, d.exigirCiencia);
  return r;
}

function notificarPublicacao(a: Ator, documentoId: string, r: { versaoId: string; numero: number; codigo: string; titulo: string }, publico: PublicoDocumento, exigirCiencia: boolean) {
  return comSeguranca("documento-publicado", async () => {
    const us = (await usuariosPublico(a)).filter((u) => estaNoPublico(publico, u));
    await criarNotificacoes(
      a.db,
      a.empresaId,
      us.map((u) => ({
        usuarioId: u.id,
        tipo: exigirCiencia ? ("CIENCIA_PENDENTE" as const) : ("DOCUMENTO_PUBLICADO" as const),
        entidadeTipo: "DOCUMENTO" as const,
        entidadeId: documentoId,
        titulo: `${exigirCiencia ? "Ciência pendente" : "Documento publicado"}: ${r.codigo} ${rotuloRevisao(r.numero)} — ${r.titulo}`,
        corpo: exigirCiencia
          ? `Foi publicada a ${rotuloRevisao(r.numero)} de ${r.codigo}. Leia o documento e confirme "Li e estou ciente".`
          : `Foi publicada a ${rotuloRevisao(r.numero)} de ${r.codigo}. Acesse o sistema para ler.`,
        link: linkDocumento(documentoId),
        chave: `documento-publicado:${r.versaoId}:${u.id}`,
      })),
    );
  });
}

// ---------------------------------------------------------------- cancelamento e obsolescência

/**
 * Cancela a revisão em trabalho (rascunho ou aprovada, sem fluxo pendente). Sem revisão vigente,
 * o documento inteiro é CANCELADO; com vigente, a vigente continua (documento volta a PUBLICADO).
 */
export async function cancelar(a: Ator, documentoId: string, motivo: string, versaoLida?: number) {
  await exigirElaborar(a);
  const m = normalizarMotivo(motivo);
  await a.db.$transaction(async (tx) => {
    const doc = await carregarDocumento(tx, documentoId);
    if (versaoLida !== undefined && versaoLida !== doc.versao) throw new ErroConflito();
    if (STATUS_EM_TRAMITACAO.includes(doc.status)) throw new ErroNegocio("Há uma aprovação pendente: cancele a solicitação em Aprovações antes.");
    const v = await revisaoEmTrabalho(tx, doc.id);
    if (!v) throw new ErroNegocio("Não há revisão em elaboração para cancelar.");
    if (v.elaboradorId !== a.usuarioId && doc.responsavelId !== a.usuarioId && !podeGerenciarDocumentos(a)) {
      throw new ErroNegocio("Somente quem elaborou, o responsável ou um gestor de documentos pode cancelar.");
    }
    const novo: StatusDocumento = doc.versaoVigenteId ? "PUBLICADO" : "CANCELADO";
    exigirTransicao(doc.status, novo);
    await tx.versaoDocumento.updateMany({ where: { id: v.id, status: { in: ["RASCUNHO", "APROVADA"] } }, data: { status: "CANCELADA" } });
    await travar(tx, doc, { status: novo });
    await historico(tx, a, doc.id, "CANCELAMENTO", { versaoId: v.id, observacao: `${doc.versaoVigenteId ? `${rotuloRevisao(v.numero)} cancelada` : "Documento cancelado"}: ${m}` });
  });
}

/** Retira o documento de uso: revisão vigente → OBSOLETA; documento OBSOLETO (DOCUMENTO_GERENCIAR). */
export async function obsoletar(a: Ator, documentoId: string, motivo: string, versaoLida?: number) {
  await exigirGerenciar(a);
  const m = normalizarMotivo(motivo);
  await a.db.$transaction(async (tx) => {
    const doc = await carregarDocumento(tx, documentoId);
    if (versaoLida !== undefined && versaoLida !== doc.versao) throw new ErroConflito();
    if (!doc.versaoVigenteId) throw new ErroNegocio("Documento sem revisão publicada: use cancelar.");
    exigirTransicao(doc.status, "OBSOLETO");
    const agora = new Date();
    await tx.versaoDocumento.updateMany({ where: { id: doc.versaoVigenteId, status: "PUBLICADA" }, data: { status: "OBSOLETA", obsoletoEm: agora } });
    await tx.versaoDocumento.updateMany({ where: { documentoId: doc.id, status: { in: ["RASCUNHO", "APROVADA"] } }, data: { status: "CANCELADA" } });
    await travar(tx, doc, { status: "OBSOLETO", versaoVigenteId: null, proximaRevisaoEm: null });
    await historico(tx, a, doc.id, "OBSOLESCENCIA", { versaoId: doc.versaoVigenteId, observacao: `Documento retirado de uso: ${m}` });
  });
}

// ---------------------------------------------------------------- ciência

/** "Li e estou ciente" da revisão vigente (só quem está no público). */
export async function registrarCiencia(a: Ator, documentoId: string) {
  await exigirModuloDocumentos(a);
  const doc = await a.db.documento.findFirst({
    where: { id: documentoId, status: { notIn: ["OBSOLETO", "CANCELADO"] } },
    select: { versaoVigenteId: true, versaoVigente: { select: { publicacao: true } } },
  });
  const pub = doc?.versaoVigente?.publicacao;
  if (!doc?.versaoVigenteId || !pub) throw new ErroNegocio("Documento sem revisão vigente publicada.");
  const u = await usuarioPublico(a, a.usuarioId);
  if (!u || !estaNoPublico(pub, u)) throw new ErroNegocio("Este documento não foi publicado para você.");
  try {
    await a.db.cienciaDocumento.create({ data: { empresaId: a.empresaId, versaoId: doc.versaoVigenteId, usuarioId: a.usuarioId } });
  } catch (e) {
    if (ehUnicoViolado(e)) throw new ErroNegocio("Você já registrou ciência desta revisão.");
    throw e;
  }
  await a.db.notificacao.updateMany({ where: { usuarioId: a.usuarioId, entidadeTipo: "DOCUMENTO", entidadeId: documentoId, tipo: "CIENCIA_PENDENTE", lidaEm: null }, data: { lidaEm: new Date() } });
}

/**
 * "Li e estou ciente" com micro-quiz de leitura: só registra a ciência (mesma regra de
 * `registrarCiencia`) se a publicação tiver perguntas e TODAS as respostas estiverem corretas —
 * o gabarito nunca é confiado ao cliente, é revalidado aqui a partir de `perguntasCiencia`.
 */
export async function registrarCienciaComQuiz(a: Ator, documentoId: string, respostas: readonly (number | null)[]) {
  await exigirModuloDocumentos(a);
  const doc = await a.db.documento.findFirst({
    where: { id: documentoId, status: { notIn: ["OBSOLETO", "CANCELADO"] } },
    select: { versaoVigenteId: true, versaoVigente: { select: { publicacao: true } } },
  });
  const pub = doc?.versaoVigente?.publicacao;
  if (!doc?.versaoVigenteId || !pub) throw new ErroNegocio("Documento sem revisão vigente publicada.");
  const perguntas = (pub.perguntasCiencia as unknown as PerguntaCiencia[] | null) ?? [];
  if (perguntas.length === 0) return registrarCiencia(a, documentoId);
  if (!respostasCorretas(perguntas, respostas.slice(0, perguntas.length))) throw new ErroNegocio("Revise suas respostas — pelo menos uma está incorreta.");
  return registrarCiencia(a, documentoId);
}

// ---------------------------------------------------------------- leitura

export interface FiltrosDocumentos {
  busca?: string;
  tipo?: string;
  status?: StatusDocumento;
  processo?: string;
  responsavel?: string;
  /** Somente com revisão periódica vencida. */
  vencidas?: boolean;
  /** Inclui obsoletos e cancelados. */
  todos?: boolean;
}

const incluirLista = {
  tipo: { select: { id: true, sigla: true, nome: true } },
  processo: { select: { id: true, codigo: true, nome: true } },
  responsavel: { select: { id: true, nome: true } },
  versaoVigente: { select: { id: true, numero: true, publicadoEm: true } },
} satisfies Prisma.DocumentoInclude;

/** Lista mestra (DOCUMENTO_ELABORAR/GERENCIAR). */
export async function listarMestra(a: Ator, f: FiltrosDocumentos = {}) {
  await exigirModuloDocumentos(a);
  if (!veListaMestra(a)) throw new ErroNegocio("Sem permissão para ver a lista mestra de documentos.");
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const busca = f.busca?.trim();
  return a.db.documento.findMany({
    where: {
      AND: [
        busca ? { OR: [{ codigo: { contains: busca, mode: "insensitive" } }, { titulo: { contains: busca, mode: "insensitive" } }] } : {},
        f.tipo ? { tipoId: f.tipo } : {},
        f.status ? { status: f.status } : f.todos ? {} : { status: { notIn: ["OBSOLETO", "CANCELADO"] } },
        f.processo === "sem" ? { processoId: null } : f.processo ? { processoId: f.processo } : {},
        f.responsavel ? { responsavelId: f.responsavel } : {},
        f.vencidas ? { versaoVigenteId: { not: null }, proximaRevisaoEm: { lt: paraDataDb(hoje) } } : {},
      ],
    },
    include: incluirLista,
    orderBy: [{ tipo: { sigla: "asc" } }, { sequencia: "asc" }],
  });
}
export type DocumentoListado = Awaited<ReturnType<typeof listarMestra>>[number];

/** Detalhe do documento; null se não existe ou sem acesso. `completo` = vê versões/trilha/ciências. */
export async function obterDocumento(a: Ator, id: string) {
  const acc = await acessoDocumento(a, id);
  if (!acc.ver) return null;
  const d = await a.db.documento.findFirst({
    where: { id },
    include: {
      ...incluirLista,
      obra: { select: { id: true, nome: true } },
      setor: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      versaoVigente: {
        select: {
          id: true,
          numero: true,
          motivo: true,
          publicadoEm: true,
          anexo: { select: { id: true, nomeArquivo: true, tamanhoBytes: true, excluidoEm: true } },
          conteudo: true,
          publicacao: true,
        },
      },
    },
  });
  if (!d) return null;
  return { ...d, acessoCompleto: acc.completo };
}

export async function listarVersoes(a: Ator, documentoId: string) {
  const acc = await acessoDocumento(a, documentoId);
  if (!acc.completo) return [];
  return a.db.versaoDocumento.findMany({
    where: { documentoId },
    include: {
      elaborador: { select: { nome: true } },
      publicadoPor: { select: { nome: true } },
      anexo: { select: { id: true, nomeArquivo: true, tamanhoBytes: true } },
      fluxoAprovacao: { select: { id: true, status: true, modo: true, etapas: { orderBy: { ordem: "asc" }, include: { aprovador: { select: { nome: true } } } }, solicitante: { select: { nome: true } }, payload: true } },
      publicacao: true,
      _count: { select: { ciencias: true } },
    },
    orderBy: { numero: "desc" },
  });
}

export async function listarHistorico(a: Ator, documentoId: string) {
  const acc = await acessoDocumento(a, documentoId);
  if (!acc.completo) return [];
  return a.db.historicoDocumento.findMany({
    where: { documentoId },
    include: { usuario: { select: { nome: true } }, versao: { select: { numero: true } } },
    orderBy: { criadoEm: "desc" },
  });
}

/** Ciências da revisão vigente: público resolvido, quem confirmou (com data) e quem falta. */
export async function situacaoCienciasDocumento(a: Ator, documentoId: string) {
  const acc = await acessoDocumento(a, documentoId);
  if (!acc.completo) return null;
  const d = await a.db.documento.findFirst({ where: { id: documentoId }, select: { versaoVigente: { select: { id: true, publicacao: true } } } });
  const pub = d?.versaoVigente?.publicacao;
  if (!d?.versaoVigente || !pub) return null;
  const [us, cs] = await Promise.all([
    usuariosPublico(a),
    a.db.cienciaDocumento.findMany({ where: { versaoId: d.versaoVigente.id }, select: { usuarioId: true, confirmadoEm: true } }),
  ]);
  const publico = us.filter((u) => estaNoPublico(pub, u));
  const s = situacaoCiencias(publico, cs.map((c) => c.usuarioId));
  const nome = new Map(us.map((u) => [u.id, u.nome]));
  const quando = new Map(cs.map((c) => [c.usuarioId, c.confirmadoEm]));
  return {
    exigirCiencia: pub.exigirCiencia,
    total: publico.length,
    confirmaram: s.confirmaram.map((id) => ({ id, nome: nome.get(id) ?? "—", em: quando.get(id)! })),
    faltam: s.faltam.map((id) => ({ id, nome: nome.get(id) ?? "—" })),
  };
}

/** "Meus documentos": revisões vigentes publicadas para o ator, com a situação da ciência dele. */
export async function meusDocumentos(a: Ator) {
  await exigirModuloDocumentos(a);
  const u = await usuarioPublico(a, a.usuarioId);
  if (!u) return [];
  const docs = await a.db.documento.findMany({
    where: { status: { notIn: ["OBSOLETO", "CANCELADO"] }, versaoVigenteId: { not: null } },
    include: {
      tipo: { select: { sigla: true, nome: true } },
      processo: { select: { codigo: true, nome: true } },
      versaoVigente: {
        select: {
          id: true,
          numero: true,
          publicadoEm: true,
          anexo: { select: { id: true, nomeArquivo: true } },
          publicacao: true,
          ciencias: { where: { usuarioId: a.usuarioId }, select: { confirmadoEm: true } },
        },
      },
    },
    orderBy: [{ tipo: { sigla: "asc" } }, { sequencia: "asc" }],
  });
  return docs
    .filter((d) => d.versaoVigente?.publicacao && estaNoPublico(d.versaoVigente.publicacao, u))
    .map((d) => {
      const v = d.versaoVigente!;
      const pub = v.publicacao!;
      return {
        id: d.id,
        codigo: d.codigo,
        titulo: d.titulo,
        tipo: d.tipo,
        processo: d.processo,
        numero: v.numero,
        publicadoEm: v.publicadoEm,
        anexo: v.anexo,
        exigirCiencia: pub.exigirCiencia,
        cienciaEm: v.ciencias[0]?.confirmadoEm ?? null,
      };
    });
}
export type MeuDocumento = Awaited<ReturnType<typeof meusDocumentos>>[number];

/** Card do dashboard: revisões vencidas (lista mestra), minhas ciências pendentes, em tramitação. null sem o módulo. */
export async function resumoDocumentos(a: Ator) {
  if (!(await moduloDocumentosAtivo(a))) return null;
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const meus = await meusDocumentos(a);
  const cienciasPendentes = meus.filter((d) => d.exigirCiencia && !d.cienciaEm).length;
  if (!veListaMestra(a)) return { mestra: false as const, cienciasPendentes, publicadosParaMim: meus.length, revisoesVencidas: 0, emTramitacao: 0, aPublicar: 0 };
  const [revisoesVencidas, emTramitacao, aPublicar] = await Promise.all([
    a.db.documento.count({ where: { status: { notIn: ["OBSOLETO", "CANCELADO"] }, versaoVigenteId: { not: null }, proximaRevisaoEm: { lt: paraDataDb(hoje) } } }),
    a.db.documento.count({ where: { status: { in: ["EM_REVISAO", "EM_APROVACAO"] } } }),
    a.db.documento.count({ where: { status: "APROVADO" } }),
  ]);
  return { mestra: true as const, cienciasPendentes, publicadosParaMim: meus.length, revisoesVencidas, emTramitacao, aPublicar };
}

/** Documentos ligados a um processo (detalhe do processo). null sem o módulo. Sem lista mestra: só os publicados para o ator. */
export async function listarDocumentosDoProcesso(a: Ator, processoId: string) {
  if (!(await moduloDocumentosAtivo(a))) return null;
  const hoje = hojeNoFuso(await fusoDaEmpresa(a));
  const docs = await a.db.documento.findMany({
    where: { processoId, status: { notIn: ["CANCELADO", "OBSOLETO"] } },
    include: { ...incluirLista, versaoVigente: { select: { id: true, numero: true, publicadoEm: true, publicacao: true } } },
    orderBy: [{ tipo: { sigla: "asc" } }, { sequencia: "asc" }],
  });
  const mestra = veListaMestra(a);
  const u = mestra ? null : await usuarioPublico(a, a.usuarioId);
  return docs
    .filter((d) => mestra || d.responsavelId === a.usuarioId || (!!u && !!d.versaoVigente?.publicacao && estaNoPublico(d.versaoVigente.publicacao, u)))
    .map((d) => ({ ...d, vencida: revisaoVencida(d.proximaRevisaoEm ? dataIso(d.proximaRevisaoEm) : null, hoje) }));
}

/** Opções das telas (tipos ativos, processos, obras, setores, perfis, usuários). */
export async function opcoesDocumentos(a: Ator) {
  const [tipos, processos, obras, setores, perfis, usuarios] = await Promise.all([
    a.db.tipoDocumentoEmpresa.findMany({ where: { ativo: true }, select: { id: true, nome: true, sigla: true, periodicidadeRevisaoMeses: true }, orderBy: { sigla: "asc" } }),
    a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
    a.db.obraUnidade.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.setor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.perfil.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    a.db.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return { tipos, processos, obras, setores, perfis, usuarios };
}
