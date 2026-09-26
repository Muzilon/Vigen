"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import "@/lib/aprovacao/handlers";
import * as riscos from "@/lib/riscos/servico";
import { executar, itensJson, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/riscos", "/riscos/revisao-geral", "/dashboard", "/processos/[id]", ...(id ? [`/riscos/${id}`] : [])];

const nota = z.coerce.number().int("Valor inválido.").min(1, "Valor inválido.");
const notaOpcional = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .pipe(z.number().int().min(1).nullable())
  .nullish();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o prazo da ação.");

const esquemaDados = z.object({
  tipo: z.enum(["RISCO", "OPORTUNIDADE"], "Tipo inválido."),
  descricao: z.string().trim().min(3, "Descreva o risco/oportunidade (mínimo 3 caracteres)."),
  causa: opcional,
  consequencia: opcional,
  processoId: uuidOpcional,
  obraId: uuidOpcional,
  responsavelId: uuidOpcional,
  probabilidade: nota,
  impacto: nota,
  modoReavaliacao: z.enum(["ITEM", "GERAL"]).default("ITEM"),
  periodicidadeMeses: z.coerce.number().int().min(1, "Periodicidade entre 1 e 60 meses.").max(60, "Periodicidade entre 1 e 60 meses.").default(12),
});

const tratamento = z.enum(["ACEITAR", "MITIGAR", "TRANSFERIR", "EVITAR", "EXPLORAR"]);

/** Primeira ação do plano (opcional): só vale se "o quê" foi preenchido. */
function primeiraAcao(b: Record<string, FormDataEntryValue>) {
  const oQue = String(b.acaoOQue ?? "").trim();
  if (!oQue) return null;
  return z.object({ oQue: z.string().min(2, "Informe a ação."), quemId: uuid, quando: data }).parse({ oQue, quemId: b.acaoQuemId, quando: b.acaoQuando });
}

export async function criarRiscoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const d = esquemaDados.extend({ tratamento: tratamento.or(z.literal("")).optional(), descricaoTratamento: opcional }).safeParse(b);
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" "), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    const res = await riscos.criarRisco(await getAtor(), { ...d.data, tratamento: d.data.tratamento || null, primeiraAcao: primeiraAcao(b) });
    id = res.id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/riscos/${id}`);
}

export async function editarRiscoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.extend({ id: uuid, versao }).safeParse(obj(fd));
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await riscos.editarRisco(await getAtor(), id, dados, v);
    return { ok: "Registro salvo." };
  }, caminhos(id));
}

export async function solicitarAlteracaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados
    .extend({ id: uuid, modo: z.enum(["SEQUENCIAL", "PARALELO"]), resumo: opcional, aprovadorIds: z.array(uuid).min(1, "Escolha ao menos um aprovador.") })
    .safeParse({ ...obj(fd), aprovadorIds: fd.getAll("aprovadorIds") });
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  const { id, modo, resumo, aprovadorIds, ...dados } = d.data;
  return executar(async () => {
    await riscos.solicitarAlteracao(await getAtor(), id, dados, { aprovadorIds, modo, resumo });
    return { ok: "Alteração enviada para aprovação." };
  }, [...caminhos(id), "/aprovacoes"]);
}

export async function excluirRiscoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  const r = await executar(async () => {
    await riscos.excluirRisco(await getAtor(), d.data.id);
  }, caminhos(d.data.id));
  if (r?.erro) return r;
  redirect("/riscos");
}

export async function definirTratamentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const d = z
    .object({ id: uuid, versao, tratamento, descricaoTratamento: opcional, probabilidadeResidual: notaOpcional, impactoResidual: notaOpcional })
    .safeParse(b);
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await riscos.definirTratamento(await getAtor(), id, { ...dados, primeiraAcao: primeiraAcao(b) }, v);
    return { ok: "Tratamento registrado." };
  }, caminhos(id));
}

export async function gerarPlanoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, titulo: opcional, itens: itensJson }).safeParse(obj(fd));
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  return executar(async () => {
    await riscos.gerarPlanoAcao(await getAtor(), d.data.id, { titulo: d.data.titulo, itens: d.data.itens });
    return { ok: "Plano de ação gerado e vinculado." };
  }, caminhos(d.data.id));
}

export async function alterarStatusAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ id: uuid, versao, status: z.enum(["IDENTIFICADO", "EM_TRATAMENTO", "MONITORADO", "ENCERRADO"]), observacao: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await riscos.alterarStatus(await getAtor(), d.data.id, d.data.status, d.data.observacao, d.data.versao);
    return { ok: "Status atualizado." };
  }, caminhos(d.data.id));
}

export async function reavaliarAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ id: uuid, versao, probabilidade: nota, impacto: nota, probabilidadeResidual: notaOpcional, impactoResidual: notaOpcional, observacao: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await riscos.reavaliar(await getAtor(), id, dados, v);
    return { ok: "Reavaliação registrada." };
  }, caminhos(id));
}

/** Revisão geral: campos p_<id>, i_<id>, pr_<id>, ir_<id> por registro do escopo. */
export async function revisaoGeralAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const b = obj(fd);
  const escopo = z.object({ processo: z.string().optional(), observacao: opcional }).parse(b);
  const ids = fd.getAll("ids").map(String);
  const num = (k: string) => {
    const v = String(b[k] ?? "");
    return v === "" ? null : Number(v);
  };
  const avaliacoes = ids.map((id) => ({
    id: uuid.parse(id),
    probabilidade: num(`p_${id}`) ?? NaN,
    impacto: num(`i_${id}`) ?? NaN,
    probabilidadeResidual: num(`pr_${id}`),
    impactoResidual: num(`ir_${id}`),
  }));
  return executar(async () => {
    const r = await riscos.revisaoGeral(await getAtor(), { processo: escopo.processo || null }, avaliacoes, escopo.observacao);
    return { ok: `Revisão geral registrada: ${r.revisados} registro(s) reavaliado(s).` };
  }, caminhos());
}
