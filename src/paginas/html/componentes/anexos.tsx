import type { TipoEntidadeAnexo } from "@prisma/client";
import { enviarAnexosAcao, excluirAnexoAcao } from "@/app/(app)/rncs/actions";
import { CampoArquivos } from "@/paginas/html/componentes/campo-arquivos";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import type { AnexoListado } from "@/lib/anexos/servico";
import { formatarDataHora } from "@/lib/datas";
import styles from "@/paginas/css/componentes/anexos.module.css";

const MINIATURA = new Set(["image/jpeg", "image/png", "image/webp"]);

function tamanho(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Galeria de anexos: miniaturas para imagens, lista para documentos. Download sempre via /api/anexos/[id]. */
export function GaleriaAnexos({ anexos, fuso, vazio = "Nenhum anexo." }: { anexos: AnexoListado[]; fuso: string; vazio?: string }) {
  if (anexos.length === 0) return <p className={styles.vazio}>{vazio}</p>;
  const imagens = anexos.filter((x) => MINIATURA.has(x.mimeType));
  const docs = anexos.filter((x) => !MINIATURA.has(x.mimeType));
  const excluir = (x: AnexoListado) =>
    x.podeExcluir && (
      <FormAcao acao={excluirAnexoAcao} botao="Excluir" confirmar={`Excluir o anexo "${x.nomeArquivo}"?`} classeBotao={styles.botaoExcluir}>
        <input type="hidden" name="anexoId" value={x.id} />
      </FormAcao>
    );
  return (
    <div className={styles.galeria}>
      {imagens.length > 0 && (
        <ul className={styles.gradeImagens}>
          {imagens.map((x) => (
            <li key={x.id} className={styles.itemImagem}>
              <a href={`/api/anexos/${x.id}?inline=1`} target="_blank" rel="noopener noreferrer" className={styles.linkMiniatura}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/anexos/${x.id}?inline=1`} alt={x.nomeArquivo} loading="lazy" className={styles.miniatura} />
              </a>
              <p className={styles.nomeImagem} title={x.nomeArquivo}>{x.nomeArquivo}</p>
              <p className={styles.metaImagem}>{x.enviadoPor.nome} · {formatarDataHora(x.criadoEm, fuso)}</p>
              {excluir(x)}
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && (
        <ul className={styles.listaDocumentos}>
          {docs.map((x) => (
            <li key={x.id} className={styles.itemDocumento}>
              <span className={styles.iconeDocumento} aria-hidden="true">{x.nomeArquivo.split(".").pop()}</span>
              <div className={styles.textoDocumento}>
                <a href={`/api/anexos/${x.id}`} className={styles.linkDocumento}>{x.nomeArquivo}</a>
                <span className={styles.metaDocumento}>{tamanho(x.tamanhoBytes)} · {x.enviadoPor.nome} · {formatarDataHora(x.criadoEm, fuso)}</span>
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
    <FormAcao acao={enviarAnexosAcao} botao="Enviar" variante="secundario" tamanho="pequeno" className={styles.formEnviar}>
      <input type="hidden" name="entidadeTipo" value={tipo} />
      <input type="hidden" name="entidadeId" value={entidadeId} />
      <CampoArquivos rotulo={rotulo} />
    </FormAcao>
  );
}
