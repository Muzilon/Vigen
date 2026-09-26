import { describe, expect, it } from "vitest";
import {
  contentDisposition,
  detectarTipo,
  limiteBytes,
  sanitizarNome,
  validarArquivo,
} from "@/lib/anexos/validacao";

const b = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...Buffer.from(x, "latin1")] : [x])));
const JPG = b(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, "JFIF");
const PNG = b(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);
const WEBP = b("RIFF", 0, 0, 0, 0, "WEBPVP8 ");
const HEIC = b(0, 0, 0, 0x18, "ftypheic", 0, 0, 0, 0);
const PDF = b("%PDF-1.7\n");
const DOCX = b(0x50, 0x4b, 0x03, 0x04, "....[Content_Types].xml....word/document.xml");
const XLSX = b(0x50, 0x4b, 0x03, 0x04, "....[Content_Types].xml....xl/workbook.xml");
const ZIP = b(0x50, 0x4b, 0x03, 0x04, "....malware.exe");
const EXE = b("MZ", 0x90, 0, 3, 0);
const MB = 1024 * 1024;

describe("detecção de tipo por magic bytes", () => {
  it("reconhece os tipos permitidos", () => {
    expect(detectarTipo(JPG)).toBe("jpg");
    expect(detectarTipo(PNG)).toBe("png");
    expect(detectarTipo(WEBP)).toBe("webp");
    expect(detectarTipo(HEIC)).toBe("heic");
    expect(detectarTipo(PDF)).toBe("pdf");
    expect(detectarTipo(DOCX)).toBe("docx");
    expect(detectarTipo(XLSX)).toBe("xlsx");
    expect(detectarTipo(new Uint8Array(Buffer.from("olá mundo\n", "utf8")), "txt")).toBe("txt");
  });
  it("rejeita executável, zip genérico e binário como txt", () => {
    expect(detectarTipo(EXE)).toBeNull();
    expect(detectarTipo(ZIP)).toBeNull();
    expect(detectarTipo(b("abc", 0, "def"), "txt")).toBeNull();
    expect(detectarTipo(b(0xc3, 0x28), "txt")).toBeNull(); // UTF-8 inválido
  });
});

describe("validarArquivo", () => {
  it("aceita arquivo válido e devolve MIME canônico", () => {
    const r = validarArquivo("foto.JPEG", JPG);
    expect(r).toMatchObject({ ok: true, tipo: "jpg", mimeType: "image/jpeg" });
  });
  it("rejeita extensão proibida mesmo com conteúdo válido", () => {
    expect(validarArquivo("script.exe", PDF).ok).toBe(false);
    expect(validarArquivo("pagina.html", b("<html>")).ok).toBe(false);
    expect(validarArquivo("sem-extensao", PDF).ok).toBe(false);
  });
  it("rejeita extensão que não corresponde ao conteúdo (MIME forjado)", () => {
    const r = validarArquivo("relatorio.pdf", EXE);
    expect(r.ok).toBe(false);
    expect(validarArquivo("foto.png", JPG).ok).toBe(false);
    expect(validarArquivo("planilha.xlsx", DOCX).ok).toBe(false);
    expect(validarArquivo("notas.txt", PDF).ok).toBe(false);
  });
  it("aplica limite de tamanho e rejeita vazio", () => {
    const grande = new Uint8Array(10 * MB + 1);
    grande.set(PDF);
    expect(validarArquivo("a.pdf", grande, 10 * MB)).toMatchObject({ ok: false });
    expect(validarArquivo("a.pdf", grande, 11 * MB).ok).toBe(true);
    expect(validarArquivo("a.pdf", new Uint8Array(0)).ok).toBe(false);
  });
});

describe("limite por empresa", () => {
  it("padrão 10 MB; config da empresa sobrepõe (teto 50 MB)", () => {
    expect(limiteBytes({})).toBe(10 * MB);
    expect(limiteBytes(null)).toBe(10 * MB);
    expect(limiteBytes({ anexos: { tamanhoMaxMb: 5 } })).toBe(5 * MB);
    expect(limiteBytes({ anexos: { tamanhoMaxMb: 999 } })).toBe(50 * MB);
    expect(limiteBytes({ anexos: { tamanhoMaxMb: "20" } })).toBe(10 * MB);
  });
});

describe("nomes e Content-Disposition", () => {
  it("sanitiza caminho, acentos e caracteres especiais", () => {
    expect(sanitizarNome("../../etc/passwd")).toBe("passwd");
    expect(sanitizarNome("C:\\x\\Relatório Técnico (1).pdf")).toBe("Relatorio_Tecnico_1_.pdf");
    expect(sanitizarNome(".htaccess")).toBe("htaccess");
    expect(sanitizarNome("")).toBe("arquivo");
  });
  it("gera header seguro com fallback ASCII e filename* UTF-8", () => {
    const h = contentDisposition('ação"\r\nX-Evil: 1.pdf', false);
    expect(h.startsWith("attachment; ")).toBe(true);
    expect(h).not.toMatch(/[\r\n]/);
    expect(h).toContain("filename*=UTF-8''a%C3%A7%C3%A3o");
    expect(contentDisposition("f.png", true).startsWith("inline;")).toBe(true);
  });
});
