import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { Armazenamento } from "./tipos";

/** Driver local (dev): grava em ./storage (fora de public/, ignorado pelo git). */
export function criarArmazenamentoLocal(raiz = process.env.ARMAZENAMENTO_DIR || path.join(process.cwd(), "storage")): Armazenamento {
  const base = path.resolve(raiz);
  const resolver = (chave: string) => {
    const p = path.resolve(base, chave);
    if (!p.startsWith(base + path.sep)) throw new Error("Chave de armazenamento inválida.");
    return p;
  };
  return {
    nome: "local",
    async salvar(chave, dados) {
      const p = resolver(chave);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, dados, { flag: "wx" });
      return chave;
    },
    async ler(chave) {
      const p = resolver(chave);
      try {
        if (!(await stat(p)).isFile()) return null;
      } catch {
        return null;
      }
      return Readable.toWeb(createReadStream(p)) as ReadableStream<Uint8Array>;
    },
    async excluir(chave) {
      await rm(resolver(chave), { force: true });
    },
  };
}
