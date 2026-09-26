"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/paginas/css/componentes/campo-arquivos.module.css";

const ACEITAR = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.docx,.xlsx,.txt";
const PREVIEW = new Set(["image/jpeg", "image/png", "image/webp"]);

type Sel = { nome: string; tamanho: number; url: string | null };

function formatarTamanho(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Input de arquivos (múltiplos) com pré-visualização de imagens. Validação real é no servidor.
 * Visual: área tracejada clicável (o <input type="file"> fica visualmente oculto, mas focável).
 */
export function CampoArquivos({
  nome = "arquivos",
  rotulo = "Anexos",
  ajuda = "Imagens (JPG, PNG, WEBP, HEIC), PDF, DOCX, XLSX ou TXT — até 10 MB cada, máx. 5 por envio.",
  maxMb = 10,
}: {
  nome?: string;
  rotulo?: string;
  ajuda?: string;
  maxMb?: number;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState<Sel[]>([]);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const limpar = () => setSel([]);
    form.addEventListener("reset", limpar);
    return () => form.removeEventListener("reset", limpar);
  }, []);

  useEffect(() => () => sel.forEach((s) => s.url && URL.revokeObjectURL(s.url)), [sel]);

  const grandes = sel.filter((s) => s.tamanho > maxMb * 1024 * 1024);

  return (
    <div className={styles.campo}>
      <span className={styles.rotulo} id={`${id}-rotulo`}>{rotulo}</span>
      <label htmlFor={id} className={styles.areaSoltar}>
        <IconeEnviar />
        <span>
          <span className={styles.chamada}>Selecionar arquivos</span>
          {sel.length > 0 && <span className={styles.contagem}> · {sel.length} selecionado(s)</span>}
        </span>
        <input
          ref={ref}
          id={id}
          type="file"
          name={nome}
          multiple
          accept={ACEITAR}
          aria-labelledby={`${id}-rotulo`}
          aria-describedby={`${id}-ajuda`}
          onChange={(e) =>
            setSel(
              [...(e.target.files ?? [])].map((f) => ({
                nome: f.name,
                tamanho: f.size,
                url: PREVIEW.has(f.type) ? URL.createObjectURL(f) : null,
              })),
            )
          }
          className={styles.entradaOculta}
        />
      </label>
      <p id={`${id}-ajuda`} className={styles.ajuda}>{ajuda}</p>
      {sel.length > 0 && (
        <ul className={styles.previas}>
          {sel.map((s, i) => (
            <li key={i} className={styles.previa}>
              {s.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt={s.nome} className={styles.miniatura} />
              ) : (
                <div className={styles.miniaturaDocumento}>{s.nome.split(".").pop()}</div>
              )}
              <p className={styles.nomeArquivo} title={s.nome}>{s.nome}</p>
              <p className={styles.tamanho}>{formatarTamanho(s.tamanho)}</p>
            </li>
          ))}
        </ul>
      )}
      {grandes.length > 0 && (
        <p className={styles.erroTamanho}>Acima de {maxMb} MB: {grandes.map((g) => g.nome).join(", ")}</p>
      )}
    </div>
  );
}

function IconeEnviar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}
