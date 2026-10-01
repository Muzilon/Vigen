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
import { AbasModulo } from "@/paginas/html/componentes/abas-modulo";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/documentos-meus.module.css";

/**
 * Página "Meus documentos": os documentos vigentes que foram publicados para o usuário (por setor, unidade,
 * perfil ou nominalmente), com opção de baixar e de confirmar ciência ("Li e estou ciente").
 * Os que aguardam ciência aparecem primeiro, com um aviso no topo.
 */
/** "Meus documentos": revisões vigentes publicadas para o usuário (público), com download e "Li e estou ciente". */
export default async function DocumentosMeus() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Documentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "DOCUMENTOS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo os documentos do usuário e o fuso horário da empresa.
  const [docs, fuso] = await Promise.all([meusDocumentos(a), fusoDaEmpresa(a)]);
  // Documentos que exigem ciência e o usuário ainda não confirmou.
  const pendentes = docs.filter((d) => d.exigirCiencia && !d.cienciaEm);
  // Lista final: primeiro os pendentes de ciência, depois os demais.
  const ordenados = [...pendentes, ...docs.filter((d) => !(d.exigirCiencia && !d.cienciaEm))];

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <CabecalhoPagina
        titulo="Meus documentos"
        contador={docs.length}
        subtitulo="Documentos vigentes publicados para você (por setor, unidade, perfil ou nominalmente)."
        acoes={veListaMestra(a) ? <LinkBotao href="/documentos" variante="secundario">Lista mestra</LinkBotao> : undefined}
      />
      <AbasModulo chave="documentos" />
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
            // Este documento específico está pendente de ciência? (muda o destaque do item)
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
                  {d.anexo && <a href={`/api/anexos/${d.anexo.id}`} target="_blank" rel="noopener noreferrer" className={styles.baixar}>Baixar</a>}
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
