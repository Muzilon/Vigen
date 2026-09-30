"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import styles from "@/paginas/css/componentes/cartao-swipe.module.css";

// Distância mínima (em pixels) que o dedo precisa arrastar para a resposta ser confirmada.
const LIMIAR_PX = 80;

/**
 * Progressive enhancement para telas < 768px: envolve o fieldset de resposta (radio buttons, que
 * continuam 100% funcionais) e permite arrastar o cartão — direita = primeira opção (conforme/sim),
 * esquerda = segunda opção (não conforme/não). Ao passar do limiar, marca o radio correspondente e
 * envia o formulário existente (`form.requestSubmit()`); não duplica a lógica de submit do FormAcao.
 * `valorDireita`/`valorEsquerda` devem ser os `value` exatos dos inputs radio dentro de `children`.
 */
export function CartaoSwipe({ valorDireita, valorEsquerda, children }: { valorDireita: string; valorEsquerda: string; children: ReactNode }) {
  // `ref`: aponta para a caixa do cartão no HTML (para procurar os botões de resposta dentro dela).
  const ref = useRef<HTMLDivElement>(null);
  // `inicioX`: posição horizontal onde o dedo encostou; guardada sem provocar nova renderização.
  const inicioX = useRef<number | null>(null);
  // `deslocamento`: quanto o cartão já foi arrastado (negativo = esquerda, positivo = direita).
  const [deslocamento, setDeslocamento] = useState(0);
  // `arrastando`: verdadeiro enquanto o dedo está na tela.
  const [arrastando, setArrastando] = useState(false);

  /** Dedo encostou no cartão: anota onde começou. O mouse é ignorado (usa os botões normais). */
  function aoDescer(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return; // swipe é affordance de toque; mouse usa os radios normalmente.
    inicioX.current = e.clientX;
    setArrastando(true);
  }

  /** Dedo se movendo: atualiza o quanto o cartão deslocou para ele acompanhar o dedo. */
  function aoMover(e: ReactPointerEvent<HTMLDivElement>) {
    if (inicioX.current === null) return;
    setDeslocamento(e.clientX - inicioX.current);
  }

  /** Marca a opção de resposta correspondente ao lado arrastado e envia o formulário. */
  function confirmar(valor: string) {
    const raiz = ref.current;
    if (!raiz) return;
    const input = raiz.querySelector<HTMLInputElement>(`input[type="radio"][value="${valor}"]`);
    if (!input) return;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const form = input.closest("form");
    form?.requestSubmit();
  }

  /** Dedo soltou: se arrastou além do limite, confirma a resposta; depois o cartão volta ao centro. */
  function aoSoltar() {
    setArrastando(false);
    inicioX.current = null;
    if (deslocamento > LIMIAR_PX) confirmar(valorDireita);
    else if (deslocamento < -LIMIAR_PX) confirmar(valorEsquerda);
    setDeslocamento(0);
  }

  const passouLimiar = Math.abs(deslocamento) > LIMIAR_PX;
  const classeOverlay = deslocamento > 0 ? styles.overlayDireita : styles.overlayEsquerda;

  return (
    <div
      ref={ref}
      className={styles.cartaoSwipe}
      onPointerDown={aoDescer}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      style={arrastando ? { transform: `translateX(${deslocamento}px) rotate(${deslocamento / 20}deg)` } : undefined}
    >
      {arrastando && deslocamento !== 0 && (
        <div className={`${styles.overlay} ${classeOverlay} ${passouLimiar ? styles.overlayAtivo : ""}`} aria-hidden="true">
          {deslocamento > 0 ? "Conforme →" : "← Não conforme"}
        </div>
      )}
      {children}
    </div>
  );
}
