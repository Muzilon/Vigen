import type { ReactNode } from "react";

/**
 * Componentes Tailwind da geração anterior de UI, usados pelas páginas ainda
 * não migradas para a Direção A "Campo" (CSS Modules + tokens de
 * src/paginas/css/base.css). Ver docs/05-guia-paginas-css.md para o checklist
 * de migração — ao migrar uma página, pare de importar daqui e use os
 * componentes equivalentes em src/paginas/html/componentes/ (badge.tsx,
 * cabecalho-pagina.tsx, cartao.tsx, campo-formulario.tsx, etc.).
 *
 * src/components/ui.tsx reexporta este arquivo para não quebrar as páginas
 * que ainda não migraram.
 */

export function Badge({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cor}`}>
      {children}
    </span>
  );
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{titulo}</h1>
        {subtitulo && <div className="mt-1 text-sm text-slate-600">{subtitulo}</div>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Cartao({ titulo, children, acoes }: { titulo?: ReactNode; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {titulo && (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
          {acoes}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export const cls = {
  input:
    "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20",
  label: "mb-1 block text-xs font-medium text-slate-700",
  btn: "inline-flex items-center justify-center rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60",
  btnSec:
    "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60",
  btnPerigo:
    "inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60",
  th: "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
  td: "px-3 py-2 text-sm text-slate-700",
};
