/**
 * Gera um PDF mínimo válido (1 página, Helvetica) com título e linhas de texto — usado pelo seed e
 * pelos testes para anexar arquivos reais às revisões de documentos (passa na validação por magic bytes).
 */
export function gerarPdfExemplo(titulo: string, linhas: string[] = []): Uint8Array {
  const esc = (t: string) =>
    t
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7e]/g, "?")
      .replace(/[()\\]/g, "\\$&");
  const texto = [
    `BT /F1 16 Tf 60 780 Td (${esc(titulo)}) Tj ET`,
    ...linhas.map((l, i) => `BT /F1 11 Tf 60 ${748 - i * 16} Td (${esc(l)}) Tj ET`),
  ].join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(texto, "latin1")} >>\nstream\n${texto}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
