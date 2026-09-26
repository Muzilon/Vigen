import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DriverEmail } from "./tipos";

/** Apenas registra no console (útil em produção sem provedor configurado). */
export const driverConsole: DriverEmail = {
  nome: "console",
  async enviar(m) {
    console.info(`[email] para=${m.para} assunto="${m.assunto}"`);
  },
};

/** Grava cada e-mail como .eml em ./storage/emails (padrão em desenvolvimento). */
export function driverArquivo(dir = process.env.EMAIL_DIR || path.join(process.cwd(), "storage", "emails")): DriverEmail {
  return {
    nome: "arquivo",
    async enviar(m) {
      await mkdir(dir, { recursive: true });
      const nome = `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}.eml`;
      const limite = `vigen-${Math.random().toString(36).slice(2)}`;
      const eml = [
        `From: ${m.de}`,
        `To: ${m.para}`,
        `Subject: =?UTF-8?B?${Buffer.from(m.assunto).toString("base64")}?=`,
        `Date: ${new Date().toUTCString()}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${limite}"`,
        "",
        `--${limite}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(m.texto).toString("base64"),
        `--${limite}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(m.html).toString("base64"),
        `--${limite}--`,
        "",
      ].join("\r\n");
      await writeFile(path.join(dir, nome), eml);
    },
  };
}

/** SMTP via nodemailer (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE). */
export function driverSmtp(): DriverEmail {
  let transporte: Promise<import("nodemailer").Transporter> | null = null;
  return {
    nome: "smtp",
    async enviar(m) {
      transporte ??= import("nodemailer").then((nm) =>
        nm.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        }),
      );
      await (await transporte).sendMail({ from: m.de, to: m.para, subject: m.assunto, html: m.html, text: m.texto });
    },
  };
}

/** Resend via API HTTP (RESEND_API_KEY), sem dependência extra. */
export function driverResend(): DriverEmail {
  return {
    nome: "resend",
    async enviar(m) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: m.de, to: [m.para], subject: m.assunto, html: m.html, text: m.texto }),
      });
      if (!r.ok) throw new Error(`Resend: HTTP ${r.status} ${await r.text().catch(() => "")}`);
    },
  };
}
