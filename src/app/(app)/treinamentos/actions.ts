"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import * as anexos from "@/lib/anexos/servico";
import { getAtor } from "@/lib/ator-servidor";
import * as tr from "@/lib/treinamentos/servico";
import { executar, obj, opcional, uuid, uuidOpcional, valoresDoForm, versao } from "../acoes-comuns";

const caminhos = (id?: string | null) => ["/treinamentos", "/treinamentos/matriz", "/treinamentos/meus", "/treinamentos/auditoria", "/dashboard", ...(id ? [`/treinamentos/${id}`] : [])];
const erros = (e: z.ZodError) => e.issues.map((i) => i.message).join(" ");
const inteiroOpcional = (msg: string) =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .pipe(z.number(msg).int(msg).positive(msg).nullable())
    .nullish();

const esquemaDados = z.object({
  nome: z.string(),
  tipo: z.enum(["INTEGRACAO", "NR", "RECICLAGEM", "TECNICO", "CONSCIENTIZACAO", "OUTRO"], "Tipo inválido."),
  documentoId: uuidOpcional,
  descricao: opcional,
  cargaHoraria: inteiroOpcional("Carga horária inválida."),
  validadeMeses: inteiroOpcional("Validade inválida."),
  obrigatorioTodos: z.literal("1").optional(),
  critico: z.literal("1").optional(),
  diasAvaliacaoEficacia: inteiroOpcional("Prazo da avaliação de eficácia inválido."),
});
const dadosDoForm = (fd: FormData) => {
  const d = esquemaDados.safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) } as const;
  const setores = fd.getAll("obrigatorioSetorIds").map(String).filter(Boolean);
  const s = z.array(z.uuid("Setor inválido.")).safeParse(setores);
  if (!s.success) return { erro: erros(s.error) } as const;
  const f = z.array(z.uuid("Função inválida.")).safeParse(fd.getAll("obrigatorioFuncaoIds").map(String).filter(Boolean));
  if (!f.success) return { erro: erros(f.error) } as const;
  return { dados: { ...d.data, obrigatorioTodos: d.data.obrigatorioTodos === "1", critico: d.data.critico === "1", obrigatorioSetorIds: s.data, obrigatorioFuncaoIds: f.data } } as const;
};

export async function criarTreinamentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = dadosDoForm(fd);
  if ("erro" in d) return { erro: d.erro, valores: valoresDoForm(fd) };
  let id = "";
  const r = await executar(async () => {
    id = (await tr.criarTreinamento(await getAtor(), d.dados)).id;
  }, caminhos());
  if (r?.erro) return { ...r, valores: valoresDoForm(fd) };
  redirect(`/treinamentos/${id}`);
}

export async function editarTreinamentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = dadosDoForm(fd);
  if ("erro" in d) return { erro: d.erro };
  const x = z.object({ id: uuid, versao }).safeParse(obj(fd));
  if (!x.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await tr.editarTreinamento(await getAtor(), x.data.id, d.dados, x.data.versao);
    return { ok: "Treinamento salvo." };
  }, caminhos(x.data.id));
}

export async function definirAtivoTreinamentoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, ativo: z.enum(["0", "1"]) }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await tr.definirAtivoTreinamento(await getAtor(), d.data.id, d.data.ativo === "1");
    return { ok: d.data.ativo === "1" ? "Treinamento reativado." : "Treinamento inativado." };
  }, caminhos(d.data.id));
}

export async function registrarSessaoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({
      treinamentoId: uuid,
      dataRealizacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de realização."),
      instrutor: z.string(),
      obraId: uuidOpcional,
      cargaHoraria: inteiroOpcional("Carga horária inválida."),
      observacao: opcional,
      modalidade: z.enum(["PRESENCIAL", "EAD", "SEMIPRESENCIAL"], "Modalidade inválida."),
      conteudoProgramatico: opcional,
      qualificacaoInstrutor: opcional,
    })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { treinamentoId, ...dados } = d.data;
  return executar(async () => {
    await tr.registrarSessao(await getAtor(), treinamentoId, dados);
    return { ok: "Sessão registrada. Lance a presença abaixo." };
  }, caminhos(treinamentoId));
}

/**
 * Presença em lote: para cada usuário listado em `usuarios`, `presenca_<id>` = "" (não participa), "P" (presente) ou
 * "A" (ausente); `aproveitamento_<id>` opcional; `certificado_<id>` = arquivo opcional (PDF/imagem).
 */
export async function lancarPresencasAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const x = z.object({ sessaoId: uuid, treinamentoId: uuid }).safeParse(obj(fd));
  if (!x.success) return { erro: "Dados inválidos." };
  const ids = fd.getAll("usuarios").map(String);
  if (!z.array(z.uuid()).safeParse(ids).success) return { erro: "Participante inválido." };
  const linhas = ids
    .map((id) => ({ usuarioId: id, marca: String(fd.get(`presenca_${id}`) ?? ""), aproveitamento: String(fd.get(`aproveitamento_${id}`) ?? "").trim() || null }))
    .filter((l) => l.marca === "P" || l.marca === "A")
    .map((l) => ({ usuarioId: l.usuarioId, presente: l.marca === "P", aproveitamento: l.aproveitamento }));
  const certificados = ids
    .map((id) => ({ id, arquivo: fd.get(`certificado_${id}`) }))
    .filter((c): c is { id: string; arquivo: File } => c.arquivo instanceof File && c.arquivo.size > 0);
  return executar(async () => {
    const a = await getAtor();
    await anexos.prevalidarArquivos(a, certificados.map((c) => ({ nome: c.arquivo.name, tamanho: c.arquivo.size })));
    const semPresenca = certificados.filter((c) => !linhas.some((l) => l.usuarioId === c.id));
    if (semPresenca.length) return { erro: "Há certificado para quem não foi marcado como presente/ausente." };
    const participacoes = await tr.lancarPresencas(a, x.data.sessaoId, linhas);
    for (const c of certificados) {
      await tr.anexarCertificado(a, participacoes.get(c.id)!, { nome: c.arquivo.name, dados: new Uint8Array(await c.arquivo.arrayBuffer()) });
    }
    const pres = linhas.filter((l) => l.presente).length;
    return { ok: `Presença registrada: ${pres} presente(s), ${linhas.length - pres} ausente(s)${certificados.length ? `, ${certificados.length} certificado(s)` : ""}.` };
  }, caminhos(x.data.treinamentoId));
}

export async function registrarGatilhoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({
      treinamentoId: uuid,
      usuarioId: uuid,
      motivo: z.enum(["MUDANCA_FUNCAO", "RETORNO_AFASTAMENTO", "ACIDENTE_INCIDENTE", "MUDANCA_PROCEDIMENTO", "OUTRO"], "Motivo inválido."),
      dataEvento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do evento."),
      descricao: opcional,
    })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  const { treinamentoId, ...dados } = d.data;
  return executar(async () => {
    await tr.registrarGatilho(await getAtor(), { ...dados, treinamentoIds: [treinamentoId] });
    return { ok: "Gatilho registrado: reciclagem pendente até a próxima sessão." };
  }, caminhos(treinamentoId));
}

export async function excluirGatilhoAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z.object({ id: uuid, treinamentoId: uuid }).safeParse(obj(fd));
  if (!d.success) return { erro: "Dados inválidos." };
  return executar(async () => {
    await tr.excluirGatilho(await getAtor(), d.data.id);
    return { ok: "Gatilho excluído." };
  }, caminhos(d.data.treinamentoId));
}

export async function avaliarEficaciaAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  const d = z
    .object({ participacaoId: uuid, treinamentoId: uuid, resultado: z.enum(["EFICAZ", "NAO_EFICAZ"], "Escolha o resultado."), observacao: opcional })
    .safeParse(obj(fd));
  if (!d.success) return { erro: erros(d.error) };
  return executar(async () => {
    await tr.avaliarEficacia(await getAtor(), d.data.participacaoId, d.data.resultado, d.data.observacao);
    return { ok: "Avaliação de eficácia registrada." };
  }, caminhos(d.data.treinamentoId));
}
