"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import * as aud from "@/lib/auditorias/servico";
import { executar, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/auditorias", "/auditorias/programa", "/dashboard", "/rncs", ...(id ? [`/auditorias/${id}`] : [])];
const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe as datas.");

const esquemaAuditoria = z.object({
  programaId: uuidOpcional,
  tipo: z.enum(["INTERNA", "EXTERNA_CERTIFICACAO"], "Tipo inválido."),
  norma: z.string(),
  escopo: z.string(),
  processoId: uuidOpcional,
  obraId: uuidOpcional,
  auditorLiderId: uuid,
  equipe: opcional,
  dataInicio: data,
  dataFim: data,
});

/** Itens iniciais: uma linha por item, "requisito | pergunta". */
function itensDoTexto(s: string | null | undefined) {
  return (s ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [requisito, ...resto] = l.split("|");
      return { requisito: requisito.trim(), pergunta: resto.join("|").trim() || null };
    });
}

export async function criarAuditoriaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaAuditoria.extend({ itens: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await aud.criarAuditoria(await getAtor(), d.data, itensDoTexto(d.data.itens))).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/auditorias/${id}`);
}

export async function editarAuditoriaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaAuditoria.extend({ id: uuid, versao }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await aud.editarAuditoria(await getAtor(), id, dados, v);
    return { ok: "Auditoria salva." };
  }, caminhos(id));
}

export async function mudarStatusAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, acao: z.enum(["iniciar", "concluir", "cancelar"]), texto: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  const { id, versao: v, acao, texto } = d.data;
  return executar(async () => {
    const a = await getAtor();
    if (acao === "iniciar") await aud.iniciarAuditoria(a, id, v);
    else if (acao === "concluir") await aud.concluirAuditoria(a, id, texto ?? "", v);
    else await aud.cancelarAuditoria(a, id, texto ?? "", v);
    return { ok: acao === "iniciar" ? "Auditoria em execução." : acao === "concluir" ? "Auditoria concluída." : "Auditoria cancelada." };
  }, caminhos(id));
}

export async function itemAuditoriaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ auditoriaId: uuid, itemId: uuidOpcional, op: z.enum(["adicionar", "editar", "remover", "cima", "baixo"]), requisito: z.string().optional(), pergunta: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  const x = d.data;
  return executar(async () => {
    const a = await getAtor();
    if (x.op === "adicionar") await aud.adicionarItemAuditoria(a, x.auditoriaId, { requisito: x.requisito ?? "", pergunta: x.pergunta });
    else if (!x.itemId) return { erro: "Item inválido." };
    else if (x.op === "editar") await aud.editarItemAuditoria(a, x.itemId, { requisito: x.requisito ?? "", pergunta: x.pergunta });
    else if (x.op === "remover") await aud.removerItemAuditoria(a, x.itemId);
    else await aud.moverItemAuditoria(a, x.itemId, x.op);
    return { ok: "Plano atualizado." };
  }, caminhos(x.auditoriaId));
}

export async function registrarConstatacaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({
      auditoriaId: uuid,
      itemAuditoriaId: uuidOpcional,
      tipo: z.enum(["NAO_CONFORMIDADE", "OBSERVACAO", "OPORTUNIDADE_MELHORIA", "PONTO_FORTE"], "Escolha o tipo."),
      descricao: z.string(),
      evidencia: opcional,
    })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await aud.registrarConstatacao(await getAtor(), d.data.auditoriaId, d.data);
    return { ok: "Constatação registrada." };
  }, caminhos(d.data.auditoriaId));
}

export async function removerConstatacaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ auditoriaId: uuid, id: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await aud.removerConstatacao(await getAtor(), d.data.id);
    return { ok: "Constatação removida." };
  }, caminhos(d.data.auditoriaId));
}

export async function abrirRncConstatacaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({
      auditoriaId: uuid,
      id: uuid,
      titulo: opcional,
      descricao: opcional,
      tipo: z.enum(["QUALIDADE", "MEIO_AMBIENTE", "SSO"], "Tipo inválido."),
      gravidade: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"], "Escolha a gravidade."),
      obraId: uuidOpcional,
      responsavelId: uuidOpcional,
    })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    const r = await aud.abrirRncDaConstatacao(await getAtor(), d.data.id, d.data);
    return { ok: `${r.codigo} aberta a partir da constatação.` };
  }, caminhos(d.data.auditoriaId));
}

export async function salvarProgramaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ ano: z.coerce.number().int(), objetivo: z.string() }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await aud.salvarPrograma(await getAtor(), d.data);
    return { ok: `Programa ${d.data.ano} salvo.` };
  }, caminhos());
}
