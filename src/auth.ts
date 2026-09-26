import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { autenticar, ipDaRequisicao } from "@/lib/auth/limite-login";
import { prismaAdmin } from "@/lib/prisma";
import { carregarDadosSessao, sessaoValida } from "@/lib/usuario-sessao";

const credenciaisSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  senha: z.string().min(1).max(200),
});

class LoginBloqueado extends CredentialsSignin {
  code = "bloqueado";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      async authorize(raw, request) {
        const parsed = credenciaisSchema.safeParse(raw);
        if (!parsed.success) throw new CredentialsSignin();
        const r = await autenticar(prismaAdmin, parsed.data.email, parsed.data.senha, ipDaRequisicao(request));
        if (!r.ok) throw r.motivo === "bloqueado" ? new LoginBloqueado() : new CredentialsSignin();
        return { id: r.usuarioId };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        const dados = await carregarDadosSessao(user.id);
        if (!dados) return null;
        return {
          ...token,
          userId: dados.userId,
          nome: dados.nome,
          name: dados.nome,
          empresaNome: dados.empresaNome,
          tokenVersao: dados.tokenVersao,
        };
      }
      if (!token.userId) return null;
      // Toda leitura de sessão no servidor confere ativo + tokenVersao no banco (M3).
      if (!(await sessaoValida(token.userId, token.tokenVersao ?? -1))) return null;
      return token;
    },
  },
});
