"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import type { Ator } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import * as anexos from "@/lib/anexos/servico";
import * as insp from "@/lib/inspecoes/servico";
import { executar, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/inspecoes", "/inspecoes/modelos", "/dashboard", "/rncs", ...(id ? [`/inspecoes/${id}`, `/inspecoes/modelos/${id}`] : [])];
const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");
const tipoChecklist = z.enum(["QUALIDADE", "SSO", "MEIO_AMBIENTE", "GERAL"], "Tipo inválido.");
const tipoResposta = z.enum(["CONFORME_NAO_CONFORME_NA", "SIM_NAO", "NOTA_1A5", "TEXTO"], "Tipo de resposta inválido.");
const notaMinima = z.coerce.number().int().min(1, "Nota mínima entre 1 e 5.").max(5, "Nota mínima entre 1 e 5.");

/** Fotos do campo `fotos` (B3: tamanho declarado checado antes de ler o conteúdo). */
async function fotosDe(a: Ator, fd: FormData, alvo: anexos.Alvo): Promise<anexos.ArquivoEnviado[]> {
  const fs = fd.getAll("fotos").filter((v): v is File => v instanceof File && v.size > 0);
  if (fs.length === 0) return [];
  await anexos.prevalidarArquivos(a, fs.map((f) => ({ nome: f.name, tamanho: f.size })), alvo);
  return Promise.all(fs.map(async (f) => ({ nome: f.name, dados: new Uint8Array(await f.arrayBuffer()) })));
}

// ---------------------------------------------------------------- modelos

export async function criarModeloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ nome: z.string(), descricao: opcional, tipo: tipoChecklist, notaMinima }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await insp.criarModelo(await getAtor(), d.data)).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/inspecoes/modelos/${id}`);
}

export async function editarModeloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, nome: z.string(), descricao: opcional, tipo: tipoChecklist, notaMinima }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await insp.editarModelo(await getAtor(), id, dados, v);
    return { ok: "Modelo salvo." };
  }, caminhos(id));
}

export async function ativarModeloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, ativo: z.enum(["1", "0"]) }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await insp.definirModeloAtivo(await getAtor(), d.data.id, d.data.ativo === "1");
    return { ok: d.data.ativo === "1" ? "Modelo reativado." : "Modelo inativado (não aparece em novas inspeções)." };
  }, caminhos(d.data.id));
}

const esquemaItem = z.object({ pergunta: z.string(), tipoResposta, obrigatorioFoto: z.string().optional(), ajuda: opcional });

export async function adicionarItemModeloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaItem.extend({ modeloId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await insp.adicionarItemModelo(await getAtor(), d.data.modeloId, { ...d.data, obrigatorioFoto: d.data.obrigatorioFoto === "on" });
    return { ok: "Pergunta adicionada." };
  }, caminhos(d.data.modeloId));
}

export async function editarItemModeloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaItem.extend({ itemId: uuid, modeloId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await insp.editarItemModelo(await getAtor(), d.data.itemId, { ...d.data, obrigatorioFoto: d.data.obrigatorioFoto === "on" });
    return { ok: "Pergunta salva." };
  }, caminhos(d.data.modeloId));
}

export async function removerItemModeloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ itemId: uuid, modeloId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await insp.removerItemModelo(await getAtor(), d.data.itemId);
    return { ok: "Pergunta removida." };
  }, caminhos(d.data.modeloId));
}

export async function moverItemModeloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ itemId: uuid, modeloId: uuid, direcao: z.enum(["cima", "baixo"]) }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await insp.moverItemModelo(await getAtor(), d.data.itemId, d.data.direcao);
    return { ok: "Ordem atualizada." };
  }, caminhos(d.data.modeloId));
}

// ---------------------------------------------------------------- inspeções

export async function iniciarInspecaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ modeloId: uuid, obraId: uuid, setorId: uuidOpcional, processoId: uuidOpcional, dataInspecao: data, inspetorId: uuidOpcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await insp.iniciarInspecao(await getAtor(), d.data)).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/inspecoes/${id}`);
}

export async function responderAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ inspecaoId: uuid, respostaId: uuid, resposta: z.string().optional(), nota: z.string().optional(), texto: z.string().optional(), comentario: z.string().optional() })
    .safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    const a = await getAtor();
    const alvo = { tipo: "RESPOSTA_INSPECAO" as const, entidadeId: d.data.respostaId };
    const fotos = await fotosDe(a, fd, alvo);
    if (fotos.length) await anexos.validarArquivos(a, fotos);
    const r = await insp.responder(a, d.data.respostaId, d.data);
    if (fotos.length) await anexos.enviarAnexos(a, alvo, fotos);
    return { ok: r.naoConforme ? "Não conformidade registrada — abra uma RNC ou crie um item de ação abaixo." : "Resposta salva." };
  }, caminhos(d.data.inspecaoId));
}

export async function concluirInspecaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, observacoes: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    const r = await insp.concluirInspecao(await getAtor(), d.data.id, { observacoes: d.data.observacoes }, d.data.versao);
    return { ok: `Inspeção concluída${r.percentual !== null ? ` — ${r.percentual}% de conformidade` : ""}.` };
  }, caminhos(d.data.id));
}

export async function cancelarInspecaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, motivo: z.string().trim().min(3, "Informe o motivo.") }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await insp.cancelarInspecao(await getAtor(), d.data.id, d.data.motivo, d.data.versao);
    return { ok: "Inspeção cancelada." };
  }, caminhos(d.data.id));
}

export async function abrirRncAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({
      inspecaoId: uuid,
      respostaId: uuid,
      titulo: opcional,
      descricao: opcional,
      tipo: z.enum(["QUALIDADE", "MEIO_AMBIENTE", "SSO"], "Tipo inválido."),
      gravidade: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"], "Escolha a gravidade."),
      responsavelId: uuidOpcional,
    })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    const r = await insp.abrirRncDaResposta(await getAtor(), d.data.respostaId, d.data);
    return { ok: `${r.codigo} aberta com as fotos da resposta como evidência.` };
  }, caminhos(d.data.inspecaoId));
}

export async function criarItemAcaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ inspecaoId: uuid, respostaId: uuid, oQue: opcional, quemId: uuid, quando: data, como: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await insp.criarItemAcaoDaResposta(await getAtor(), d.data.respostaId, d.data);
    return { ok: "Item de ação criado no plano da inspeção." };
  }, caminhos(d.data.inspecaoId));
}
