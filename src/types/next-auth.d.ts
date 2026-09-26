import type { DefaultSession } from "next-auth";

/** Somente dados de exibição vão para a sessão (exposta em /api/auth/session). */
interface CamposSessao {
  userId: string;
  nome: string;
  empresaNome: string;
}

declare module "next-auth" {
  interface Session {
    user: CamposSessao & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT extends Partial<CamposSessao> {
    /** Fica apenas no JWT (cifrado), nunca na sessão. */
    tokenVersao?: number;
  }
}
