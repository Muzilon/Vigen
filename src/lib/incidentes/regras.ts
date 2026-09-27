/** Incidentes e acidentes (P6) — regras puras: rótulos, ciclo de status, dados pessoais/restrição e indicadores. */
import type { AcaoHistoricoIncidente, GravidadeIncidente, StatusIncidente, TipoIncidente } from "@prisma/client";
import { ErroNegocio } from "@/lib/erros";

export const ROTULO_TIPO_INCIDENTE: Record<TipoIncidente, string> = {
  ACIDENTE_TIPICO: "Acidente típico",
  ACIDENTE_TRAJETO: "Acidente de trajeto",
  QUASE_ACIDENTE: "Quase-acidente",
  DOENCA_OCUPACIONAL: "Doença ocupacional",
};
export const TIPOS_INCIDENTE = Object.keys(ROTULO_TIPO_INCIDENTE) as TipoIncidente[];

export const ROTULO_GRAVIDADE_INCIDENTE: Record<GravidadeIncidente, string> = {
  SEM_AFASTAMENTO: "Sem afastamento",
  COM_AFASTAMENTO: "Com afastamento",
  FATALIDADE: "Fatalidade",
};
export const GRAVIDADES_INCIDENTE = Object.keys(ROTULO_GRAVIDADE_INCIDENTE) as GravidadeIncidente[];

export const ROTULO_STATUS_INCIDENTE: Record<StatusIncidente, string> = {
  ABERTO: "Aberto",
  EM_INVESTIGACAO: "Em investigação",
  CONCLUIDO: "Concluído",
};
export const STATUS_INCIDENTE = Object.keys(ROTULO_STATUS_INCIDENTE) as StatusIncidente[];

export const ROTULO_ACAO_INCIDENTE: Record<AcaoHistoricoIncidente, string> = {
  REGISTRO: "Registro",
  ALTERACAO: "Alteração",
  INVESTIGACAO: "Investigação / causa raiz",
  STATUS: "Status",
  PLANO: "Plano de ação",
  RESPONSAVEL: "Responsável pela investigação",
};

export type AcaoIncidente = "INICIAR_INVESTIGACAO" | "INVESTIGAR" | "CONCLUIR" | "EDITAR" | "GERAR_PLANO";

const PERMITIDO: Record<AcaoIncidente, StatusIncidente[]> = {
  INICIAR_INVESTIGACAO: ["ABERTO"],
  INVESTIGAR: ["ABERTO", "EM_INVESTIGACAO"],
  CONCLUIR: ["EM_INVESTIGACAO"],
  EDITAR: ["ABERTO", "EM_INVESTIGACAO"],
  GERAR_PLANO: ["ABERTO", "EM_INVESTIGACAO"],
};

const MENSAGEM: Record<AcaoIncidente, string> = {
  INICIAR_INVESTIGACAO: "Só é possível iniciar a investigação de um incidente aberto.",
  INVESTIGAR: "A análise de causa só pode ser registrada antes da conclusão.",
  CONCLUIR: "Só é possível concluir um incidente em investigação.",
  EDITAR: "Incidente concluído não pode ser alterado.",
  GERAR_PLANO: "Incidente concluído não recebe novo plano de ação.",
};

export function permitido(status: StatusIncidente, acao: AcaoIncidente) {
  return PERMITIDO[acao].includes(status);
}

export function exigirStatus(status: StatusIncidente, acao: AcaoIncidente) {
  if (!permitido(status, acao)) throw new ErroNegocio(MENSAGEM[acao]);
}

export interface SensiveisIncidente {
  nomeEnvolvido?: string | null;
  documentoEnvolvido?: string | null;
  funcaoEnvolvido?: string | null;
  relato?: string | null;
  lesaoDescricao?: string | null;
  testemunhasRelato?: string | null;
}

/** Algum campo sensível preenchido. */
export function temSensiveis(s: SensiveisIncidente | null | undefined) {
  return !!s && Object.values(s).some((v) => typeof v === "string" && v.trim().length > 0);
}

/**
 * Dados pessoais = envolvido (usuário ou terceiro), testemunhas ou dados sensíveis. Com dados pessoais o incidente
 * é sempre restrito (LGPD, mesmo padrão da RNC de SSO); sem eles, restrito só se marcado.
 */
export function classificarPrivacidade(d: {
  envolvidoId?: string | null;
  terceiroNome?: string | null;
  testemunhas?: string | null;
  sensiveis?: SensiveisIncidente | null;
  restrita?: boolean;
}) {
  const contemDadosPessoais = !!d.envolvidoId || !!d.terceiroNome?.trim() || !!d.testemunhas?.trim() || temSensiveis(d.sensiveis);
  return { contemDadosPessoais, restrita: !!d.restrita || contemDadosPessoais };
}

/** Taxa de frequência simples: incidentes por mês no período (1 casa decimal). */
export function taxaMensal(total: number, meses: number) {
  if (meses <= 0) return 0;
  return Math.round((total / meses) * 10) / 10;
}

export function contarPorGravidade(xs: readonly { gravidade: GravidadeIncidente }[]): Record<GravidadeIncidente, number> {
  const out: Record<GravidadeIncidente, number> = { SEM_AFASTAMENTO: 0, COM_AFASTAMENTO: 0, FATALIDADE: 0 };
  for (const x of xs) out[x.gravidade]++;
  return out;
}

export function contarPorTipo(xs: readonly { tipo: TipoIncidente }[]): Record<TipoIncidente, number> {
  const out: Record<TipoIncidente, number> = { ACIDENTE_TIPICO: 0, ACIDENTE_TRAJETO: 0, QUASE_ACIDENTE: 0, DOENCA_OCUPACIONAL: 0 };
  for (const x of xs) out[x.tipo]++;
  return out;
}

/** Título do plano: neutro quando o incidente é restrito (o plano aparece a quem gerencia planos). */
export function tituloPlanoIncidente(i: { codigo: string; restrita: boolean }, informado?: string | null) {
  if (i.restrita) return `Investigação do incidente ${i.codigo}`;
  return (informado?.trim() || `Investigação do incidente ${i.codigo}`).slice(0, 200);
}
