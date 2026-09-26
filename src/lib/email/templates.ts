/** Templates HTML simples (pt-BR) para e-mails de notificação. */

export function escaparHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function urlApp(caminho = "/") {
  const base = (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

export interface ConteudoEmail {
  titulo: string;
  /** Parágrafos em texto puro (serão escapados). */
  paragrafos: string[];
  /** Linhas "rótulo: valor" opcionais. */
  itens?: { rotulo: string; valor: string }[];
  link?: string | null;
  rotuloLink?: string;
}

export function montarEmail(c: ConteudoEmail): { assunto: string; html: string; texto: string } {
  const url = c.link ? urlApp(c.link) : null;
  const ps = c.paragrafos.map((p) => `<p style="margin:0 0 12px">${escaparHtml(p)}</p>`).join("");
  const itens = c.itens?.length
    ? `<table style="border-collapse:collapse;margin:0 0 16px">${c.itens
        .map(
          (i) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escaparHtml(i.rotulo)}</td><td style="padding:4px 0;font-weight:600">${escaparHtml(i.valor)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const botao = url
    ? `<p style="margin:20px 0"><a href="${escaparHtml(url)}" style="background:#047857;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">${escaparHtml(c.rotuloLink ?? "Abrir no Vigen")}</a></p>`
    : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="font-size:22px;font-weight:700;color:#047857;margin-bottom:16px">Vigen</div>
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px">
<h1 style="font-size:18px;margin:0 0 16px">${escaparHtml(c.titulo)}</h1>${ps}${itens}${botao}
</div>
<p style="font-size:12px;color:#64748b;margin-top:16px">Você recebeu este e-mail porque é usuário do Vigen. Mensagem automática, não responda.</p>
</div></body></html>`;
  const texto = [
    c.titulo,
    "",
    ...c.paragrafos,
    ...(c.itens?.map((i) => `${i.rotulo}: ${i.valor}`) ?? []),
    ...(url ? ["", `${c.rotuloLink ?? "Abrir no Vigen"}: ${url}`] : []),
  ].join("\n");
  return { assunto: `[Vigen] ${c.titulo}`, html, texto };
}
