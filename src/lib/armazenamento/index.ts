import { randomUUID } from "node:crypto";
import { criarArmazenamentoLocal } from "./local";
import type { Armazenamento } from "./tipos";
import { criarArmazenamentoBlob } from "./vercel-blob";

export type { Armazenamento } from "./tipos";

let instancia: Armazenamento | null = null;

/** ARMAZENAMENTO=blob (+ BLOB_READ_WRITE_TOKEN) usa Vercel Blob; caso contrário, disco local. */
export function getArmazenamento(): Armazenamento {
  if (!instancia) instancia = process.env.ARMAZENAMENTO === "blob" ? criarArmazenamentoBlob() : criarArmazenamentoLocal();
  return instancia;
}

/** Para testes. */
export function definirArmazenamento(a: Armazenamento | null) {
  instancia = a;
}

/** {empresaId}/{entidadeTipo}/{uuid}-{nomeSanitizado} */
export function montarChave(empresaId: string, entidadeTipo: string, nomeSanitizado: string) {
  return `${empresaId}/${entidadeTipo}/${randomUUID()}-${nomeSanitizado}`;
}
