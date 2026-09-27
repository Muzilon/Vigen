"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import styles from "@/paginas/css/componentes/cartao-swipe.module.css";

const LIMIAR_PX = 80;

/**
 * Progressive enhancement para telas < 768px: envolve o fieldset de resposta (radio buttons, que
 * continuam 100% funcionais) e permite arrastar o cartão — direita = primeira opção (conforme/sim),
 * esquerda = segunda opção (não conforme/não). Ao passar do limiar, marca o radio correspondente e
 * envia o formulário existente (`form.requestSubmit()`); não duplica a lógica de submit do FormAcao.
 * `valorDireita`/`valorEsquerda` devem ser os `value` exatos dos inputs radio dentro de `children`.
 */
export function CartaoSwipe({ valorDireita, valorEsquerda, children }: { valorDireita: string; valorEsquerda: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inicioX = useRef<number | null>(null);
  const [deslocamento, setDeslocamento] = useState(0);
  const [arrastando, setArrastando] = useState(false);

  function aoDescer(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return; // swipe é affordance de toque; mouse usa os radios normalmente.
    inicioX.current = e.clientX;
    setArrastando(true);
  }

  function aoMover(e: ReactPointerEvent<HTMLDivElement>) {
    if (inicioX.current === null) return;
    setDeslocamento(e.clientX - inicioX.current);
  }

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
