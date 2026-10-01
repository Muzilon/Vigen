import { cache } from "react";
import { prismaAdmin } from "@/lib/prisma";
import { permissoesEfetivas } from "@/lib/permissoes";

/**
 * Carrega os dados de sessão do usuário (fonte de verdade: banco).
 * Com cache() do React, o callback jwt (auth()) e o getContexto() dividem UMA leitura por requisição
 * em vez de duas; fora de uma renderização (scripts, testes) cada chamada consulta o banco normalmente.
 */
export const carregarDadosSessao = cache(async (usuarioId: string) => {
  const u = await prismaAdmin.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      perfil: { select: { permissoes: true } },
      empresa: { select: { nome: true, ativo: true, modulosAtivos: true, fusoHorario: true } },
      acessosObra: { select: { obraId: true } },
    },
  });
  if (!u || !u.ativo || !u.empresa.ativo) return null;
  return {
    userId: u.id,
    empresaId: u.empresaId,
    empresaNome: u.empresa.nome,
    fuso: u.empresa.fusoHorario,
    modulosAtivos: u.empresa.modulosAtivos,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    permissoes: permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []),
    escopoObras: u.escopoObras,
    obrasIds: u.escopoObras === "SELECIONADAS" ? u.acessosObra.map((a) => a.obraId) : null,
    tokenVersao: u.tokenVersao,
  };
});

export type DadosSessao = NonNullable<Awaited<ReturnType<typeof carregarDadosSessao>>>;

/** Checagem feita a cada leitura de sessão: usuário/empresa ativos e tokenVersao igual (reaproveita a leitura acima). */
export async function sessaoValida(usuarioId: string, tokenVersao: number) {
  const dados = await carregarDadosSessao(usuarioId);
  return !!dados && dados.tokenVersao === tokenVersao;
}
