"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import * as swot from "@/lib/swot/servico";
import { executar, obj, opcional, uuid, uuidOpcional } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/swot", ...(id ? [`/swot/${id}`] : [])];
const quadrante = z.enum(["FORCA", "FRAQUEZA", "OPORTUNIDADE", "AMEACA"], "Quadrante inválido.");
const escala = (campo: string) => z.coerce.number().int().min(1, `${campo} de 1 a 5.`).max(5, `${campo} de 1 a 5.`);
const erro = (e: z.ZodError) => ({ erro: e.issues.map((i) => i.message).join(" ") });

export async function criarCicloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ ano: z.coerce.number().int(), titulo: opcional, copiar: z.enum(["1"]).optional() }).safeParse(obj(fd));
  if (!d.success) return erro(d.error);
  let id = "";
  const r = await executar(async () => {
    const a = await getAtor();
    id = d.data.copiar ? (await swot.copiarCicloAnterior(a, d.data.ano)).id : (await swot.criarCiclo(a, d.data)).id;
  }, caminhos());
  if (r?.erro) return r;
  redirect(`/swot/${id}`);
}

export async function editarCicloAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, titulo: opcional, encerrado: z.enum(["true", "false"]).optional() }).safeParse(obj(fd));
  if (!d.success) return erro(d.error);
  return executar(async () => {
    await swot.editarCiclo(await getAtor(), d.data.id, {
      titulo: d.data.titulo,
      encerrado: d.data.encerrado === undefined ? undefined : d.data.encerrado === "true",
    });
    return { ok: d.data.encerrado === "true" ? "Ciclo encerrado." : d.data.encerrado === "false" ? "Ciclo reaberto." : "Ciclo salvo." };
  }, caminhos(d.data.id));
}

const esquemaItem = z.object({ quadrante, descricao: z.string().trim().min(2, "Descreva o item."), relevancia: escala("Relevância") });

export async function salvarItemAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaItem.extend({ cicloId: uuid, id: uuidOpcional }).safeParse(obj(fd));
  if (!d.success) return erro(d.error);
  const { cicloId, id, ...dados } = d.data;
  return executar(async () => {
    const a = await getAtor();
    if (id) await swot.editarItem(a, id, dados);
    else await swot.adicionarItem(a, cicloId, dados);
    return { ok: id ? "Item salvo." : "Item adicionado." };
  }, caminhos(cicloId));
}

export async function removerItemAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, cicloId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await swot.removerItem(await getAtor(), d.data.id);
    return { ok: "Item removido." };
  }, caminhos(d.data.cicloId));
}

export async function gerarRiscoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({
      id: uuid,
      cicloId: uuid,
      descricao: z.string().trim().min(3, "Descreva o risco/oportunidade."),
      processoId: uuidOpcional,
      probabilidade: z.coerce.number().int().min(1),
      impacto: z.coerce.number().int().min(1),
    })
    .safeParse(obj(fd));
  if (!d.success) return erro(d.error);
  const { id, cicloId, ...dados } = d.data;
  return executar(async () => {
    await swot.gerarRiscoDoItem(await getAtor(), id, dados);
    return { ok: "Registro criado em Riscos e oportunidades e vinculado ao item." };
  }, [...caminhos(cicloId), "/riscos", "/dashboard"]);
}

const esquemaParte = z.object({
  nome: z.string().trim().min(2, "Informe o nome da parte interessada."),
  necessidades: opcional,
  expectativas: opcional,
  influencia: escala("Influência"),
  interesse: escala("Interesse"),
});

export async function salvarParteAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaParte.extend({ cicloId: uuid, id: uuidOpcional }).safeParse(obj(fd));
  if (!d.success) return erro(d.error);
  const { cicloId, id, ...dados } = d.data;
  return executar(async () => {
    const a = await getAtor();
    if (id) await swot.editarParte(a, id, dados);
    else await swot.adicionarParte(a, cicloId, dados);
    return { ok: id ? "Parte interessada salva." : "Parte interessada adicionada." };
  }, caminhos(cicloId));
}

export async function removerParteAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, cicloId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await swot.removerParte(await getAtor(), d.data.id);
    return { ok: "Parte interessada removida." };
  }, caminhos(d.data.cicloId));
}
