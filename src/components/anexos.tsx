import type { TipoEntidadeAnexo } from "@prisma/client";
import { enviarAnexosAcao, excluirAnexoAcao } from "@/app/(app)/rncs/actions";
import { CampoArquivos } from "@/components/campo-arquivos";
import { FormAcao } from "@/components/form-acao";
import { cls } from "@/components/ui";
import type { AnexoListado } from "@/lib/anexos/servico";
import { formatarDataHora } from "@/lib/datas";

const MINIATURA = new Set(["image/jpeg", "image/png", "image/webp"]);

function tamanho(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Galeria de anexos: miniaturas para imagens, lista para documentos. Download sempre via /api/anexos/[id]. */
export function GaleriaAnexos({ anexos, fuso, vazio = "Nenhum anexo." }: { anexos: AnexoListado[]; fuso: string; vazio?: string }) {
  if (anexos.length === 0) return <p className="text-sm text-slate-500">{vazio}</p>;
  const imagens = anexos.filter((x) => MINIATURA.has(x.mimeType));
  const docs = anexos.filter((x) => !MINIATURA.has(x.mimeType));
  const excluir = (x: AnexoListado) =>
    x.podeExcluir && (
      <FormAcao acao={excluirAnexoAcao} botao="Excluir" confirmar={`Excluir o anexo "${x.nomeArquivo}"?`} classeBotao="text-xs text-red-700 hover:underline">
        <input type="hidden" name="anexoId" value={x.id} />
      </FormAcao>
    );
  return (
    <div className="space-y-3">
      {imagens.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {imagens.map((x) => (
            <li key={x.id} className="text-xs">
              <a href={`/api/anexos/${x.id}?inline=1`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/anexos/${x.id}?inline=1`} alt={x.nomeArquivo} loading="lazy" className="h-28 w-full rounded border border-slate-200 object-cover" />
              </a>
              <p className="mt-1 truncate text-slate-700" title={x.nomeArquivo}>{x.nomeArquivo}</p>
              <p className="text-slate-400">{x.enviadoPor.nome} · {formatarDataHora(x.criadoEm, fuso)}</p>
              {excluir(x)}
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {docs.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <a href={`/api/anexos/${x.id}`} className="font-medium text-emerald-800 hover:underline">{x.nomeArquivo}</a>
                <span className="ml-2 text-xs text-slate-400">{tamanho(x.tamanhoBytes)} · {x.enviadoPor.nome} · {formatarDataHora(x.criadoEm, fuso)}</span>
              </div>
              {excluir(x)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Formulário para anexar arquivos a uma entidade existente. */
export function EnviarAnexos({ tipo, entidadeId, rotulo = "Adicionar anexos" }: { tipo: TipoEntidadeAnexo; entidadeId: string; rotulo?: string }) {
  return (
    <FormAcao acao={enviarAnexosAcao} botao="Enviar" classeBotao={`${cls.btnSec} mt-2`} className="mt-4 border-t border-slate-100 pt-3">
      <input type="hidden" name="entidadeTipo" value={tipo} />
      <input type="hidden" name="entidadeId" value={entidadeId} />
      <CampoArquivos rotulo={rotulo} />
    </FormAcao>
  );
}
