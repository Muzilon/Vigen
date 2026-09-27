"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import "@/lib/aprovacao/handlers";
import * as laia from "@/lib/laia/servico";
import { executar, itensJson, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/laia", "/laia/revisao-geral", "/dashboard", "/processos/[id]", "/aprovacoes", ...(id ? [`/laia/${id}`] : [])];

const nota = z.coerce.number().int("Valor inválido.").min(1, "Valor inválido.");

const esquemaDados = z.object({
  obraId: uuid,
  processoId: uuidOpcional,
  atividade: z.string().trim().min(2, "Informe a atividade."),
  aspecto: z.string().trim().min(2, "Informe o aspecto."),
  impacto: z.string().trim().min(2, "Informe o impacto."),
  situacao: z.enum(["NORMAL", "ANORMAL", "EMERGENCIA"], "Situação inválida."),
  temporalidade: z.enum(["PASSADA", "ATUAL", "FUTURA"], "Temporalidade inválida."),
  incidencia: z.enum(["DIRETA", "INDIRETA"], "Incidência inválida."),
  severidade: nota,
  frequencia: nota,
  abrangencia: nota,
  requisitoLegal: z.literal("on").optional().transform((v) => v === "on"),
  partesInteressadas: z.literal("on").optional().transform((v) => v === "on"),
  controles: opcional,
  responsavelId: uuidOpcional,
  modoReavaliacao: z.enum(["ITEM", "GERAL"]).default("ITEM"),
  periodicidadeMeses: z.coerce.number().int().min(1, "Periodicidade entre 1 e 60 meses.").max(60, "Periodicidade entre 1 e 60 meses.").default(12),
});

const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");

export async function incluirLaiaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await laia.incluirLaia(await getAtor(), d.data)).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/laia/${id}`);
}

export async function alterarLaiaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.extend({ id: uuid, versao, motivo: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, motivo, ...dados } = d.data;
  return executar(async () => {
    const r = await laia.alterarLaia(await getAtor(), id, dados, v, motivo);
    return { ok: r.aplicado ? "Linha alterada." : "Alteração enviada para aprovação. A linha vigente permanece até a última assinatura." };
  }, caminhos(id));
}

export async function excluirLaiaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, motivo: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  let aplicado = false;
  const r = await executar(async () => {
    aplicado = (await laia.excluirLaia(await getAtor(), d.data.id, d.data.motivo, d.data.versao)).aplicado;
    return { ok: "Exclusão enviada para aprovação." };
  }, caminhos(d.data.id));
  if (r?.erro || !aplicado) return r;
  redirect("/laia");
}

export async function reavaliarLaiaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ id: uuid, versao, severidade: nota, frequencia: nota, abrangencia: nota, observacao: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await laia.reavaliarLaia(await getAtor(), id, dados, v);
    return { ok: "Reavaliação registrada." };
  }, caminhos(id));
}

export async function gerarPlanoLaiaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, titulo: opcional, itens: itensJson }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await laia.gerarPlanoLaia(await getAtor(), d.data.id, { titulo: d.data.titulo, itens: d.data.itens });
    return { ok: "Plano de ação gerado e vinculado." };
  }, caminhos(d.data.id));
}

/** Revisão geral da obra: campos s_<id>, f_<id>, a_<id> por linha vigente. */
export async function revisaoGeralLaiaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const escopo = z.object({ obraId: uuid, observacao: opcional }).safeParse(b);
  if (!escopo.success) return { erro: "Escolha a unidade." };
  const num = (k: string) => {
    const v = String(b[k] ?? "");
    return v === "" ? null : Number(v);
  };
  const avaliacoes = fd.getAll("ids").map(String).map((id) => ({
    id: uuid.parse(id),
    severidade: num(`s_${id}`) ?? NaN,
    frequencia: num(`f_${id}`) ?? NaN,
    abrangencia: num(`a_${id}`) ?? NaN,
  }));
  return executar(async () => {
    const r = await laia.revisaoGeralLaia(await getAtor(), escopo.data.obraId, avaliacoes, escopo.data.observacao);
    return { ok: `Revisão geral registrada: ${r.revisados} linha(s) reavaliada(s).` };
  }, caminhos());
}

/** "Clone Inteligente": duplica a planilha LAIA vigente de uma obra para outra (docs/ideias-implantadas). */
export async function clonarLaiaObraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ origemObraId: uuid, destinoObraId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Escolha a unidade de origem e a de destino." };
  return executar(async () => {
    const r = await laia.clonarLaiaParaObra(await getAtor(), d.data.origemObraId, d.data.destinoObraId);
    if (r.erros.length > 0) {
      return { erro: `${r.criadas} de ${r.total} linha(s) clonada(s). Falhas: ${r.erros.map((e) => `"${e.atividade}" — ${e.mensagem}`).join("; ")}` };
    }
    return { ok: `${r.criadas} linha(s) clonada(s) para a obra destino.` };
  }, caminhos());
}
