"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { revalidarContadoresAcao } from "@/app/(app)/notificacoes/actions";

/**
 * Leituras marcadas durante o render de uma página (ex.: thread de interações) não refletem
 * no layout já renderizado. Montado quando algo foi marcado: revalida e atualiza o layout.
 */
export function AtualizarContadores() {
  const router = useRouter();
  useEffect(() => {
    void revalidarContadoresAcao().then(() => router.refresh());
  }, [router]);
  return null;
}
