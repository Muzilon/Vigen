"use client";

import { Botao } from "@/paginas/html/componentes/botao";

export function BotaoImprimir({ rotulo = "Imprimir / salvar PDF", className }: { rotulo?: string; className?: string }) {
  return (
    <Botao type="button" variante="secundario" className={className} onClick={() => window.print()}>
      {rotulo}
    </Botao>
  );
}
