"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import type { Ator } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import * as anexos from "@/lib/anexos/servico";
import * as interacoes from "@/lib/interacoes/servico";
import * as plano from "@/lib/plano-acao/servico";
import * as rnc from "@/lib/rnc/servico";
import { esquemaItem, executar, itensJson, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

/**
 * Arquivos (não vazios) de um campo multipart. B3: quantidade, tamanho declarado e (se houver
 * alvo) permissão são checados ANTES de ler o conteúdo em memória.
 */
async function arquivosDe(a: Ator, fd: FormData, campo = "arquivos", alvo?: anexos.Alvo): Promise<anexos.ArquivoEnviado[]> {
  const fs = fd.getAll(campo).filter((v): v is File => v instanceof File && v.size > 0);
  await anexos.prevalidarArquivos(a, fs.map((f) => ({ nome: f.name, tamanho: f.size })), alvo);
  return Promise.all(fs.map(async (f) => ({ nome: f.name, dados: new Uint8Array(await f.arrayBuffer()) })));
}

const AVISO_ANEXOS =
  "O registro foi salvo, mas os anexos não puderam ser armazenados. Não repita a operação: anexe os arquivos novamente pela seção de anexos.";

/**
 * M3: o upload ocorre depois da transação; se falhar, o registro já existe. Não propaga erro
 * (evita retry que duplicaria/quebraria o fluxo) e devolve um aviso claro.
 */
async function anexarSemFalhar(a: Ator, alvo: anexos.Alvo, arquivos: anexos.ArquivoEnviado[]): Promise<string | null> {
  if (arquivos.length === 0) return null;
  try {
    await anexos.enviarAnexos(a, alvo, arquivos);
    return null;
  } catch (e) {
    console.error(`[anexos] falha ao anexar após salvar ${alvo.tipo}:${alvo.entidadeId}`, e);
    return AVISO_ANEXOS;
  }
}

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
  let falhaAnexo = false;
  const r = await executar(async () => {
    const d = esquemaNova.parse(obj(fd));
    const a = await getAtor();
    // Valida os anexos antes de criar a RNC (tipo/tamanho), para não abrir RNC com upload inválido.
    const arquivos = await arquivosDe(a, fd);
    const sensiveis = d.contemDadosPessoais && rnc.podeVerDadosSensiveis(a) ? await arquivosDe(a, fd, "arquivosSensiveis") : [];
    await anexos.validarArquivos(a, arquivos);
    await anexos.validarArquivos(a, sensiveis);
    const criada = await rnc.criarRnc(a, {
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
    const f1 = await anexarSemFalhar(a, { tipo: "RNC", entidadeId: criada.id }, arquivos);
    const f2 = await anexarSemFalhar(a, { tipo: "RNC_DADOS_SENSIVEIS", entidadeId: criada.id }, sensiveis);
    falhaAnexo = !!(f1 || f2);
  }, ["/rncs"]);
  if (id) redirect(`/rncs/${id}${falhaAnexo ? "?aviso=anexos" : ""}`);
  // Devolve os valores enviados para o formulário não perder o que foi digitado.
  return { ...r, valores: valoresDoForm(fd) };
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

export async function alterarResponsavelAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = esquemaTransicao.extend({ responsavelId: uuid }).parse(obj(fd));
    await rnc.alterarResponsavel(await getAtor(), d.id, d.responsavelId, d.versao);
    return { ok: "Responsável alterado." };
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
    const a = await getAtor();
    const arquivos = await arquivosDe(a, fd);
    await anexos.validarArquivos(a, arquivos);
    const r = await rnc.verificarEficacia(
      a,
      d.id,
      { eficaz: d.resultado === "EFICAZ", comentario: d.comentario },
      d.versao,
    );
    const falha = await anexarSemFalhar(a, { tipo: "VERIFICACAO_EFICACIA", entidadeId: r.verificacaoId }, arquivos);
    const aviso = [r.aviso, falha].filter(Boolean).join(" ") || undefined;
    return { ok: d.resultado === "EFICAZ" ? "RNC encerrada." : "RNC reaberta para novo ciclo.", aviso };
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

export async function adicionarItensAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ rncId: uuid, itens: itensJson }).parse(obj(fd));
    await plano.adicionarItensRnc(await getAtor(), d.rncId, d.itens);
    return { ok: `${d.itens.length} item(ns) adicionado(s).` };
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
    const a = await getAtor();
    const arquivos = await arquivosDe(a, fd, "arquivos", { tipo: "ITEM_ACAO", entidadeId: d.itemId });
    await anexos.validarArquivos(a, arquivos);
    await plano.concluirItem(a, d.itemId, d);
    const aviso = await anexarSemFalhar(a, { tipo: "ITEM_ACAO", entidadeId: d.itemId }, arquivos);
    return { ok: "Item concluído.", aviso: aviso ?? undefined };
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

// ---------------------------------------------------------------- anexos

const TIPOS_ANEXO = ["RNC", "RNC_DADOS_SENSIVEIS", "VERIFICACAO_EFICACIA", "PLANO_ACAO", "ITEM_ACAO"] as const;

function revalidarAnexos() {
  revalidatePath("/rncs/[id]", "page");
  revalidatePath("/plano-acao/[id]", "page");
  revalidatePath("/plano-acao/planos/[id]", "page");
}

export async function enviarAnexosAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ entidadeTipo: z.enum(TIPOS_ANEXO), entidadeId: uuid }).parse(obj(fd));
    const a = await getAtor();
    const alvo = { tipo: d.entidadeTipo, entidadeId: d.entidadeId };
    const arquivos = await arquivosDe(a, fd, "arquivos", alvo);
    if (arquivos.length === 0) return { erro: "Selecione ao menos um arquivo." };
    const r = await anexos.enviarAnexos(a, alvo, arquivos);
    revalidarAnexos();
    return { ok: `${r.length} arquivo(s) anexado(s).` };
  });
}

export async function excluirAnexoAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ anexoId: uuid }).parse(obj(fd));
    await anexos.excluirAnexo(await getAtor(), d.anexoId);
    revalidarAnexos();
    return { ok: "Anexo excluído." };
  });
}
