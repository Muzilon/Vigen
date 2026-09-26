"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";

export async function entrar(_prev: string | null, formData: FormData): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirectTo: "/",
    });
    return null;
  } catch (e) {
    if (e instanceof AuthError) {
      if (e instanceof CredentialsSignin && e.code === "bloqueado") {
        // Genérico: aplicado também a e-mails inexistentes (sem enumeração).
        return "Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.";
      }
      return e.type === "CredentialsSignin"
        ? "E-mail ou senha inválidos."
        : "Não foi possível entrar. Tente novamente.";
    }
    throw e; // redirect de sucesso
  }
}
