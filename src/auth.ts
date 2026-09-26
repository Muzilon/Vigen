import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prismaAdmin } from "@/lib/prisma";
import { carregarDadosSessao } from "@/lib/usuario-sessao";

const REVALIDAR_MS = 5 * 60 * 1000;

const credenciaisSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1),
});

// Hash fixo para igualar tempo de resposta quando o e-mail não existe.
const HASH_DUMMY = bcrypt.hashSync("vigen-dummy", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      async authorize(raw) {
        const parsed = credenciaisSchema.safeParse(raw);
        if (!parsed.success) throw new CredentialsSignin();
        const { email, senha } = parsed.data;
        const u = await prismaAdmin.usuario.findUnique({
          where: { email },
          select: { id: true, senhaHash: true, ativo: true, empresa: { select: { ativo: true } } },
        });
        const ok = await bcrypt.compare(senha, u?.senhaHash ?? HASH_DUMMY);
        if (!u || !ok || !u.ativo || !u.empresa.ativo) throw new CredentialsSignin();
        await prismaAdmin.usuario.update({ where: { id: u.id }, data: { ultimoLogin: new Date() } });
        return { id: u.id };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        const dados = await carregarDadosSessao(user.id);
        if (!dados) return null;
        return { ...token, ...dados, name: dados.nome, verificadoEm: Date.now() };
      }
      if (!token.userId) return null;
      if (Date.now() - (token.verificadoEm ?? 0) > REVALIDAR_MS) {
        const dados = await carregarDadosSessao(token.userId);
        // Inativo, removido ou tokenVersao alterada → invalida a sessão.
        if (!dados || dados.tokenVersao !== token.tokenVersao) return null;
        return { ...token, ...dados, name: dados.nome, verificadoEm: Date.now() };
      }
      return token;
    },
  },
});
