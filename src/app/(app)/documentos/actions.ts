"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import type { Ator } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import * as anexos from "@/lib/anexos/servico";
import "@/lib/aprovacao/handlers";
import { montarPerguntasCiencia } from "@/lib/documentos/regras";
import * as doc from "@/lib/documentos/servico";
import { executar, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/documentos", "/documentos/meus", "/dashboard", "/processos/[id]", "/aprovacoes", "/configuracoes", ...(id ? [`/documentos/${id}`] : [])];
const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");

/** Arquivo único do campo `arquivo`. B3: tamanho declarado checado ANTES de ler o conteúdo. */
async function arquivoDe(a: Ator, fd: FormData): Promise<anexos.ArquivoEnviado | null> {
  const f = fd.getAll("arquivo").filter((v): v is File => v instanceof File && v.size > 0);
  if (f.length > 1) throw new z.ZodError([{ code: "custom", message: "Envie um único arquivo por revisão.", path: ["arquivo"], input: null }]);
  if (f.length === 0) return null;
  await anexos.prevalidarArquivos(a, [{ nome: f[0].name, tamanho: f[0].size }]);
  return { nome: f[0].name, dados: new Uint8Array(await f[0].arrayBuffer()) };
}

const periodicidade = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .pipe(z.number().int("Periodicidade inválida.").min(1, "Periodicidade entre 1 e 120 meses.").max(120, "Periodicidade entre 1 e 120 meses.").nullable())
  .nullish();

const esquemaNovo = z.object({
  tipoId: uuid,
  titulo: z.string().trim().min(3, "Informe o título (mín. 3 caracteres)."),
  descricao: opcional,
  processoId: uuidOpcional,
  obraId: uuidOpcional,
  setorId: uuidOpcional,
  responsavelId: uuid,
  periodicidadeRevisaoMeses: periodicidade,
  motivo: opcional,
});

export async function criarDocumentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = esquemaNovo.safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error), valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    const a = await getAtor();
    id = (await doc.criarDocumento(a, { ...d.data, arquivo: await arquivoDe(a, fd) })).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/documentos/${id}`);
}

export async function novaRevisaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, motivo: z.string().trim().min(3, "Descreva o motivo da revisão.") }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    const a = await getAtor();
    const r = await doc.novaRevisao(a, d.data.id, { motivo: d.data.motivo, arquivo: await arquivoDe(a, fd) }, d.data.versao);
    return { ok: `Revisão ${String(r.numero).padStart(2, "0")} criada em rascunho. Envie para revisão/aprovação quando estiver pronta.` };
  }, caminhos(d.data.id));
}

export async function substituirArquivoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, motivo: opcional }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    const a = await getAtor();
    await doc.substituirArquivo(a, d.data.id, { arquivo: await arquivoDe(a, fd), motivo: d.data.motivo });
    return { ok: "Arquivo da revisão substituído." };
  }, caminhos(d.data.id));
}

const listaIds = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s || "[]") as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Lista inválida." });
      return z.NEVER;
    }
  })
  .pipe(z.array(z.uuid("Usuário inválido.")));

export async function enviarAprovacaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ id: uuid, versao, revisorIds: listaIds, aprovadorIds: listaIds, modo: z.enum(["SEQUENCIAL", "PARALELO"], "Escolha o modo."), resumo: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { id, versao: v, ...dados } = d.data;
  return executar(async () => {
    await doc.enviarParaAprovacao(await getAtor(), id, dados, v);
    return { ok: "Revisão enviada. Os signatários foram notificados em Aprovações." };
  }, caminhos(id));
}

const ids = (fd: FormData, k: string) => fd.getAll(k).map(String).filter(Boolean).map((x) => uuid.parse(x));

/** Blocos crus do quiz (até 3): pergunta{n}, opcao{n}_1..3, correta{n}. */
function blocosQuizDe(fd: FormData) {
  return [1, 2, 3].map((n) => ({
    pergunta: String(fd.get(`pergunta${n}`) ?? ""),
    opcoes: [1, 2, 3].map((o) => String(fd.get(`opcao${n}_${o}`) ?? "")),
    correta: fd.get(`correta${n}`) as string | null,
  }));
}

export async function publicarAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    const perguntasCiencia = montarPerguntasCiencia(blocosQuizDe(fd));
    const r = await doc.publicar(
      await getAtor(),
      d.data.id,
      {
        publicoTodos: fd.get("publicoTodos") === "on",
        setorIds: ids(fd, "setorIds"),
        obraIds: ids(fd, "obraIds"),
        perfilIds: ids(fd, "perfilIds"),
        usuarioIds: ids(fd, "usuarioIds"),
        notificar: fd.get("notificar") === "on",
        exigirCiencia: fd.get("exigirCiencia") === "on",
        perguntasCiencia,
      },
      d.data.versao,
    );
    return { ok: `Rev. ${String(r.numero).padStart(2, "0")} publicada. A revisão anterior (se houver) ficou obsoleta.` };
  }, caminhos(d.data.id));
}

export async function cancelarDocumentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, motivo: z.string().trim().min(3, "Informe o motivo do cancelamento.") }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await doc.cancelar(await getAtor(), d.data.id, d.data.motivo, d.data.versao);
    return { ok: "Cancelado." };
  }, caminhos(d.data.id));
}

export async function obsoletarDocumentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, versao, motivo: z.string().trim().min(3, "Informe o motivo.") }).safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await doc.obsoletar(await getAtor(), d.data.id, d.data.motivo, d.data.versao);
    return { ok: "Documento retirado de uso (obsoleto)." };
  }, caminhos(d.data.id));
}

export async function registrarCienciaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await doc.registrarCiencia(await getAtor(), d.data.id);
    return { ok: "Ciência registrada. Obrigado!" };
  }, caminhos(d.data.id));
}

export async function registrarCienciaComQuizAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    const respostas = [0, 1, 2].map((n) => {
      const v = fd.get(`resposta${n}`);
      return v === null || v === "" ? null : Number(v);
    });
    await doc.registrarCienciaComQuiz(await getAtor(), d.data.id, respostas);
    return { ok: "Ciência registrada. Obrigado!" };
  }, caminhos(d.data.id));
}

export async function salvarTipoDocumentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({
      id: uuidOpcional,
      nome: z.string().trim().min(2, "Informe o nome do tipo."),
      sigla: z.string().trim().min(1, "Informe a sigla."),
      periodicidadeRevisaoMeses: z.coerce.number().int().min(1, "Periodicidade entre 1 e 120 meses.").max(120, "Periodicidade entre 1 e 120 meses."),
    })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await doc.salvarTipo(await getAtor(), { ...d.data, ativo: d.data.id ? fd.get("ativo") === "on" : true });
    return { ok: "Tipo de documento salvo." };
  }, caminhos());
}
