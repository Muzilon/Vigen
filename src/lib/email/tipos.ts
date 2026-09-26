export interface MensagemEmail {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}

export interface DriverEmail {
  nome: string;
  enviar(msg: MensagemEmail & { de: string }): Promise<void>;
}
