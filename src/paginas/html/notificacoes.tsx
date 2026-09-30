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

// Texto curto (etiqueta) mostrado para cada tipo de notificação.
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
  INCIDENTE_REGISTRADO: "Incidente registrado",
  INCIDENTE_ATRIBUIDO: "Investigação de incidente",
  INDICADOR_SEM_LANCAMENTO: "Indicador sem lançamento",
  TREINAMENTO_VENCENDO: "Treinamento vencendo",
};

/**
 * Página "Notificações": as últimas 100 notificações do usuário, com filtro "Todas / Não lidas",
 * botão de marcar todas como lidas e, em cada uma, o título (clicável: abre o registro) e "Marcar como lida".
 */
export default async function Notificacoes({ searchParams }: PageProps<"/notificacoes">) {
  // Lê o filtro da URL: `?filtro=nao-lidas` mostra só as não lidas.
  const sp = await searchParams;
  // Verdadeiro quando o filtro "Não lidas" está ativo.
  const somenteNaoLidas = sp.filtro === "nao-lidas";
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo o fuso horário da empresa e as notificações (máximo 100).
  const [fuso, lista] = await Promise.all([fusoDaEmpresa(a), listarNotificacoes(a, { somenteNaoLidas, take: 100 })]);
  // Quantas das listadas ainda não foram lidas (decide se mostra o botão "Marcar todas como lidas").
  const naoLidas = lista.filter((n) => !n.lidaEm).length;
  // Monta as classes de CSS de uma aba do filtro, destacando a que está ativa.
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
