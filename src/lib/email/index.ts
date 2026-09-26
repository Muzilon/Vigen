import { driverArquivo, driverConsole, driverResend, driverSmtp } from "./drivers";
import type { DriverEmail, MensagemEmail } from "./tipos";

export type { MensagemEmail } from "./tipos";

let driver: DriverEmail | null = null;

/**
 * EMAIL_DRIVER: "arquivo" (padrão fora de produção), "console" (padrão em produção),
 * "smtp" ou "resend".
 */
export function obterDriverEmail(): DriverEmail {
  if (driver) return driver;
  const nome = process.env.EMAIL_DRIVER || (process.env.NODE_ENV === "production" ? "console" : "arquivo");
  switch (nome) {
    case "smtp":
      driver = driverSmtp();
      break;
    case "resend":
      driver = driverResend();
      break;
    case "console":
      driver = driverConsole;
      break;
    case "arquivo":
      driver = driverArquivo();
      break;
    default:
      throw new Error(`EMAIL_DRIVER desconhecido: ${nome}`);
  }
  return driver;
}

/** Para testes. */
export function definirDriverEmail(d: DriverEmail | null) {
  driver = d;
}

export function remetente() {
  return process.env.EMAIL_REMETENTE || "Vigen <nao-responda@vigen.local>";
}

export async function enviarEmail(msg: MensagemEmail): Promise<void> {
  await obterDriverEmail().enviar({ ...msg, de: remetente() });
}
