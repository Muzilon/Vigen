"use server";

import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import "@/lib/aprovacao/handlers";
import * as proc from "@/lib/processos/servico";
import { executar, obj, opcional, uuid, uuidOpcional, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/processos", ...(id ? [`/processos/${id}`] : [])];

const esquemaProcesso = z.object({
  id: uuidOpcional,
  revisao: versao,
  codigo: z.string().trim().min(1, "Informe o código.").max(20, "Código com no máximo 20 caracteres."),
  nome: z.string().trim().min(2, "Informe o nome do processo.").max(150, "Nome com no máximo 150 caracteres."),
  tipo: z.enum(["GESTAO", "FINALISTICO", "APOIO"], "Tipo inválido."),
  donoId: uuidOpcional,
  objetivo: opcional,
  entradas: opcional,
  saidas: opcional,
  fornecedores: opcional,
  clientes: opcional,
  recursos: opcional,
  /** Só vem da planilha (nomes, um por linha). Ausente = não mexe nos indicadores. */
  indicadores: z.string().optional(),
});

/** Cria (sem id) ou edita (com id) uma linha da planilha / o formulário do detalhe. */
export async function salvarProcessoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const bruto = obj(fd);
  const d = esquemaProcesso.safeParse(bruto);
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  const { id, revisao, ...dados } = d.data;
  // Campos que o formulário não enviou ficam como estão (a planilha não tem objetivo/recursos).
  return executar(async () => {
    const a = await getAtor();
    if (!id) {
      await proc.criarProcesso(a, dados);
      return { ok: "Processo criado." };
    }
    const atual = await proc.obterProcesso(a, id);
    if (!atual) return { erro: "Processo não encontrado." };
    const manter = <K extends "objetivo" | "recursos" | "entradas" | "saidas" | "fornecedores" | "clientes">(k: K) =>
      k in bruto ? dados[k] : atual[k];
    await proc.editarProcesso(
      a,
      id,
      {
        ...dados,
        donoId: "donoId" in bruto ? dados.donoId : atual.donoId,
        objetivo: manter("objetivo"),
        recursos: manter("recursos"),
        entradas: manter("entradas"),
        saidas: manter("saidas"),
        fornecedores: manter("fornecedores"),
        clientes: manter("clientes"),
      },
      revisao,
    );
    return { ok: "Processo salvo." };
  }, caminhos(id));
}

export async function moverProcessoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z.object({ id: uuid, direcao: z.enum(["cima", "baixo"]) }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await proc.moverProcesso(await getAtor(), d.data.id, d.data.direcao);
    return { ok: "Ordem atualizada." };
  }, caminhos(d.data.id));
}

export async function moverTipoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z.object({ id: uuid, tipo: z.enum(["GESTAO", "FINALISTICO", "APOIO"]) }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await proc.moverTipo(await getAtor(), d.data.id, d.data.tipo);
    return { ok: "Processo movido." };
  }, caminhos(d.data.id));
}

export async function definirAtivoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z.object({ id: uuid, ativo: z.enum(["true", "false"]) }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    const ativo = d.data.ativo === "true";
    await proc.definirAtivo(await getAtor(), d.data.id, ativo);
    return { ok: ativo ? "Processo reativado." : "Processo inativado." };
  }, caminhos(d.data.id));
}

export async function adicionarIndicadorAcao(_: ResultadoAcao, fd: FormData) {
  const d = z
    .object({ processoId: uuid, nome: z.string().trim().min(1, "Informe o nome do indicador."), meta: opcional, unidade: opcional, periodicidade: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  return executar(async () => {
    await proc.adicionarIndicador(await getAtor(), d.data.processoId, d.data);
    return { ok: "Indicador adicionado." };
  }, caminhos(d.data.processoId));
}

export async function removerIndicadorAcao(_: ResultadoAcao, fd: FormData) {
  const d = z.object({ id: uuid, processoId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await proc.removerIndicador(await getAtor(), d.data.id);
    return { ok: "Indicador removido." };
  }, caminhos(d.data.processoId));
}

export async function adicionarInteracaoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z
    .object({ processoId: uuid, outroId: uuid, sentido: z.enum(["saida", "entrada"]), descricao: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: "Escolha o outro processo." };
  const { processoId, outroId, sentido, descricao } = d.data;
  return executar(async () => {
    const [origem, destino] = sentido === "saida" ? [processoId, outroId] : [outroId, processoId];
    await proc.adicionarInteracao(await getAtor(), origem, destino, descricao);
    return { ok: "Interação adicionada." };
  }, [...caminhos(processoId), `/processos/${outroId}`]);
}

export async function removerInteracaoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z.object({ id: uuid, processoId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await proc.removerInteracao(await getAtor(), d.data.id);
    return { ok: "Interação removida." };
  }, caminhos(d.data.processoId));
}

export async function publicarVersaoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z.object({ processoId: uuid, observacao: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    const r = await proc.publicarVersao(await getAtor(), d.data.processoId, d.data.observacao);
    return { ok: `Versão ${r.versao} publicada.` };
  }, caminhos(d.data.processoId));
}

export async function solicitarPublicacaoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z
    .object({
      processoId: uuid,
      observacao: opcional,
      modo: z.enum(["SEQUENCIAL", "PARALELO"]),
      aprovadorIds: z.array(uuid).min(1, "Escolha ao menos um aprovador."),
    })
    .safeParse({ ...obj(fd), aprovadorIds: fd.getAll("aprovadorIds") });
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  return executar(async () => {
    await proc.solicitarPublicacao(await getAtor(), d.data.processoId, d.data);
    return { ok: "Publicação enviada para aprovação." };
  }, [...caminhos(d.data.processoId), "/aprovacoes"]);
}
