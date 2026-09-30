"use client";

import { Botao } from "@/paginas/html/componentes/botao";

/**
 * Botão que abre a janela de impressão do navegador (de onde dá para "Salvar como PDF").
 * O arquivo começa com "use client" porque `window.print()` só existe no navegador,
 * e não no servidor.
 * - `rotulo`: texto do botão (padrão: "Imprimir / salvar PDF").
 * - `className`: classe CSS extra, se a página quiser ajustar o visual.
 */
export function BotaoImprimir({ rotulo = "Imprimir / salvar PDF", className }: { rotulo?: string; className?: string }) {
  return (
    <Botao type="button" variante="secundario" className={className} onClick={() => window.print()}>
      {rotulo}
    </Botao>
  );
}
