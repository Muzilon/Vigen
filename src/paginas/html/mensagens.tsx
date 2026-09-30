import Link from "next/link";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { linkThread, listarNaoLidas } from "@/lib/interacoes/servico";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/mensagens.module.css";

/** Pega as iniciais do nome para o "avatar" redondo: "Maria Silva" → "MS". */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Página "Mensagens": lista as mensagens novas (não lidas) que outras pessoas enviaram a você.
 * Clicar numa mensagem abre o registro onde a conversa está e a marca como lida.
 */
export default async function Mensagens() {
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Fuso horário da empresa, para mostrar as datas corretamente.
  const fuso = await fusoDaEmpresa(a);
  // Busca até 100 mensagens não lidas endereçadas ao usuário.
  const msgs = await listarNaoLidas(a, 100);
  return (
    <div className={`${styles.pagina} fonteBase`}>
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
                        {m.entidadeTipo === "RNC" ? "RNC" : m.entidadeTipo === "PROCESSO" ? "Processo" : m.entidadeTipo === "RISCO_OPORTUNIDADE" ? "Risco/oportunidade" : m.entidadeTipo === "HIRA" ? "Perigos e Riscos" : m.entidadeTipo === "LAIA" ? "LAIA" : m.entidadeTipo === "DOCUMENTO" ? "Documento" : m.entidadeTipo === "INCIDENTE" ? "Incidente" : m.entidadeTipo === "INSPECAO" ? "Inspeção" : m.entidadeTipo === "AUDITORIA" ? "Auditoria" : "Item de ação"} · <span className={styles.data}>{formatarDataHora(m.criadoEm, fuso)}</span>
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
