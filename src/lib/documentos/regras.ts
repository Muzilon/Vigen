/**
 * Tramitação de Documentos (ISO 9001 7.5) — regras puras (sem banco): código, número de revisão,
 * máquina de status do documento, público da publicação e ciências pendentes. Testadas em
 * tests/documentos.test.ts. Rótulos sem dependência de runtime do Prisma (usáveis em client).
 */
import type { AcaoHistoricoDocumento, StatusDocumento, StatusVersaoDocumento } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const MAX_TITULO = 200;
export const MAX_MOTIVO = 1000;
export const PERIODICIDADE_MIN = 1;
export const PERIODICIDADE_MAX = 120;

// ---------------------------------------------------------------- código e revisão

/** Sigla do tipo: 1–6 letras maiúsculas/dígitos (PR, IT, FO, POL, MAN...). */
export function normalizarSigla(s: string): string {
  const t = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(t)) throw new ErroNegocio("Sigla inválida: use de 1 a 6 letras ou números (ex.: PR, IT, FO).");
  return t;
}

/** PR-001 (sequência por tipo; 3 dígitos mínimos, cresce se passar de 999). */
export function formatarCodigoDocumento(sigla: string, sequencia: number): string {
  if (!Number.isInteger(sequencia) || sequencia < 1) throw new ErroNegocio("Sequência inválida.");
  return `${sigla}-${String(sequencia).padStart(3, "0")}`;
}

/** Revisão 00, 01, ... */
export function formatarRevisao(numero: number): string {
  if (!Number.isInteger(numero) || numero < 0) throw new ErroNegocio("Número de revisão inválido.");
  return String(numero).padStart(2, "0");
}

export const rotuloRevisao = (numero: number) => `Rev. ${formatarRevisao(numero)}`;

export function validarPeriodicidade(meses: number) {
  if (!Number.isInteger(meses) || meses < PERIODICIDADE_MIN || meses > PERIODICIDADE_MAX) {
    throw new ErroNegocio(`Periodicidade de revisão entre ${PERIODICIDADE_MIN} e ${PERIODICIDADE_MAX} meses.`);
  }
}

export function normalizarMotivo(m: string | null | undefined): string {
  const t = (m ?? "").trim();
  if (!t) throw new ErroNegocio("Informe o motivo/descrição da alteração.");
  if (t.length > MAX_MOTIVO) throw new ErroNegocio(`Motivo com no máximo ${MAX_MOTIVO} caracteres.`);
  return t;
}

// ---------------------------------------------------------------- status

/**
 * Transições permitidas do documento. O status reflete a revisão em trabalho; a revisão vigente
 * (publicada) continua valendo enquanto uma nova revisão tramita.
 * - ELABORACAO → EM_REVISAO/EM_APROVACAO (envio), CANCELADO (sem vigente), PUBLICADO (revisão
 *   cancelada com vigente), OBSOLETO (retirar de uso com vigente)
 * - EM_REVISAO → EM_APROVACAO (revisores assinaram), APROVADO (fluxo só de revisores), ELABORACAO (rejeição/cancelamento)
 * - EM_APROVACAO → APROVADO, ELABORACAO
 * - APROVADO → PUBLICADO, CANCELADO, OBSOLETO
 * - PUBLICADO → ELABORACAO (nova revisão), OBSOLETO
 * - OBSOLETO, CANCELADO: finais
 */
export const TRANSICOES_DOCUMENTO: Record<StatusDocumento, readonly StatusDocumento[]> = {
  ELABORACAO: ["EM_REVISAO", "EM_APROVACAO", "CANCELADO", "PUBLICADO", "OBSOLETO"],
  EM_REVISAO: ["EM_APROVACAO", "APROVADO", "ELABORACAO"],
  EM_APROVACAO: ["APROVADO", "ELABORACAO"],
  APROVADO: ["PUBLICADO", "CANCELADO", "OBSOLETO"],
  PUBLICADO: ["ELABORACAO", "OBSOLETO", "PUBLICADO"],
  OBSOLETO: [],
  CANCELADO: [],
};

export function podeTransitar(de: StatusDocumento, para: StatusDocumento) {
  return TRANSICOES_DOCUMENTO[de].includes(para);
}

export function exigirTransicao(de: StatusDocumento, para: StatusDocumento) {
  if (!podeTransitar(de, para)) {
    throw new ErroNegocio(`Operação não permitida: documento "${ROTULO_STATUS_DOCUMENTO[de]}" não pode passar para "${ROTULO_STATUS_DOCUMENTO[para]}".`);
  }
}

export const STATUS_FINAIS_DOCUMENTO: readonly StatusDocumento[] = ["OBSOLETO", "CANCELADO"];
/** Documento com revisão em tramitação (não aceita nova revisão nem edição do rascunho). */
export const STATUS_EM_TRAMITACAO: readonly StatusDocumento[] = ["EM_REVISAO", "EM_APROVACAO"];

/** Status ao enviar para o fluxo: com revisores começa EM_REVISAO; só aprovadores, EM_APROVACAO. */
export const statusAoEnviar = (nRevisores: number): StatusDocumento => (nRevisores > 0 ? "EM_REVISAO" : "EM_APROVACAO");

/** Após uma assinatura intermediária: todos os revisores assinaram → EM_APROVACAO. */
export function statusAposAssinatura(atual: StatusDocumento, revisorIds: readonly string[], etapas: readonly { aprovadorId: string; status: string }[]): StatusDocumento {
  if (atual !== "EM_REVISAO") return atual;
  const revisoes = etapas.filter((e) => revisorIds.includes(e.aprovadorId));
  return revisoes.every((e) => e.status === "APROVADA") ? "EM_APROVACAO" : "EM_REVISAO";
}

/** Lista única do fluxo (revisores primeiro, depois aprovadores), sem repetição. */
export function montarSignatarios(revisorIds: readonly string[], aprovadorIds: readonly string[]): string[] {
  const todos = [...revisorIds, ...aprovadorIds];
  if (aprovadorIds.length === 0) throw new ErroNegocio("Informe ao menos um aprovador.");
  if (new Set(todos).size !== todos.length) throw new ErroNegocio("A mesma pessoa não pode ser revisora e aprovadora (ou aparecer duas vezes).");
  return todos;
}

// ---------------------------------------------------------------- público

export interface PublicoDocumento {
  publicoTodos: boolean;
  setorIds: readonly string[];
  obraIds: readonly string[];
  perfilIds: readonly string[];
  usuarioIds: readonly string[];
}

/** Dados do usuário relevantes para o público: setor, perfil e obras (todasObras = escopo TODAS). */
export interface UsuarioPublico {
  id: string;
  setorId: string | null;
  perfilId: string | null;
  todasObras: boolean;
  obraIds: readonly string[];
}

/** Público vazio (nenhum critério) é inválido. */
export function validarPublico(p: PublicoDocumento) {
  if (p.publicoTodos) return;
  if (p.setorIds.length + p.obraIds.length + p.perfilIds.length + p.usuarioIds.length === 0) {
    throw new ErroNegocio("Escolha o público da publicação: todos ou ao menos um setor, unidade, perfil ou usuário.");
  }
}

/**
 * O usuário está no público? União dos critérios: todos, usuário listado, setor, perfil ou obra
 * (usuário com acesso a todas as obras entra em qualquer publicação por obra).
 */
export function estaNoPublico(p: PublicoDocumento, u: UsuarioPublico): boolean {
  if (p.publicoTodos) return true;
  if (p.usuarioIds.includes(u.id)) return true;
  if (u.setorId && p.setorIds.includes(u.setorId)) return true;
  if (u.perfilId && p.perfilIds.includes(u.perfilId)) return true;
  if (p.obraIds.length > 0 && (u.todasObras || p.obraIds.some((o) => u.obraIds.includes(o)))) return true;
  return false;
}

/** Ciências: quem do público já confirmou e quem falta (ids em ordem da lista de usuários). */
export function situacaoCiencias(publico: readonly UsuarioPublico[], confirmados: readonly string[]) {
  const ok = new Set(confirmados);
  return {
    confirmaram: publico.filter((u) => ok.has(u.id)).map((u) => u.id),
    faltam: publico.filter((u) => !ok.has(u.id)).map((u) => u.id),
  };
}

/** Revisão periódica vencida: data (YYYY-MM-DD) anterior a hoje. */
export const revisaoVencida = (proxima: string | null, hoje: string) => !!proxima && proxima < hoje;

// ---------------------------------------------------------------- rótulos

export const ROTULO_STATUS_DOCUMENTO: Record<StatusDocumento, string> = {
  ELABORACAO: "Em elaboração",
  EM_REVISAO: "Em revisão",
  EM_APROVACAO: "Em aprovação",
  APROVADO: "Aprovado (a publicar)",
  PUBLICADO: "Publicado",
  OBSOLETO: "Obsoleto",
  CANCELADO: "Cancelado",
};

export const STATUS_DOCUMENTO = Object.keys(ROTULO_STATUS_DOCUMENTO) as StatusDocumento[];

export const ROTULO_STATUS_VERSAO: Record<StatusVersaoDocumento, string> = {
  RASCUNHO: "Rascunho",
  EM_APROVACAO: "Em aprovação",
  APROVADA: "Aprovada",
  PUBLICADA: "Vigente",
  OBSOLETA: "Obsoleta",
  CANCELADA: "Cancelada",
};

export const ROTULO_ACAO_DOCUMENTO: Record<AcaoHistoricoDocumento, string> = {
  CRIACAO: "Criação",
  ALTERACAO_DADOS: "Dados alterados",
  NOVA_REVISAO: "Nova revisão",
  ARQUIVO_SUBSTITUIDO: "Arquivo substituído",
  ENVIO_APROVACAO: "Enviado para revisão/aprovação",
  REVISADO: "Revisão concluída",
  APROVACAO: "Aprovado",
  REJEICAO: "Rejeitado",
  CANCELAMENTO_APROVACAO: "Aprovação cancelada",
  PUBLICACAO: "Publicado",
  OBSOLESCENCIA: "Tornado obsoleto",
  CANCELAMENTO: "Cancelado",
  REVISAO_PLANILHA: "Revisão da planilha controlada",
};
