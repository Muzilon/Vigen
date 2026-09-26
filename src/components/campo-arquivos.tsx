"use client";

import { useEffect, useRef, useState } from "react";

const ACEITAR = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.docx,.xlsx,.txt";
const PREVIEW = new Set(["image/jpeg", "image/png", "image/webp"]);

type Sel = { nome: string; tamanho: number; url: string | null };

function formatarTamanho(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Input de arquivos (múltiplos) com pré-visualização de imagens. Validação real é no servidor. */
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
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-700">{rotulo}</label>
      <input
        ref={ref}
        type="file"
        name={nome}
        multiple
        accept={ACEITAR}
        onChange={(e) =>
          setSel(
            [...(e.target.files ?? [])].map((f) => ({
              nome: f.name,
              tamanho: f.size,
              url: PREVIEW.has(f.type) ? URL.createObjectURL(f) : null,
            })),
          )
        }
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
      <p className="mt-1 text-xs text-slate-500">{ajuda}</p>
      {sel.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {sel.map((s, i) => (
            <li key={i} className="w-24 text-center">
              {s.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt={s.nome} className="h-20 w-24 rounded border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-20 w-24 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  {s.nome.split(".").pop()}
                </div>
              )}
              <p className="mt-0.5 truncate text-[11px] text-slate-600" title={s.nome}>{s.nome}</p>
              <p className="text-[10px] text-slate-400">{formatarTamanho(s.tamanho)}</p>
            </li>
          ))}
        </ul>
      )}
      {grandes.length > 0 && (
        <p className="mt-1 text-xs text-red-700">Acima de {maxMb} MB: {grandes.map((g) => g.nome).join(", ")}</p>
      )}
    </div>
  );
}
