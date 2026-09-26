import { del, get, put } from "@vercel/blob";
import type { Armazenamento } from "./tipos";

/**
 * Driver Vercel Blob com access "private": guardamos apenas o pathname; a leitura usa o token
 * do servidor e é sempre servida pela rota autenticada (a URL do blob nunca vai ao cliente).
 */
export function criarArmazenamentoBlob(token = process.env.BLOB_READ_WRITE_TOKEN): Armazenamento {
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN não configurado para ARMAZENAMENTO=blob.");
  return {
    nome: "vercel-blob",
    async salvar(chave, dados, contentType) {
      const r = await put(chave, Buffer.from(dados), {
        access: "private",
        contentType,
        token,
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return r.pathname;
    },
    async ler(chave) {
      const r = await get(chave, { access: "private", token, useCache: false });
      if (!r || r.statusCode !== 200) return null;
      return r.stream;
    },
    async excluir(chave) {
      await del(chave, { token });
    },
  };
}
