"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import type { Ator } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import * as anexos from "@/lib/anexos/servico";
import * as inc from "@/lib/incidentes/servico";
import { executar, itensJson, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/incidentes", "/dashboard", ...(id ? [`/incidentes/${id}`] : [])];
const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");
const inteiroOpcional = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .pipe(z.number().int("Dias perdidos inválidos.").min(0, "Dias perdidos inválidos.").nullable())
  .nullish();

const esquemaDados = z.object({
  tipo: z.enum(["ACIDENTE_TIPICO", "ACIDENTE_TRAJETO", "QUASE_ACIDENTE", "DOENCA_OCUPACIONAL"], "Escolha o tipo."),
  gravidade: z.enum(["SEM_AFASTAMENTO", "COM_AFASTAMENTO", "FATALIDADE"], "Escolha a gravidade."),
  dataHora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe a data e a hora."),
  obraId: uuid,
  setorId: uuidOpcional,
  local: opcional,
  descricaoFatos: z.string(),
  diasPerdidos: inteiroOpcional,
  geraCat: z.literal("on").optional().transform((v) => v === "on"),
  numeroCat: opcional,
});

/** Arquivos não vazios de um campo; quantidade/tamanho/permissão checados antes de ler o conteúdo. */
async function arquivosDe(a: Ator, fd: FormData, campo: string) {
  const fs = fd.getAll(campo).filter((v): v is File => v instanceof File && v.size > 0);
  await anexos.prevalidarArquivos(a, fs.map((f) => ({ nome: f.name, tamanho: f.size })));
  return Promise.all(fs.map(async (f) => ({ nome: f.name, dados: new Uint8Array(await f.arrayBuffer()) })));
}

const AVISO_ANEXOS = "O incidente foi registrado, mas as fotos não puderam ser armazenadas. Anexe-as novamente no detalhe.";

export async function registrarIncidenteAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const d = esquemaDados
    .extend({
      envolvidoId: uuidOpcional,
      terceiroNome: opcional,
      terceiroFuncao: opcional,
      testemunhas: opcional,
      restrita: z.literal("on").optional().transform((v) => v === "on"),
      temSensiveis: z.literal("on").optional().transform((v) => v === "on"),
      nomeEnvolvido: opcional,
      documentoEnvolvido: opcional,
      funcaoEnvolvido: opcional,
      relato: opcional,
      lesaoDescricao: opcional,
      testemunhasRelato: opcional,
    })
    .safeParse(b);
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  const x = d.data;
  let id = "";
  let aviso: string | null = null;
  const r = await executar(async () => {
    const a = await getAtor();
    const fotos = await arquivosDe(a, fd, "arquivos");
    const fotosSensiveis = x.temSensiveis && inc.podeVerRestritosIncidente(a) ? await arquivosDe(a, fd, "arquivosSensiveis") : [];
    await anexos.validarArquivos(a, [...fotos, ...fotosSensiveis]);
    const criado = await inc.registrarIncidente(a, {
      ...x,
      sensiveis: x.temSensiveis
        ? { nomeEnvolvido: x.nomeEnvolvido, documentoEnvolvido: x.documentoEnvolvido, funcaoEnvolvido: x.funcaoEnvolvido, relato: x.relato, lesaoDescricao: x.lesaoDescricao, testemunhasRelato: x.testemunhasRelato }
        : null,
    });
    id = criado.id;
    try {
      if (fotos.length) await anexos.enviarAnexos(a, { tipo: "INCIDENTE", entidadeId: id }, fotos);
      if (fotosSensiveis.length) await anexos.enviarAnexos(a, { tipo: "INCIDENTE_DADOS_SENSIVEIS", entidadeId: id }, fotosSensiveis);
    } catch (e) {
      console.error(`[anexos] falha ao anexar após registrar incidente ${id}`, e);
      aviso = AVISO_ANEXOS;
    }
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  if (aviso) return { ok: "Incidente registrado.", aviso };
  redirect(`/incidentes/${id}`);
}

export async function editarIncidenteAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.extend({ id: uuid, versao }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await inc.editarIncidente(await getAtor(), id, dados, v);
    return { ok: "Registro salvo." };
  }, caminhos(id));
}

export async function definirResponsavelAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, responsavelId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await inc.definirResponsavel(await getAtor(), d.data.id, d.data.responsavelId, d.data.versao);
    return { ok: "Responsável definido." };
  }, caminhos(d.data.id));
}

export async function iniciarInvestigacaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await inc.iniciarInvestigacao(await getAtor(), d.data.id, d.data.versao);
    return { ok: "Investigação iniciada." };
  }, caminhos(d.data.id));
}

const esquemaCausa = z.object({
  id: uuid,
  versao,
  metodo: z.enum(["CINCO_PORQUES", "ISHIKAWA", "OUTRO"]),
  analise: z.string().max(60000, "Análise muito longa.").transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Análise inválida." });
      return z.NEVER;
    }
  }),
  causaRaiz: z.string().trim().min(3, "Informe a causa raiz.").max(5000, "Causa raiz muito longa."),
});

export async function salvarInvestigacaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaCausa.safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await inc.salvarInvestigacao(await getAtor(), d.data.id, { metodo: d.data.metodo, analise: d.data.analise, causaRaiz: d.data.causaRaiz }, d.data.versao);
    return { ok: "Análise de causa raiz salva." };
  }, caminhos(d.data.id));
}

export async function gerarPlanoIncidenteAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, titulo: opcional, itens: itensJson }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await inc.gerarPlanoIncidente(await getAtor(), d.data.id, { titulo: d.data.titulo, itens: d.data.itens });
    return { ok: "Plano de ação gerado e vinculado." };
  }, caminhos(d.data.id));
}

export async function concluirIncidenteAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, conclusao: z.string(), diasPerdidos: inteiroOpcional }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await inc.concluirIncidente(await getAtor(), d.data.id, { conclusao: d.data.conclusao, diasPerdidos: d.data.diasPerdidos }, d.data.versao);
    return { ok: "Incidente concluído." };
  }, caminhos(d.data.id));
}
