import type { EscopoObras, PapelUsuario, Permissao } from "@prisma/client";
import type { DefaultSession } from "next-auth";

interface CamposVigen {
  userId: string;
  empresaId: string;
  empresaNome: string;
  nome: string;
  papel: PapelUsuario;
  permissoes: Permissao[];
  escopoObras: EscopoObras;
  obrasIds: string[] | null;
  tokenVersao: number;
}

declare module "next-auth" {
  interface Session {
    user: CamposVigen & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT extends Partial<CamposVigen> {
    verificadoEm?: number;
  }
}
