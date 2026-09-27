"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import "@/lib/aprovacao/handlers";
import * as hira from "@/lib/hira/servico";
import { executar, itensJson, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/hira", "/hira/revisao-geral", "/dashboard", "/processos/[id]", "/aprovacoes", ...(id ? [`/hira/${id}`] : [])];

const nota = z.coerce.number().int("Valor inválido.").min(1, "Valor inválido.");
const notaOpcional = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .pipe(z.number().int().min(1).nullable())
  .nullish();

const esquemaDados = z.object({
  obraId: uuid,
  setor: z.string().trim().min(2, "Informe o setor."),
  processoId: uuidOpcional,
  atividade: z.string().trim().min(2, "Informe a atividade."),
  rotineira: z.enum(["1", "0"]).transform((v) => v === "1"),
  perigo: z.string().trim().min(2, "Informe o perigo."),
  risco: z.string().trim().min(2, "Informe o risco/dano."),
  condicao: z.enum(["NORMAL", "ANORMAL", "EMERGENCIA"], "Condição inválida."),
  controlesExistentes: opcional,
  hierarquiaControle: z
    .enum(["ELIMINACAO", "SUBSTITUICAO", "ENGENHARIA", "ADMINISTRATIVO", "EPI", ""])
    .transform((v) => v || null)
    .nullish(),
  controlesPropostos: opcional,
  probabilidade: nota,
  severidade: nota,
  probabilidadeResidual: notaOpcional,
  severidadeResidual: notaOpcional,
  requisitoLegal: opcional,
  responsavelId: uuidOpcional,
  modoReavaliacao: z.enum(["ITEM", "GERAL"]).default("ITEM"),
  periodicidadeMeses: z.coerce.number().int().min(1, "Periodicidade entre 1 e 60 meses.").max(60, "Periodicidade entre 1 e 60 meses.").default(12),
});

const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");

export async function incluirHiraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await hira.incluirHira(await getAtor(), d.data)).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/hira/${id}`);
}

export async function alterarHiraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.extend({ id: uuid, versao, motivo: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, motivo, ...dados } = d.data;
  return executar(async () => {
    const r = await hira.alterarHira(await getAtor(), id, dados, v, motivo);
    return { ok: r.aplicado ? "Linha alterada." : "Alteração enviada para aprovação. A linha vigente permanece até a última assinatura." };
  }, caminhos(id));
}

export async function excluirHiraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, motivo: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  let aplicado = false;
  const r = await executar(async () => {
    aplicado = (await hira.excluirHira(await getAtor(), d.data.id, d.data.motivo, d.data.versao)).aplicado;
    return { ok: "Exclusão enviada para aprovação." };
  }, caminhos(d.data.id));
  if (r?.erro || !aplicado) return r;
  redirect("/hira");
}

export async function reavaliarHiraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ id: uuid, versao, probabilidade: nota, severidade: nota, probabilidadeResidual: notaOpcional, severidadeResidual: notaOpcional, observacao: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await hira.reavaliarHira(await getAtor(), id, dados, v);
    return { ok: "Reavaliação registrada." };
  }, caminhos(id));
}

export async function gerarPlanoHiraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, titulo: opcional, itens: itensJson }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await hira.gerarPlanoHira(await getAtor(), d.data.id, { titulo: d.data.titulo, itens: d.data.itens });
    return { ok: "Plano de ação gerado e vinculado." };
  }, caminhos(d.data.id));
}

/** Revisão geral da obra: campos p_<id>, s_<id>, pr_<id>, sr_<id> por linha vigente. */
export async function revisaoGeralHiraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const escopo = z.object({ obraId: uuid, observacao: opcional }).safeParse(b);
  if (!escopo.success) return { erro: "Escolha a unidade." };
  const num = (k: string) => {
    const v = String(b[k] ?? "");
    return v === "" ? null : Number(v);
  };
  const avaliacoes = fd.getAll("ids").map(String).map((id) => ({
    id: uuid.parse(id),
    probabilidade: num(`p_${id}`) ?? NaN,
    severidade: num(`s_${id}`) ?? NaN,
    probabilidadeResidual: num(`pr_${id}`),
    severidadeResidual: num(`sr_${id}`),
  }));
  return executar(async () => {
    const r = await hira.revisaoGeralHira(await getAtor(), escopo.data.obraId, avaliacoes, escopo.data.observacao);
    return { ok: `Revisão geral registrada: ${r.revisados} linha(s) reavaliada(s).` };
  }, caminhos());
}

/** "Clone Inteligente": duplica a planilha HIRA vigente de uma obra para outra (docs/ideias-implantadas). */
export async function clonarHiraObraAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ origemObraId: uuid, destinoObraId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Escolha a unidade de origem e a de destino." };
  return executar(async () => {
    const r = await hira.clonarHiraParaObra(await getAtor(), d.data.origemObraId, d.data.destinoObraId);
    if (r.erros.length > 0) {
      return { erro: `${r.criadas} de ${r.total} linha(s) clonada(s). Falhas: ${r.erros.map((e) => `"${e.atividade}" — ${e.mensagem}`).join("; ")}` };
    }
    return { ok: `${r.criadas} linha(s) clonada(s) para a obra destino.` };
  }, caminhos());
}
