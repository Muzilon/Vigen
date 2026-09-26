"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAtor } from "@/lib/ator-servidor";
import { listarNotificacoes, marcarNotificacaoLida, marcarTodasLidas } from "@/lib/notificacoes/servico";

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

export interface NotificacaoPainel {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  lida: boolean;
  criadoEm: string;
}

/**
 * Dados do painel flutuante do sino: só notificações do próprio usuário
 * (listarNotificacoes filtra por usuarioId) e só os campos já exibidos.
 */
export async function listarPainelAcao(somenteNaoLidas: boolean): Promise<NotificacaoPainel[]> {
  const lista = await listarNotificacoes(await getAtor(), { somenteNaoLidas: somenteNaoLidas === true, take: 20 });
  return lista.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo,
    corpo: n.corpo,
    lida: n.lidaEm !== null,
    criadoEm: n.criadoEm.toISOString(),
  }));
}
