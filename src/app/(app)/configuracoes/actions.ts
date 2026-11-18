"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import * as adm from "@/lib/admin/servico";
import { salvarConfigAprovacao } from "@/lib/aprovacao/config-modulo";
import type { Ator } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { ErroNegocio } from "@/lib/erros";
import { criarFeriado, editarFeriado, inativarFeriado } from "@/lib/feriados/servico";
import { MAX_DIAS_ALERTA } from "@/lib/notificacoes/preferencias";
import { salvarPreferencias } from "@/lib/notificacoes/preferencias-servico";
import { ErroPermissao, exigirPermissao } from "@/lib/tenant";

const esquema = z.object({
  diasAlertaPrazo: z.coerce
    .number("Informe a antecedência.")
    .int("Use um número inteiro.")
    .min(0, "Mínimo 0 dias.")
    .max(MAX_DIAS_ALERTA, `Máximo ${MAX_DIAS_ALERTA} dias.`),
  resumoSemanal: z.literal("on").optional(),
  email: z.literal("on").optional(),
});

export async function salvarPreferenciasAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  try {
    const ctx = await exigirPermissao("ADMIN_CONFIG");
    const d = esquema.safeParse(Object.fromEntries(fd.entries()));
    if (!d.success) return { erro: d.error.issues.map((i) => i.message).join(" ") };
    await salvarPreferencias(ctx.empresaId, {
      diasAlertaPrazo: d.data.diasAlertaPrazo,
      resumoSemanal: !!d.data.resumoSemanal,
      email: !!d.data.email,
    });
    revalidatePath("/configuracoes");
    return { ok: "Preferências salvas." };
  } catch (e) {
    if (e instanceof ErroNegocio || e instanceof ErroPermissao) return { erro: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------- administração

async function admin(fn: (a: Ator) => Promise<string>): Promise<ResultadoAcao> {
  try {
    const a = await getAtor();
    const ok = await fn(a);
    revalidatePath("/configuracoes");
    return { ok };
  } catch (e) {
    if (e instanceof ErroNegocio || e instanceof ErroPermissao) return { erro: e.message };
    throw e;
  }
}

const idDe = (fd: FormData) => {
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroNegocio("Registro inválido.");
  return id;
};
const txt = (fd: FormData, k: string) => (fd.get(k) === null ? undefined : String(fd.get(k)));

function dadosUsuario(fd: FormData) {
  return {
    nome: txt(fd, "nome"),
    email: txt(fd, "email"),
    papel: txt(fd, "papel"),
    perfilId: txt(fd, "perfilId"),
    setorId: txt(fd, "setorId"),
    funcaoId: txt(fd, "funcaoId"),
    escopoObras: txt(fd, "escopoObras"),
    obraIds: fd.getAll("obraIds").map(String),
  };
}

export async function criarUsuarioAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await adm.criarUsuario(a, { ...dadosUsuario(fd), senha: txt(fd, "senha") });
    return "Usuário criado.";
  });
}

export async function atualizarUsuarioAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    const r = await adm.atualizarUsuario(a, idDe(fd), dadosUsuario(fd));
    return r.mudouAcesso ? "Usuário atualizado. As sessões dele foram encerradas (acesso alterado)." : "Usuário atualizado.";
  });
}

export async function alternarUsuarioAtivoAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    const ativo = fd.get("ativo") === "true";
    await adm.definirUsuarioAtivo(a, idDe(fd), ativo);
    return ativo ? "Usuário reativado." : "Usuário desativado.";
  });
}

export async function redefinirSenhaAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await adm.redefinirSenha(a, idDe(fd), txt(fd, "senha"));
    return "Senha redefinida. As sessões do usuário foram encerradas.";
  });
}

function dadosPerfil(fd: FormData) {
  return { nome: txt(fd, "nome"), descricao: txt(fd, "descricao"), permissoes: fd.getAll("permissoes").map(String) };
}

export async function salvarPerfilAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    if (fd.get("id")) {
      await adm.atualizarPerfil(a, idDe(fd), dadosPerfil(fd));
      return "Perfil atualizado.";
    }
    await adm.criarPerfil(a, dadosPerfil(fd));
    return "Perfil criado.";
  });
}

export async function excluirPerfilAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await adm.excluirPerfil(a, idDe(fd));
    return "Perfil excluído.";
  });
}

export async function salvarObraAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    const id = fd.get("id") ? idDe(fd) : null;
    await adm.salvarObra(a, id, {
      nome: txt(fd, "nome"),
      codigo: txt(fd, "codigo"),
      endereco: txt(fd, "endereco"),
      ativo: fd.get("ativo") === "on",
    });
    return id ? "Unidade atualizada." : "Unidade criada.";
  });
}

export async function salvarSetorAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    const id = fd.get("id") ? idDe(fd) : null;
    await adm.salvarSetor(a, id, { nome: txt(fd, "nome"), ativo: fd.get("ativo") === "on" });
    return id ? "Setor atualizado." : "Setor criado.";
  });
}

export async function salvarFuncaoAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    const id = fd.get("id") ? idDe(fd) : null;
    await adm.salvarFuncao(a, id, { nome: txt(fd, "nome"), ativo: fd.get("ativo") === "on" });
    return id ? "Função atualizada." : "Função criada.";
  });
}

// ---------------------------------------------------------------- módulos contratados

export async function salvarModulosAtivosAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await adm.salvarModulosAtivos(a, fd.getAll("modulos").map(String));
    return "Módulos atualizados.";
  });
}

// ---------------------------------------------------------------- escalas

export async function salvarConfiguracaoEscalaAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await adm.salvarConfiguracaoEscala(a, {
      tipo: txt(fd, "tipo"),
      obraId: txt(fd, "obraId"),
      tamanho: txt(fd, "tamanho"),
      eixos: txt(fd, "eixos"),
      faixas: txt(fd, "faixas"),
      criteriosExtras: txt(fd, "criteriosExtras"),
    });
    return "Configuração de escala salva.";
  });
}

export async function excluirConfiguracaoEscalaAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await adm.excluirConfiguracaoEscala(a, idDe(fd));
    return "Configuração de escala excluída (volta a usar o padrão).";
  });
}

// ---------------------------------------------------------------- aprovação de HIRA/LAIA (decisão 5)

export async function salvarConfigAprovacaoAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    const modulo = txt(fd, "modulo");
    if (modulo !== "hira" && modulo !== "laia") throw new ErroNegocio("Módulo inválido.");
    const modo = txt(fd, "modo") === "PARALELO" ? "PARALELO" : "SEQUENCIAL";
    await salvarConfigAprovacao(a, modulo, { exigir: fd.get("exigir") === "on", aprovadorIds: fd.getAll("aprovadorIds").map(String), modo, usarTramitacao: fd.get("usarTramitacao") === "on" });
    return "Fluxo de aprovação atualizado.";
  });
}

// ---------------------------------------------------------------- feriados da empresa

/** Lê a versão (trava de edição) enviada escondida no formulário. */
const versaoDe = (fd: FormData) => {
  const v = Number(fd.get("versao"));
  if (!Number.isInteger(v) || v < 1) throw new ErroNegocio("Registro inválido.");
  return v;
};

/** Cadastra um feriado (data + descrição). O serviço valida e reativa a data se ela estava inativa. */
export async function criarFeriadoAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await criarFeriado(a, { data: txt(fd, "data"), descricao: txt(fd, "descricao") });
    return "Feriado salvo.";
  });
}

/** Edita data e descrição de um feriado ativo (com a versão que a tela mostrou). */
export async function editarFeriadoAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await editarFeriado(a, idDe(fd), versaoDe(fd), { data: txt(fd, "data"), descricao: txt(fd, "descricao") });
    return "Feriado atualizado.";
  });
}

/** Inativa um feriado (exclusão lógica). */
export async function inativarFeriadoAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await inativarFeriado(a, idDe(fd), versaoDe(fd));
    return "Feriado inativado.";
  });
}

/** Reativa um feriado inativo: o serviço reativa ao "cadastrar" de novo a mesma data. */
export async function reativarFeriadoAcao(_: ResultadoAcao, fd: FormData) {
  return admin(async (a) => {
    await criarFeriado(a, { data: txt(fd, "data"), descricao: txt(fd, "descricao") });
    return "Feriado reativado.";
  });
}
