/** Camada de armazenamento de arquivos (plugável). Nunca expõe URL pública: o download passa por /api/anexos/[id]. */
export interface Armazenamento {
  readonly nome: "local" | "vercel-blob";
  /** Grava o conteúdo na chave informada; devolve a chave efetivamente usada (pathname). */
  salvar(chave: string, dados: Uint8Array, contentType: string): Promise<string>;
  /** Stream do conteúdo, ou null se não existir. */
  ler(chave: string): Promise<ReadableStream<Uint8Array> | null>;
  excluir(chave: string): Promise<void>;
}
