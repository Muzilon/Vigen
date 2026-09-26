import { prismaAdmin } from "@/lib/prisma";
import { permissoesEfetivas } from "@/lib/permissoes";

/** Carrega os dados de sessão do usuário (fonte de verdade: banco). */
export async function carregarDadosSessao(usuarioId: string) {
  const u = await prismaAdmin.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      perfil: { select: { permissoes: true } },
      empresa: { select: { nome: true, ativo: true } },
      acessosObra: { select: { obraId: true } },
    },
  });
  if (!u || !u.ativo || !u.empresa.ativo) return null;
  return {
    userId: u.id,
    empresaId: u.empresaId,
    empresaNome: u.empresa.nome,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    permissoes: permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []),
    escopoObras: u.escopoObras,
    obrasIds: u.escopoObras === "SELECIONADAS" ? u.acessosObra.map((a) => a.obraId) : null,
    tokenVersao: u.tokenVersao,
  };
}

export type DadosSessao = NonNullable<Awaited<ReturnType<typeof carregarDadosSessao>>>;

/** Checagem leve feita a cada leitura de sessão: usuário/empresa ativos e tokenVersao igual. */
export async function sessaoValida(usuarioId: string, tokenVersao: number) {
  const u = await prismaAdmin.usuario.findUnique({
    where: { id: usuarioId },
    select: { ativo: true, tokenVersao: true, empresa: { select: { ativo: true } } },
  });
  return !!u && u.ativo && u.empresa.ativo && u.tokenVersao === tokenVersao;
}
