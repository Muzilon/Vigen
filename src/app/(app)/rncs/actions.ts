"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ResultadoAcao } from "@/components/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import { ErroConflito, ErroNegocio } from "@/lib/erros";
import * as interacoes from "@/lib/interacoes/servico";
import * as plano from "@/lib/plano-acao/servico";
import * as rnc from "@/lib/rnc/servico";
import { ErroPermissao } from "@/lib/tenant";

async function executar(fn: () => Promise<ResultadoAcao | void>, caminhos: string[] = []): Promise<ResultadoAcao> {
  try {
    const r = await fn();
    for (const c of caminhos) revalidatePath(c);
    revalidatePath("/plano-acao");
    revalidatePath("/plano-acao/[id]", "page");
    revalidatePath("/");
    return r ?? { ok: "Salvo." };
  } catch (e) {
    if (e instanceof ErroNegocio || e instanceof ErroPermissao) return { erro: e.message };
    // B2: violação de unicidade por concorrência (ex.: duas verificações simultâneas).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { erro: new ErroConflito().message };
    if (e instanceof z.ZodError) return { erro: e.issues.map((i) => i.message).join(" ") };
    throw e;
  }
}

const opcional = z
  .string()
  .trim()
  .transform((s) => s || null)
  .nullish();
const uuid = z.uuid("Seleção inválida.");
const uuidOpcional = z
  .string()
  .transform((s) => s || null)
  .pipe(z.uuid().nullable())
  .nullish();
const versao = z.coerce.number().int().optional();
const obj = (fd: FormData) => Object.fromEntries(fd.entries());

// ---------------------------------------------------------------- nova RNC

const esquemaNova = z.object({
  titulo: z.string().trim().min(3, "Título muito curto.").max(200),
  descricao: z.string().trim().min(3, "Descreva a não conformidade."),
  tipo: z.enum(["QUALIDADE", "MEIO_AMBIENTE", "SSO"]),
  origem: z.enum(["AUDITORIA_INTERNA", "INSPECAO", "RECLAMACAO_CLIENTE", "AUTO_IDENTIFICADA", "AUDITORIA_EXTERNA"]),
  gravidade: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]),
  obraId: uuid,
  setorId: uuidOpcional,
  processoArea: opcional,
  responsavelId: uuidOpcional,
  restrita: z.literal("on").optional(),
  contemDadosPessoais: z.literal("on").optional(),
  nomeEnvolvido: opcional,
  documentoEnvolvido: opcional,
  funcaoEnvolvido: opcional,
  relato: opcional,
  lesaoDescricao: opcional,
});

export async function criarRncAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  let id = "";
  const r = await executar(async () => {
    const d = esquemaNova.parse(obj(fd));
    const criada = await rnc.criarRnc(await getAtor(), {
      ...d,
      restrita: !!d.restrita,
      contemDadosPessoais: !!d.contemDadosPessoais,
      sensiveis: d.contemDadosPessoais
        ? {
            nomeEnvolvido: d.nomeEnvolvido,
            documentoEnvolvido: d.documentoEnvolvido,
            funcaoEnvolvido: d.funcaoEnvolvido,
            relato: d.relato,
            lesaoDescricao: d.lesaoDescricao,
          }
        : null,
    });
    id = criada.id;
  }, ["/rncs"]);
  if (id) redirect(`/rncs/${id}`);
  return r;
}

// ---------------------------------------------------------------- transições

const esquemaTransicao = z.object({ id: uuid, versao });

export async function assumirAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = esquemaTransicao.parse(obj(fd));
    await rnc.assumirAnalise(await getAtor(), d.id, d.versao);
    return { ok: "RNC assumida para análise." };
  }, [`/rncs/${fd.get("id")}`, "/rncs"]);
}

export async function iniciarExecucaoAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = esquemaTransicao.parse(obj(fd));
    await rnc.iniciarExecucao(await getAtor(), d.id, d.versao);
    return { ok: "Plano em execução." };
  }, [`/rncs/${fd.get("id")}`, "/rncs"]);
}

export async function enviarVerificacaoAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = esquemaTransicao.parse(obj(fd));
    await rnc.enviarParaVerificacao(await getAtor(), d.id, d.versao);
    return { ok: "Enviada para verificação de eficácia." };
  }, [`/rncs/${fd.get("id")}`, "/rncs"]);
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

export async function salvarCausaAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = esquemaCausa.parse(obj(fd));
    await rnc.salvarCausaRaiz(
      await getAtor(),
      d.id,
      { metodo: d.metodo, analise: d.analise, causaRaiz: d.causaRaiz },
      d.versao,
    );
    return { ok: "Causa raiz salva." };
  }, [`/rncs/${fd.get("id")}`]);
}

const esquemaVerificacao = z.object({
  id: uuid,
  versao,
  resultado: z.enum(["EFICAZ", "INEFICAZ"], "Informe se a ação foi eficaz."),
  comentario: z.string().trim().min(3, "Comentário obrigatório."),
});

export async function verificarAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = esquemaVerificacao.parse(obj(fd));
    const r = await rnc.verificarEficacia(
      await getAtor(),
      d.id,
      { eficaz: d.resultado === "EFICAZ", comentario: d.comentario },
      d.versao,
    );
    return { ok: d.resultado === "EFICAZ" ? "RNC encerrada." : "RNC reaberta para novo ciclo.", aviso: r.aviso ?? undefined };
  }, [`/rncs/${fd.get("id")}`, "/rncs"]);
}

// ---------------------------------------------------------------- cancelamento

export async function solicitarCancelamentoAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ id: uuid, motivo: z.string().trim().min(3, "Motivo obrigatório.") }).parse(obj(fd));
    await rnc.solicitarCancelamento(await getAtor(), d.id, d.motivo);
    return { ok: "Cancelamento solicitado." };
  }, [`/rncs/${fd.get("id")}`]);
}

export async function decidirCancelamentoAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z
      .object({ rncId: uuid, solicitacaoId: uuid, decisao: z.enum(["APROVAR", "REJEITAR"]), comentario: opcional })
      .parse(obj(fd));
    await rnc.decidirCancelamento(await getAtor(), d.solicitacaoId, d.decisao === "APROVAR", d.comentario);
    return { ok: d.decisao === "APROVAR" ? "Cancelamento aprovado." : "Cancelamento rejeitado." };
  }, [`/rncs/${fd.get("rncId")}`, "/rncs"]);
}

// ---------------------------------------------------------------- plano de ação

const esquemaItem = z.object({
  oQue: z.string().trim().min(2, "Informe o que será feito."),
  porQue: opcional,
  onde: opcional,
  quemId: uuid,
  quando: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o prazo."),
  como: opcional,
  quanto: z
    .union([z.number(), z.string()])
    .transform((v) => (v === "" || v === null ? null : Number(v)))
    .pipe(z.number().nonnegative("Custo inválido.").nullable())
    .nullish(),
});

export async function adicionarItensAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z
      .object({ rncId: uuid, itens: z.string().transform((s, ctx) => {
          try {
            return JSON.parse(s) as unknown;
          } catch {
            ctx.addIssue({ code: "custom", message: "Itens inválidos." });
            return z.NEVER;
          }
        }) })
      .parse(obj(fd));
    const itens = z.array(esquemaItem).min(1, "Adicione ao menos um item.").parse(d.itens);
    await plano.adicionarItensRnc(await getAtor(), d.rncId, itens);
    return { ok: `${itens.length} item(ns) adicionado(s).` };
  }, [`/rncs/${fd.get("rncId")}`]);
}

export async function editarItemAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = esquemaItem.extend({ itemId: uuid }).parse(obj(fd));
    await plano.editarItem(await getAtor(), d.itemId, d);
    return { ok: "Item atualizado." };
  }, [`/rncs/${fd.get("rncId") ?? ""}`]);
}

export async function cancelarItemAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ itemId: uuid }).parse(obj(fd));
    await plano.cancelarItem(await getAtor(), d.itemId);
    return { ok: "Item cancelado." };
  }, [`/rncs/${fd.get("rncId") ?? ""}`]);
}

export async function iniciarItemAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ itemId: uuid }).parse(obj(fd));
    await plano.marcarEmAndamento(await getAtor(), d.itemId);
    return { ok: "Item em andamento." };
  }, [`/rncs/${fd.get("rncId") ?? ""}`]);
}

export async function concluirItemAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z
      .object({
        itemId: uuid,
        dataConclusao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de conclusão."),
        evidencia: z.string().trim().min(3, "Descreva a evidência."),
      })
      .parse(obj(fd));
    await plano.concluirItem(await getAtor(), d.itemId, d);
    return { ok: "Item concluído." };
  }, [`/rncs/${fd.get("rncId") ?? ""}`]);
}

// ---------------------------------------------------------------- interações

export async function enviarInteracaoAcao(_: ResultadoAcao, fd: FormData) {
  const d = z
    .object({
      entidadeTipo: z.enum(["RNC", "ITEM_ACAO"]),
      entidadeId: uuid,
      mensagem: z.string().trim().min(1, "Escreva a mensagem.").max(interacoes.MAX_MENSAGEM, "Mensagem muito longa."),
      destinatarioId: uuidOpcional,
    })
    .safeParse(obj(fd));
  if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
  const { entidadeTipo, entidadeId } = d.data;
  return executar(async () => {
    await interacoes.criarInteracao(await getAtor(), { tipo: entidadeTipo, entidadeId }, d.data.mensagem, d.data.destinatarioId);
    return { ok: "Mensagem enviada." };
  }, [entidadeTipo === "RNC" ? `/rncs/${entidadeId}` : `/plano-acao/${entidadeId}`, "/mensagens"]);
}
