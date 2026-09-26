/**
 * Acesso da Tramitação de Documentos (sem dependência de anexos/interações, para evitar ciclos).
 * - Lista mestra e todos os documentos: DOCUMENTO_ELABORAR ou DOCUMENTO_GERENCIAR.
 * - Demais usuários: só documentos cuja revisão vigente foi publicada para eles (público), os que
 *   são responsáveis e os que estão num fluxo de aprovação do documento como signatários.
 * Tudo exige o módulo DOCUMENTOS contratado.
 */
import type { Ator } from "@/lib/ator";
import { atorTem } from "@/lib/ator";
import { ErroNegocio } from "@/lib/erros";
import { estaNoPublico, type UsuarioPublico } from "./regras";

type Leitor = Pick<Ator, "db" | "empresaId" | "usuarioId" | "permissoes">;

export async function moduloDocumentosAtivo(a: Pick<Ator, "db" | "empresaId">): Promise<boolean> {
  const e = await a.db.empresa.findFirst({ where: { id: a.empresaId }, select: { modulosAtivos: true } });
  return !!e?.modulosAtivos.includes("DOCUMENTOS");
}

export async function exigirModuloDocumentos(a: Pick<Ator, "db" | "empresaId">) {
  if (!(await moduloDocumentosAtivo(a))) throw new ErroNegocio("Módulo Documentos não contratado para esta empresa.");
}

export const podeGerenciarDocumentos = (a: Pick<Ator, "permissoes">) => atorTem(a, "DOCUMENTO_GERENCIAR");
export const podeElaborarDocumentos = (a: Pick<Ator, "permissoes">) => atorTem(a, "DOCUMENTO_ELABORAR") || atorTem(a, "DOCUMENTO_GERENCIAR");
/** Vê a lista mestra (todos os documentos, inclusive em elaboração). */
export const veListaMestra = podeElaborarDocumentos;

/** Dados de público de um usuário (setor, perfil, obras). */
export async function usuarioPublico(a: Pick<Ator, "db">, usuarioId: string): Promise<UsuarioPublico | null> {
  const u = await a.db.usuario.findFirst({
    where: { id: usuarioId, ativo: true },
    select: { id: true, setorId: true, perfilId: true, escopoObras: true, acessosObra: { select: { obraId: true } } },
  });
  if (!u) return null;
  return { id: u.id, setorId: u.setorId, perfilId: u.perfilId, todasObras: u.escopoObras === "TODAS", obraIds: u.acessosObra.map((x) => x.obraId) };
}

/** Usuários ativos da empresa com os dados de público (para resolver destinatários/ciências). */
export async function usuariosPublico(a: Pick<Ator, "db">) {
  const us = await a.db.usuario.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, setorId: true, perfilId: true, escopoObras: true, acessosObra: { select: { obraId: true } } },
    orderBy: { nome: "asc" },
  });
  return us.map((u) => ({ id: u.id, nome: u.nome, setorId: u.setorId, perfilId: u.perfilId, todasObras: u.escopoObras === "TODAS", obraIds: u.acessosObra.map((x) => x.obraId) }));
}

/** O ator está no público da publicação da revisão vigente do documento? */
export async function noPublicoDaVigente(a: Leitor, documentoId: string): Promise<boolean> {
  const d = await a.db.documento.findFirst({
    where: { id: documentoId, status: { notIn: ["OBSOLETO", "CANCELADO"] }, versaoVigenteId: { not: null } },
    select: { versaoVigente: { select: { publicacao: true } } },
  });
  const pub = d?.versaoVigente?.publicacao;
  if (!pub) return false;
  const u = await usuarioPublico(a, a.usuarioId);
  return !!u && estaNoPublico(pub, u);
}

/** Signatário (revisor/aprovador) de algum fluxo do documento. */
async function signatario(a: Leitor, documentoId: string) {
  const n = await a.db.fluxoAprovacao.count({ where: { entidadeTipo: "DOCUMENTO", entidadeId: documentoId, etapas: { some: { aprovadorId: a.usuarioId } } } });
  return n > 0;
}

export interface AcessoDocumento {
  /** Vê tudo do documento (versões, trilha, ciências, histórico). */
  completo: boolean;
  /** Vê o documento (ao menos a revisão vigente). */
  ver: boolean;
}

export async function acessoDocumento(a: Leitor, documentoId: string): Promise<AcessoDocumento> {
  if (!(await moduloDocumentosAtivo(a))) return { completo: false, ver: false };
  const d = await a.db.documento.findFirst({ where: { id: documentoId }, select: { responsavelId: true } });
  if (!d) return { completo: false, ver: false };
  if (veListaMestra(a) || d.responsavelId === a.usuarioId) return { completo: true, ver: true };
  if (await signatario(a, documentoId)) return { completo: true, ver: true };
  return { completo: false, ver: await noPublicoDaVigente(a, documentoId) };
}

/**
 * Leitura do arquivo de uma revisão (anexo DOCUMENTO_VERSAO): acesso completo ao documento; o
 * público só lê a revisão vigente.
 */
export async function podeLerVersao(a: Leitor, versaoId: string): Promise<{ ler: boolean; documentoId: string | null; status: string | null }> {
  const v = await a.db.versaoDocumento.findFirst({ where: { id: versaoId }, select: { documentoId: true, status: true, vigenteDe: { select: { id: true } } } });
  if (!v) return { ler: false, documentoId: null, status: null };
  const acc = await acessoDocumento(a, v.documentoId);
  if (acc.completo) return { ler: true, documentoId: v.documentoId, status: v.status };
  return { ler: acc.ver && !!v.vigenteDe && v.status === "PUBLICADA", documentoId: v.documentoId, status: v.status };
}
