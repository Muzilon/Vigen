/** Erro de regra de negócio: mensagem exibível ao usuário. */
export class ErroNegocio extends Error {}

export class ErroConflito extends ErroNegocio {
  constructor() {
    super("Este registro foi alterado por outra pessoa. Recarregue a página e tente novamente.");
  }
}
