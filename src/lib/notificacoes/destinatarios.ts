import type { Permissao } from "@prisma/client";
import type { Ator } from "@/lib/ator";
import type { DbTenant } from "@/lib/db-tenant";
import { permissoesEfetivas } from "@/lib/permissoes";

type Db = Pick<DbTenant, "usuario">;

export interface UsuarioAtivo {
  id: string;
  nome: string;
  email: string;
  papel: string;
  permissoes: Permissao[];
  /** null = todas as obras. */
  obras: string[] | null;
}

/** Usuários ativos da empresa (db do tenant) com permissões efetivas e obras. */
export async function usuariosAtivos(db: Db): Promise<UsuarioAtivo[]> {
  const us = await db.usuario.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      escopoObras: true,
      perfil: { select: { permissoes: true } },
      acessosObra: { select: { obraId: true } },
    },
  });
  return us.map((u) => {
    const permissoes = permissoesEfetivas(u.papel, u.perfil?.permissoes ?? []);
    const todas = u.escopoObras === "TODAS" || permissoes.includes("VER_TODAS_OBRAS");
    return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, permissoes, obras: todas ? null : u.acessosObra.map((x) => x.obraId) };
  });
}

export interface RncParaAcesso {
  obraId: string;
  restrita: boolean;
  abertoPorId: string;
  responsavelId: string | null;
}

/** Mesma regra de filtroAcessoRnc, avaliada em memória para um usuário. */
export function usuarioAcessaRnc(u: Pick<UsuarioAtivo, "id" | "permissoes" | "obras">, rnc: RncParaAcesso) {
  const envolvido = rnc.abertoPorId === u.id || rnc.responsavelId === u.id;
  if (rnc.restrita && !envolvido && !u.permissoes.includes("RNC_VER_RESTRITAS")) return false;
  return u.obras === null || u.obras.includes(rnc.obraId) || envolvido;
}

/** Usuários com a permissão e acesso à RNC (exceto os ids excluídos). */
export async function usuariosComPermissaoNaRnc(db: Db, rnc: RncParaAcesso, permissao: Permissao, excluir: string[] = []) {
  return (await usuariosAtivos(db)).filter(
    (u) => !excluir.includes(u.id) && u.permissoes.includes(permissao) && usuarioAcessaRnc(u, rnc),
  );
}

/** Ator equivalente ao usuário (para reusar serviços que respeitam visibilidade). */
export function atorDoUsuario(db: DbTenant, empresaId: string, u: UsuarioAtivo): Ator {
  return { db, empresaId, usuarioId: u.id, permissoes: u.permissoes, obrasPermitidas: u.obras };
}
