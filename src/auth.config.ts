import type { NextAuthConfig } from "next-auth";

/** Config compatível com o proxy (sem Prisma/bcrypt). */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const logado = !!auth?.user?.userId;
      const { pathname } = request.nextUrl;
      if (pathname === "/login") {
        return logado ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return logado; // false → redireciona para /login
    },
    session({ session, token }) {
      // B6: não expor empresaId, permissões, obras ou tokenVersao ao cliente.
      if (token.userId) {
        session.user = {
          ...session.user,
          id: token.userId,
          userId: token.userId,
          nome: token.nome!,
          name: token.nome!,
          empresaNome: token.empresaNome!,
        };
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
