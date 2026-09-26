/**
 * Registra TODOS os handlers de aprovação dos módulos. Os handlers se registram por efeito
 * colateral do import; sem isto, aprovar pela tela /aprovacoes (processo do servidor que nunca
 * carregou o módulo) concluiria o fluxo sem aplicar a alteração. Importe este arquivo em todo
 * ponto de entrada que chame decidir()/solicitarAprovacao() — actions de /aprovacoes e dos
 * módulos, scripts de teste. Novo módulo com handler: acrescente o import aqui.
 */
import "@/lib/processos/aprovacao";
import "@/lib/riscos/aprovacao";
import "@/lib/hira/aprovacao";
import "@/lib/laia/aprovacao";
import "@/lib/documentos/aprovacao";
import { obterHandlerAprovacao } from "./registry";

/** Tipos com handler de produção (conferido nos testes). */
export const TIPOS_COM_HANDLER = ["PROCESSO", "RISCO_OPORTUNIDADE", "HIRA", "LAIA", "DOCUMENTO"] as const;

export function handlersRegistrados() {
  return TIPOS_COM_HANDLER.filter((t) => !!obterHandlerAprovacao(t));
}
