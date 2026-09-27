import Link from "next/link";
import { registrarCienciaAcao } from "@/app/(app)/documentos/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { veListaMestra } from "@/lib/documentos/acesso";
import { formatarRevisao } from "@/lib/documentos/regras";
import { meusDocumentos } from "@/lib/documentos/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/documentos-meus.module.css";

/** "Meus documentos": revisões vigentes publicadas para o usuário (público), com download e "Li e estou ciente". */
export default async function DocumentosMeus() {
  const ctx = await getContexto();
  exigirModulo(ctx, "DOCUMENTOS");
  const a = await getAtor();
  const [docs, fuso] = await Promise.all([meusDocumentos(a), fusoDaEmpresa(a)]);
  const pendentes = docs.filter((d) => d.exigirCiencia && !d.cienciaEm);
  const ordenados = [...pendentes, ...docs.filter((d) => !(d.exigirCiencia && !d.cienciaEm))];

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Meus documentos"
        contador={docs.length}
        subtitulo="Documentos vigentes publicados para você (por setor, unidade, perfil ou nominalmente)."
        acoes={veListaMestra(a) ? <LinkBotao href="/documentos" variante="secundario">Lista mestra</LinkBotao> : undefined}
      />
      {pendentes.length > 0 && (
        <p className={styles.aviso}>
          Você tem <strong>{pendentes.length}</strong> documento(s) aguardando sua ciência. Leia e confirme em &quot;Li e estou ciente&quot;.
        </p>
      )}
      {docs.length === 0 ? (
        <EstadoVazio>Nenhum documento publicado para você.</EstadoVazio>
      ) : (
        <ul className={styles.lista}>
          {ordenados.map((d) => {
            const pendente = d.exigirCiencia && !d.cienciaEm;
            return (
              <li key={d.id} className={`${styles.item} ${pendente ? styles.itemPendente : ""}`}>
                <div className={styles.principal}>
                  <p className={styles.codigo}>{d.codigo} · Rev. {formatarRevisao(d.numero)} · {d.tipo.nome}</p>
                  <Link href={`/documentos/${d.id}`} className={styles.titulo}>{d.titulo}</Link>
                  <p className={styles.meta}>
                    Publicado em {formatarData(d.publicadoEm)}
                    {d.processo ? ` · ${d.processo.codigo} — ${d.processo.nome}` : ""}
                  </p>
                </div>
                <div className={styles.acoes}>
                  {d.anexo && <a href={`/api/anexos/${d.anexo.id}`} className={styles.baixar}>Baixar</a>}
                  {d.exigirCiencia ? (
                    d.cienciaEm ? (
                      <span className={styles.ciente}>✓ Ciente em {formatarDataHora(d.cienciaEm, fuso)}</span>
                    ) : (
                      <FormAcao acao={registrarCienciaAcao} botao="Li e estou ciente" tamanho="pequeno" className={styles.formCiencia}>
                        <input type="hidden" name="id" value={d.id} />
                      </FormAcao>
                    )
                  ) : (
                    <span className={styles.semCiencia}>Ciência não exigida</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
