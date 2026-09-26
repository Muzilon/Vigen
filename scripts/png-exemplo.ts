/* Gera um PNG válido (magic bytes + IHDR/IDAT/IEND com CRC) para seed e testes de fotos. */
import { deflateSync } from "node:zlib";

const TABELA = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Uint8Array) {
  const out = new Uint8Array(12 + dados.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, dados.length);
  out.set(new TextEncoder().encode(tipo), 4);
  out.set(dados, 8);
  dv.setUint32(8 + dados.length, crc32(out.subarray(4, 8 + dados.length)));
  return out;
}

/** PNG RGB `lado`×`lado` com faixas na cor informada (placa de "evidência"). */
export function gerarPngExemplo(cor: [number, number, number] = [200, 60, 40], lado = 48): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, lado);
  dv.setUint32(4, lado);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const linhas = new Uint8Array(lado * (1 + lado * 3));
  for (let y = 0; y < lado; y++) {
    const base = y * (1 + lado * 3);
    for (let x = 0; x < lado; x++) {
      const faixa = Math.floor((x + y) / 8) % 2 === 0;
      linhas.set(faixa ? cor : [240, 240, 235], base + 1 + x * 3);
    }
  }
  const partes = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(linhas)),
    bloco("IEND", new Uint8Array(0)),
  ];
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
