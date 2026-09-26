/**
 * Registro de fontes de reavaliação: cada módulo (Riscos, HIRA, LAIA...) registra como listar
 * o que vence. O cron diário (src/lib/notificacoes/cron.ts) chama gerarAlertasReavaliacao
 * por empresa, só para os módulos ativos dela, e cria REAVALIACAO_PROXIMA idempotente.
 */
import type { Modulo, TipoNotificacao } from "@prisma/client";
import type { DbTenant } from "@/lib/db-tenant";
import { criarNotificacoes, type NovaNotificacao } from "@/lib/notificacoes/servico";
import { deveAlertarReavaliacao, type ModoReavaliacao } from "./regras";

export const DIAS_ANTECEDENCIA_REAVALIACAO = 15;

export interface EmpresaReavaliacao {
  id: string;
  fusoHorario: string;
  modulosAtivos: readonly Modulo[];
}

export interface ItemReavaliacao {
  /** Id do registro (linha no modo ITEM, planilha/cabeçalho no modo GERAL). */
  entidadeId: string;
  modo: ModoReavaliacao;
  /** YYYY-MM-DD. */
  dataReavaliacao: string;
  /** Texto curto, sem dados sensíveis. */
  titulo: string;
  link: string;
  /** Quem recebe o alerta (responsáveis). */
  usuarioIds: string[];
}

export interface FonteReavaliacao {
  modulo: Modulo;
  /** Tipo da notificação (padrão REAVALIACAO_PROXIMA; Documentos usa REVISAO_DOCUMENTO_PROXIMA). */
  tipoNotificacao?: Extract<TipoNotificacao, "REAVALIACAO_PROXIMA" | "REVISAO_DOCUMENTO_PROXIMA">;
  listarVencendo(db: DbTenant, empresa: EmpresaReavaliacao, hoje: string, diasAntecedencia: number): Promise<ItemReavaliacao[]>;
}

const fontes = new Map<string, FonteReavaliacao>();

/** `chave` distingue várias fontes do mesmo módulo (padrão: o próprio módulo). */
export function registrarFonteReavaliacao(fonte: FonteReavaliacao, chave: string = fonte.modulo) {
  fontes.set(chave, fonte);
}

export function removerFonteReavaliacao(chave: string) {
  fontes.delete(chave);
}

export function fontesReavaliacao(modulosAtivos?: readonly Modulo[]): FonteReavaliacao[] {
  const todas = [...fontes.values()];
  return modulosAtivos ? todas.filter((f) => modulosAtivos.includes(f.modulo)) : todas;
}

/** Monta as notificações (puro). Chave idempotente por módulo+registro+data+usuário. */
export function montarNotificacoesReavaliacao(
  modulo: Modulo,
  itens: readonly ItemReavaliacao[],
  hoje: string,
  dias: number,
  tipo: NonNullable<FonteReavaliacao["tipoNotificacao"]> = "REAVALIACAO_PROXIMA",
): NovaNotificacao[] {
  const doc = tipo === "REVISAO_DOCUMENTO_PROXIMA";
  const out: NovaNotificacao[] = [];
  for (const i of itens) {
    if (!deveAlertarReavaliacao(i.dataReavaliacao, hoje, dias)) continue;
    const vencida = i.dataReavaliacao < hoje;
    const data = i.dataReavaliacao.split("-").reverse().join("/");
    for (const uid of new Set(i.usuarioIds)) {
      out.push({
        usuarioId: uid,
        tipo,
        titulo: doc ? `${vencida ? "Revisão de documento vencida" : "Revisão de documento próxima"}: ${i.titulo}` : `${vencida ? "Reavaliação vencida" : "Reavaliação próxima"}: ${i.titulo}`,
        corpo: doc
          ? `A revisão periódica do documento ${vencida ? "venceu em" : "está prevista para"} ${data}.`
          : `${i.modo === "GERAL" ? "Revisão geral" : "Reavaliação do item"} ${vencida ? "venceu em" : "prevista para"} ${data}.`,
        link: i.link,
        chave: `reavaliacao:${modulo}:${i.entidadeId}:${i.dataReavaliacao}:${uid}`,
      });
    }
  }
  return out;
}

/** Executa todas as fontes dos módulos ativos da empresa. Erro de uma fonte não para as demais. */
export async function gerarAlertasReavaliacao(db: DbTenant, empresa: EmpresaReavaliacao, hoje: string, diasAntecedencia = DIAS_ANTECEDENCIA_REAVALIACAO) {
  let criadas = 0;
  for (const f of fontesReavaliacao(empresa.modulosAtivos)) {
    try {
      const itens = await f.listarVencendo(db, empresa, hoje, diasAntecedencia);
      criadas += (await criarNotificacoes(db, empresa.id, montarNotificacoesReavaliacao(f.modulo, itens, hoje, diasAntecedencia, f.tipoNotificacao))).length;
    } catch (e) {
      console.error(`[reavaliacao] fonte ${f.modulo} falhou (empresa ${empresa.id})`, e);
    }
  }
  return criadas;
}
