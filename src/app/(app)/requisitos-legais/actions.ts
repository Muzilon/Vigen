"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import * as req from "@/lib/requisitos-legais/servico";
import { executar, itensJson, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/requisitos-legais", "/requisitos-legais/revisao-geral", "/dashboard", "/processos/[id]", ...(id ? [`/requisitos-legais/${id}`] : [])];
const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");
const dataOpcional = z
  .string()
  .transform((s) => s || null)
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable())
  .nullish();
const status = z.enum(["ATENDE", "ATENDE_PARCIAL", "NAO_ATENDE", "NAO_APLICAVEL", "EM_ANALISE"], "Status inválido.");

const esquemaDados = z.object({
  tipo: z.enum(["LEI", "NORMA", "PORTARIA", "RESOLUCAO", "OUTRO"], "Tipo inválido."),
  numero: z.string(),
  titulo: z.string(),
  esfera: z.enum(["FEDERAL", "ESTADUAL", "MUNICIPAL"], "Esfera inválida."),
  tema: z.enum(["QUALIDADE", "SSO", "MEIO_AMBIENTE"], "Tema inválido."),
  orgaoEmissor: opcional,
  resumo: opcional,
  aplicabilidade: opcional,
  dataPublicacao: dataOpcional,
  processoId: uuidOpcional,
  obraId: uuidOpcional,
  responsavelId: uuidOpcional,
  periodicidadeMeses: z.coerce.number().int().min(1, "Periodicidade entre 1 e 60 meses.").max(60, "Periodicidade entre 1 e 60 meses.").default(12),
});

/** Primeira ação do plano (opcional): só vale se "o quê" foi preenchido. */
function primeiraAcao(b: Record<string, FormDataEntryValue>) {
  const oQue = String(b.acaoOQue ?? "").trim();
  if (!oQue) return null;
  return z
    .object({ oQue: z.string().min(2, "Informe a ação."), quemId: uuid, quando: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o prazo da ação.") })
    .parse({ oQue, quemId: b.acaoQuemId, quando: b.acaoQuando });
}

export async function criarRequisitoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const d = esquemaDados.extend({ status, observacao: opcional }).safeParse(b);
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await req.criarRequisito(await getAtor(), { ...d.data, primeiraAcao: primeiraAcao(b) })).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/requisitos-legais/${id}`);
}

export async function editarRequisitoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.extend({ id: uuid, versao }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await req.editarRequisito(await getAtor(), id, dados, v);
    return { ok: "Requisito salvo." };
  }, caminhos(id));
}

export async function registrarVerificacaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const d = z.object({ id: uuid, versao, status, data: dataOpcional, observacao: opcional }).safeParse(b);
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await req.registrarVerificacao(await getAtor(), id, { ...dados, primeiraAcao: primeiraAcao(b) }, v);
    return { ok: "Verificação registrada." };
  }, caminhos(id));
}

export async function gerarPlanoRequisitoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, titulo: opcional, itens: itensJson }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await req.gerarPlanoRequisito(await getAtor(), d.data.id, { titulo: d.data.titulo, itens: d.data.itens });
    return { ok: "Plano de ação gerado e vinculado." };
  }, caminhos(d.data.id));
}

export async function excluirRequisitoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  const r = await executar(async () => {
    await req.excluirRequisito(await getAtor(), d.data.id);
  }, caminhos(d.data.id));
  if (r?.erro) return r;
  redirect("/requisitos-legais");
}

/** Revisão geral: checkboxes `ids` + data + observação. */
export async function revisaoGeralRequisitosAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ ids: z.array(uuid).min(1, "Selecione ao menos um requisito."), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da revisão."), observacao: opcional })
    .safeParse({ ...obj(fd), ids: fd.getAll("ids") });
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    const r = await req.revisaoGeralRequisitos(await getAtor(), d.data.ids, d.data.data, d.data.observacao);
    return { ok: `Revisão geral registrada: ${r.revisados} requisito(s) revisado(s).` };
  }, caminhos());
}
