/** Evento para notificação externa (e-mail, push...). */
export type EventoNotificacao = {
  tipo: "INTERACAO_CRIADA";
  empresaId: string;
  interacaoId: string;
  destinatarioId: string | null;
  autorId: string;
  entidadeTipo: "RNC" | "ITEM_ACAO";
  entidadeId: string;
};

/**
 * Ponto de extensão para notificações fora do sistema. Hoje não envia nada
 * (as mensagens aparecem na caixa "Mensagens"). Plugar aqui o envio de e-mail/fila.
 * Nunca deve lançar erro para o chamador.
 */
export async function notificar(evento: EventoNotificacao): Promise<void> {
  void evento;
}
