import type { Metadata } from "next";
import { LoginPagina } from "@/paginas/html/login";

export const metadata: Metadata = { title: "Entrar — Vigen" };

export default function LoginPage() {
  return <LoginPagina />;
}
