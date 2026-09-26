"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAtor } from "@/lib/ator-servidor";
import { marcarNotificacaoLida, marcarTodasLidas } from "@/lib/notificacoes/servico";

/** Contador do sino/sidebar vive no layout: revalida o layout inteiro. */
function revalidarContadores() {
  revalidatePath("/", "layout");
}

export async function marcarLidaAcao(fd: FormData) {
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  await marcarNotificacaoLida(await getAtor(), id.data);
  revalidarContadores();
}

/** Marca como lida e abre o link da notificação (somente caminhos internos). */
export async function abrirNotificacaoAcao(fd: FormData) {
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  const n = await marcarNotificacaoLida(await getAtor(), id.data);
  revalidarContadores();
  if (n?.link && n.link.startsWith("/") && !n.link.startsWith("//")) redirect(n.link);
}

export async function marcarTodasAcao() {
  await marcarTodasLidas(await getAtor());
  revalidarContadores();
}

/** Chamado pelo cliente após uma leitura feita durante o render (ex.: abrir thread). */
export async function revalidarContadoresAcao() {
  revalidarContadores();
}
