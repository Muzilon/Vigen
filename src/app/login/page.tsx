import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Entrar — Vigen" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-emerald-700">Vigen</h1>
          <p className="mt-1 text-sm text-slate-500">Gestão de Qualidade, Segurança e Meio Ambiente</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Acesse sua conta</h2>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
