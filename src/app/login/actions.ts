"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";

export type EstadoLogin = { erro: string; email: string } | null;

export async function entrar(_prev: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "");
  const erro = (m: string) => ({ erro: m, email });
  try {
    await signIn("credentials", {
      email,
      senha: formData.get("senha"),
      redirectTo: "/",
    });
    return null;
  } catch (e) {
    if (e instanceof AuthError) {
      if (e instanceof CredentialsSignin && e.code === "bloqueado") {
        // Genérico: aplicado também a e-mails inexistentes (sem enumeração).
        return erro("Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.");
      }
      return erro(e.type === "CredentialsSignin" ? "E-mail ou senha inválidos." : "Não foi possível entrar. Tente novamente.");
    }
    throw e; // redirect de sucesso
  }
}
