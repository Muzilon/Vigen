/** Validação de anexos (pura, sem I/O): tipo pelos magic bytes, extensão coerente, tamanho e nome. */

export const TAMANHO_MAX_PADRAO_MB = 10;
export const MAX_ARQUIVOS_POR_ENVIO = 5;

export type TipoArquivo = "jpg" | "png" | "webp" | "heic" | "pdf" | "docx" | "xlsx" | "txt";

export const MIME: Record<TipoArquivo, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
};

const EXTENSOES: Record<string, TipoArquivo> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  heic: "heic",
  heif: "heic",
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  txt: "txt",
};

/**
 * Tipos que o navegador pode exibir com segurança (inline) — o resto é sempre attachment.
 * B5: PDF fica de fora: o visualizador de PDF do navegador não funciona sob CSP "sandbox",
 * então PDF é sempre baixado (attachment) em vez de afrouxar a CSP.
 */
export const MIMES_INLINE = new Set([MIME.jpg, MIME.png, MIME.webp]);
export const MIMES_IMAGEM = new Set([MIME.jpg, MIME.png, MIME.webp, MIME.heic]);

export const ACEITAR_INPUT = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.docx,.xlsx,.txt";

const ascii = (b: Uint8Array, ini: number, fim: number) => String.fromCharCode(...b.subarray(ini, fim));
const comeca = (b: Uint8Array, sig: number[], off = 0) => b.length >= off + sig.length && sig.every((v, i) => b[off + i] === v);

function contemAscii(b: Uint8Array, s: string) {
  return Buffer.from(b.buffer, b.byteOffset, b.byteLength).includes(s, 0, "latin1");
}

function textoValido(b: Uint8Array) {
  if (b.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}

/** Detecta o tipo pelo conteúdo. `txt` só é aceito quando a extensão também é .txt. */
export function detectarTipo(b: Uint8Array, extensao?: string): TipoArquivo | null {
  if (comeca(b, [0xff, 0xd8, 0xff])) return "jpg";
  if (comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp" && ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(ascii(b, 8, 12))) {
    return "heic";
  }
  if (comeca(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (comeca(b, [0x50, 0x4b, 0x03, 0x04])) {
    // OOXML: ZIP com [Content_Types].xml e a pasta do documento.
    if (!contemAscii(b, "[Content_Types].xml")) return null;
    if (contemAscii(b, "word/")) return "docx";
    if (contemAscii(b, "xl/")) return "xlsx";
    return null;
  }
  if (extensao === "txt" && textoValido(b)) return "txt";
  return null;
}

export function extensaoDe(nome: string) {
  const m = /\.([a-z0-9]+)$/i.exec(nome.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Nome seguro para chave de armazenamento e Content-Disposition (sem caminho, controle ou caracteres especiais). */
export function sanitizarNome(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const limpo = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "");
  const ext = extensaoDe(limpo);
  const semExt = ext ? limpo.slice(0, -(ext.length + 1)) : limpo;
  const corpo = (semExt || "arquivo").slice(0, 80);
  return ext ? `${corpo}.${ext}` : corpo;
}

/** Nome de exibição (preserva acentos; remove caminho e caracteres de controle). */
export function nomeExibicao(nome: string) {
  const base = (nome.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  return (base || "arquivo").slice(0, 200);
}

export function limiteBytes(configEmpresa: unknown): number {
  const mb = (configEmpresa as { anexos?: { tamanhoMaxMb?: unknown } } | null)?.anexos?.tamanhoMaxMb;
  const n = typeof mb === "number" && Number.isFinite(mb) && mb > 0 ? Math.min(mb, 50) : TAMANHO_MAX_PADRAO_MB;
  return Math.floor(n * 1024 * 1024);
}

export type ResultadoValidacao =
  | { ok: true; tipo: TipoArquivo; mimeType: string; nomeSanitizado: string; nome: string }
  | { ok: false; erro: string };

export function validarArquivo(nome: string, dados: Uint8Array, limite: number = TAMANHO_MAX_PADRAO_MB * 1024 * 1024): ResultadoValidacao {
  const exib = nomeExibicao(nome);
  if (dados.byteLength === 0) return { ok: false, erro: `${exib}: arquivo vazio.` };
  if (dados.byteLength > limite) {
    return { ok: false, erro: `${exib}: excede o limite de ${Math.round(limite / 1024 / 1024)} MB.` };
  }
  const ext = extensaoDe(exib);
  const tipoExt = EXTENSOES[ext];
  if (!tipoExt) return { ok: false, erro: `${exib}: tipo de arquivo não permitido.` };
  const tipo = detectarTipo(dados, ext);
  if (!tipo) return { ok: false, erro: `${exib}: conteúdo não corresponde a um tipo permitido.` };
  if (tipo !== tipoExt) return { ok: false, erro: `${exib}: a extensão não corresponde ao conteúdo do arquivo.` };
  return { ok: true, tipo, mimeType: MIME[tipo], nomeSanitizado: sanitizarNome(exib), nome: exib };
}

/** Content-Disposition seguro (RFC 6266 / 5987). */
export function contentDisposition(nome: string, inline: boolean) {
  const fallback = sanitizarNome(nome).replace(/"/g, "");
  const utf8 = encodeURIComponent(nomeExibicao(nome)).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${utf8}`;
}
