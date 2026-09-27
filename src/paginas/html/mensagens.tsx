import Link from "next/link";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { linkThread, listarNaoLidas } from "@/lib/interacoes/servico";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/mensagens.module.css";

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Caixa "Mensagens": interações não lidas endereçadas ao usuário. Abrir a thread marca como lida. */
export default async function Mensagens() {
  const a = await getAtor();
  const fuso = await fusoDaEmpresa(a);
  const msgs = await listarNaoLidas(a, 100);
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina titulo="Mensagens" subtitulo={`${msgs.length} não lida(s)`} />
      <section className={styles.painel}>
        {msgs.length === 0 ? (
          <EstadoVazio>Nenhuma mensagem nova.</EstadoVazio>
        ) : (
          <ul className={styles.lista}>
            {msgs.map((m) => (
              <li key={m.id}>
                <Link href={linkThread(m)} className={styles.mensagem}>
                  <span className={styles.avatar} aria-hidden="true">{iniciais(m.autor.nome)}</span>
                  <span className={styles.corpo}>
                    <span className={styles.linhaAutor}>
                      <span className={styles.autor}>{m.autor.nome}</span>
                      <span className={styles.meta}>
                        {m.entidadeTipo === "RNC" ? "RNC" : m.entidadeTipo === "PROCESSO" ? "Processo" : m.entidadeTipo === "RISCO_OPORTUNIDADE" ? "Risco/oportunidade" : m.entidadeTipo === "HIRA" ? "HIRA" : m.entidadeTipo === "LAIA" ? "LAIA" : m.entidadeTipo === "DOCUMENTO" ? "Documento" : m.entidadeTipo === "REQUISITO_LEGAL" ? "Requisito legal" : m.entidadeTipo === "INCIDENTE" ? "Incidente" : m.entidadeTipo === "INSPECAO" ? "Inspeção" : m.entidadeTipo === "AUDITORIA" ? "Auditoria" : "Item de ação"} · <span className={styles.data}>{formatarDataHora(m.criadoEm, fuso)}</span>
                      </span>
                    </span>
                    <span className={styles.texto}>{m.mensagem}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
