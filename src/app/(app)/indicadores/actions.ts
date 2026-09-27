"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import * as ind from "@/lib/indicadores/gestao";
import { executar, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/indicadores", "/indicadores/meus", "/dashboard", "/processos/[id]", ...(id ? [`/indicadores/${id}`] : [])];
const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");
/** Número com vírgula decimal pt-BR ("1.234,5") ou ponto ("92.5"). */
const decimal = (msg: string) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .transform((s) => Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s))
    .pipe(z.number(msg).finite(msg));

const esquemaDados = z.object({
  nome: z.string(),
  descricao: opcional,
  processoId: uuidOpcional,
  unidade: z.string().default(""),
  direcao: z.enum(["MAIOR_MELHOR", "MENOR_MELHOR"], "Direção inválida."),
  meta: decimal("Informe a meta (número)."),
  periodicidade: z.enum(["MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"], "Periodicidade inválida."),
  fonte: z.enum(["MANUAL", "RNC_EFICACIA_PRIMEIRA_VERIFICACAO", "PLANO_ITENS_ATRASADOS"], "Fonte inválida.").default("MANUAL"),
  formula: opcional,
  responsavelId: uuidOpcional,
});

export async function criarIndicadorAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await ind.criarIndicador(await getAtor(), d.data)).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/indicadores/${id}`);
}

export async function editarIndicadorAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaDados.extend({ id: uuid, versao }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await ind.editarIndicador(await getAtor(), id, dados, v);
    return { ok: "Indicador salvo." };
  }, caminhos(id));
}

export async function definirAtivoIndicadorAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, ativo: z.enum(["0", "1"]) }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await ind.definirAtivoIndicador(await getAtor(), d.data.id, d.data.ativo === "1");
    return { ok: d.data.ativo === "1" ? "Indicador reativado." : "Indicador inativado." };
  }, caminhos(d.data.id));
}

export async function lancarResultadoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, periodo: z.string().trim().min(4, "Informe o período."), valor: decimal("Informe o valor (número)."), observacao: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    const r = await ind.lancarResultado(await getAtor(), d.data.id, d.data);
    return { ok: r.correcao ? "Correção registrada (o lançamento anterior continua no histórico)." : "Resultado lançado." };
  }, caminhos(d.data.id));
}

export async function registrarAutomaticoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, periodo: z.string().trim().min(4, "Informe o período."), observacao: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    const r = await ind.registrarResultadoAutomatico(await getAtor(), d.data.id, d.data.periodo, d.data.observacao);
    return { ok: `Valor calculado registrado: ${r.valor.toLocaleString("pt-BR")}.` };
  }, caminhos(d.data.id));
}
