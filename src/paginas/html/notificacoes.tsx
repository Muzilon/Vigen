import type { TipoNotificacao } from "@prisma/client";
import { abrirNotificacaoAcao, marcarLidaAcao, marcarTodasAcao } from "@/app/(app)/notificacoes/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { listarNotificacoes } from "@/lib/notificacoes/servico";
import { Botao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/notificacoes.module.css";

const ROTULO: Record<TipoNotificacao, string> = {
  RNC_ATRIBUIDA: "RNC atribuída",
  ITEM_ATRIBUIDO: "Ação atribuída",
  INTERACAO_NOVA: "Mensagem",
  CANCELAMENTO_SOLICITADO: "Cancelamento",
  CANCELAMENTO_DECIDIDO: "Cancelamento",
  RNC_EM_VERIFICACAO: "Verificação",
  ITEM_PRAZO_PROXIMO: "Prazo",
  ITEM_ATRASADO: "Atraso",
  RESUMO_SEMANAL: "Resumo semanal",
  APROVACAO_PENDENTE: "Aprovação",
  APROVACAO_DECIDIDA: "Aprovação",
  REAVALIACAO_PROXIMA: "Reavaliação",
  DOCUMENTO_PUBLICADO: "Documento publicado",
  CIENCIA_PENDENTE: "Ciência pendente",
  REVISAO_DOCUMENTO_PROXIMA: "Revisão de documento",
  AUDITORIA_ATRIBUIDA: "Auditoria atribuída",
};

export default async function Notificacoes({ searchParams }: PageProps<"/notificacoes">) {
  const sp = await searchParams;
  const somenteNaoLidas = sp.filtro === "nao-lidas";
  const a = await getAtor();
  const [fuso, lista] = await Promise.all([fusoDaEmpresa(a), listarNotificacoes(a, { somenteNaoLidas, take: 100 })]);
  const naoLidas = lista.filter((n) => !n.lidaEm).length;
  const aba = (ativo: boolean) => `${styles.aba} ${ativo ? styles.abaAtiva : ""}`;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Notificações"
        subtitulo={somenteNaoLidas ? `${lista.length} não lida(s)` : "Últimas 100 notificações"}
        acoes={
          naoLidas > 0 ? (
            <form action={marcarTodasAcao}>
              <Botao type="submit" variante="secundario">Marcar todas como lidas</Botao>
            </form>
          ) : null
        }
      />
      <nav className={styles.abas} aria-label="Filtro de notificações">
        <a href="/notificacoes" className={aba(!somenteNaoLidas)} aria-current={!somenteNaoLidas ? "page" : undefined}>Todas</a>
        <a href="/notificacoes?filtro=nao-lidas" className={aba(somenteNaoLidas)} aria-current={somenteNaoLidas ? "page" : undefined}>Não lidas</a>
      </nav>
      <section className={styles.painel}>
        {lista.length === 0 ? (
          <EstadoVazio>Nenhuma notificação.</EstadoVazio>
        ) : (
          <ul className={styles.lista}>
            {lista.map((n) => (
              <li key={n.id} className={`${styles.notificacao} ${n.lidaEm ? "" : styles.naoLida}`}>
                <span className={`${styles.ponto} ${n.lidaEm ? "" : styles.pontoAtivo}`} aria-hidden />
                <div className={styles.corpo}>
                  <div className={styles.meta}>
                    <span className={styles.etiqueta}>{ROTULO[n.tipo]}</span>
                    <span className={styles.data}>{formatarDataHora(n.criadoEm, fuso)}</span>
                    {!n.lidaEm && <span className={styles.somenteLeitor}>não lida</span>}
                  </div>
                  <form action={abrirNotificacaoAcao}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className={`${styles.titulo} ${n.lidaEm ? "" : styles.tituloNaoLida}`}>
                      {n.titulo}
                    </button>
                  </form>
                  <p className={styles.texto}>{n.corpo}</p>
                </div>
                {!n.lidaEm && (
                  <form action={marcarLidaAcao}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className={styles.marcarLida}>Marcar como lida</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
