"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResultadoAcao } from "@/components/form-acao";
import { getAtor } from "@/lib/ator-servidor";
import { linkPlano } from "@/lib/plano-acao/acesso";
import * as plano from "@/lib/plano-acao/servico";
import { executar, itensJson, obj, uuid, uuidOpcional, versao } from "../acoes-comuns";

const cabecalho = {
  titulo: z.string().trim().min(3, "Informe o título do plano (mínimo 3 caracteres).").max(200, "Título excede 200 caracteres."),
  descricao: z.string().trim().max(5000, "Objetivo excede 5000 caracteres.").transform((s) => s || null).nullish(),
};

/** Novo plano de ação avulso (origem MANUAL). Em erro, o formulário (controlado) mantém os dados. */
export async function criarPlanoManualAcao(_: ResultadoAcao, fd: FormData): Promise<ResultadoAcao> {
  let id = "";
  const r = await executar(async () => {
    const d = z.object({ ...cabecalho, obraId: uuidOpcional, itens: itensJson }).parse(obj(fd));
    const criado = await plano.criarPlanoManual(await getAtor(), d);
    id = criado.id;
  });
  if (id) redirect(linkPlano(id));
  return r;
}

export async function editarPlanoManualAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ planoId: uuid, versao, ...cabecalho }).parse(obj(fd));
    await plano.editarPlanoManual(await getAtor(), d.planoId, d, d.versao);
    return { ok: "Plano atualizado." };
  });
}

export async function adicionarItensPlanoAcao(_: ResultadoAcao, fd: FormData) {
  return executar(async () => {
    const d = z.object({ planoId: uuid, itens: itensJson }).parse(obj(fd));
    await plano.adicionarItensPlanoManual(await getAtor(), d.planoId, d.itens);
    return { ok: `${d.itens.length} item(ns) adicionado(s).` };
  });
}
