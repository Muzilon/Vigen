"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  abrirNotificacaoAcao,
  listarPainelAcao,
  marcarTodasAcao,
  type NotificacaoPainel,
} from "@/app/(app)/notificacoes/actions";
import styles from "@/paginas/css/componentes/painel-notificacoes.module.css";

/**
 * Sino do cabeçalho + painel flutuante (popover) de notificações.
 * Carrega a lista ao abrir (server action), fecha com Esc / clique fora /
 * navegação e devolve o foco ao sino. Ver docs/05-guia-paginas-css.md §6.
 */
export function PainelNotificacoes({ naoLidas }: { naoLidas: number }) {
  const [aberto, setAberto] = useState(false);
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [lista, setLista] = useState<NotificacaoPainel[] | null>(null);
  const [erro, setErro] = useState(false);
  const [pendente, iniciar] = useTransition();
  const idPainel = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const sino = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const carregar = useCallback((filtro: boolean) => {
    setErro(false);
    iniciar(async () => {
      try {
        setLista(await listarPainelAcao(filtro));
      } catch {
        setErro(true);
      }
    });
  }, []);

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) sino.current?.focus();
  }, []);

  function alternar() {
    if (aberto) return fechar();
    setAberto(true);
    carregar(somenteNaoLidas);
  }

  // Fecha ao navegar (sem roubar o foco da nova página).
  const [caminhoAnterior, setCaminhoAnterior] = useState(pathname);
  if (caminhoAnterior !== pathname) {
    setCaminhoAnterior(pathname);
    setAberto(false);
  }

  // Foco no painel ao abrir; Esc e clique fora fecham.
  useEffect(() => {
    if (!aberto) return;
    painel.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    const clique = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) fechar(false);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", clique);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", clique);
    };
  }, [aberto, fechar]);

  function trocarFiltro(filtro: boolean) {
    setSomenteNaoLidas(filtro);
    carregar(filtro);
  }

  function marcarTodas() {
    iniciar(async () => {
      await marcarTodasAcao();
      router.refresh();
      setLista(await listarPainelAcao(somenteNaoLidas));
    });
  }

  const temNaoLidas = (lista ?? []).some((n) => !n.lida) || naoLidas > 0;

  return (
    <div ref={raiz} className={styles.ancora}>
      <button
        ref={sino}
        type="button"
        onClick={alternar}
        aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lida(s)` : "Notificações"}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={idPainel}
        className={styles.botaoSino}
      >
        <IconeSino />
        {naoLidas > 0 && <span className={styles.contadorSino}>{naoLidas > 99 ? "99+" : naoLidas}</span>}
      </button>

      <div
        ref={painel}
        id={idPainel}
        role="dialog"
        aria-label="Notificações"
        tabIndex={-1}
        hidden={!aberto}
        className={styles.painel}
        data-aberto={aberto ? "" : undefined}
      >
        <div className={styles.topo}>
          <h2 className={styles.titulo}>Notificações</h2>
          {temNaoLidas && (
            <button type="button" className={styles.linkAcao} onClick={marcarTodas} disabled={pendente}>
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className={styles.filtro} role="group" aria-label="Filtro de notificações">
          <button type="button" className={styles.aba} aria-pressed={!somenteNaoLidas} onClick={() => trocarFiltro(false)}>
            Todas
          </button>
          <button type="button" className={styles.aba} aria-pressed={somenteNaoLidas} onClick={() => trocarFiltro(true)}>
            Não lidas
          </button>
        </div>

        <div className={styles.corpoLista} aria-busy={pendente}>
          {erro ? (
            <p className={styles.vazio}>Não foi possível carregar as notificações.</p>
          ) : lista === null ? (
            <p className={styles.vazio}>Carregando…</p>
          ) : lista.length === 0 ? (
            <p className={styles.vazio}>Nenhuma notificação.</p>
          ) : (
            <ul className={styles.lista}>
              {lista.map((n) => (
                <li key={n.id}>
                  <form action={abrirNotificacaoAcao} onSubmit={() => fechar(false)}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className={`${styles.item} ${n.lida ? "" : styles.itemNaoLido}`}>
                      <span className={styles.icone} aria-hidden>
                        <IconeTipo tipo={n.tipo} />
                      </span>
                      <span className={styles.textos}>
                        <span className={styles.tituloItem}>{n.titulo}</span>
                        <span className={styles.textoItem}>{n.corpo}</span>
                        <time className={styles.tempo} dateTime={n.criadoEm}>{tempoRelativo(n.criadoEm)}</time>
                      </span>
                      {!n.lida && (
                        <>
                          <span className={styles.ponto} aria-hidden />
                          <span className={styles.somenteLeitor}>não lida</span>
                        </>
                      )}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.rodape}>
          <Link href="/notificacoes" className={styles.linkAcao} onClick={() => fechar(false)}>
            Ver todas
          </Link>
        </div>
      </div>
    </div>
  );
}

function tempoRelativo(iso: string) {
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "agora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? "há 1 dia" : `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const svg = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconeTipo({ tipo }: { tipo: string }) {
  switch (tipo) {
    case "INTERACAO_NOVA":
      return (
        <svg {...svg}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "ITEM_PRAZO_PROXIMO":
    case "ITEM_ATRASADO":
      return (
        <svg {...svg}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "CANCELAMENTO_SOLICITADO":
    case "CANCELAMENTO_DECIDIDO":
      return (
        <svg {...svg}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15 9-6 6M9 9l6 6" />
        </svg>
      );
    case "RNC_EM_VERIFICACAO":
      return (
        <svg {...svg}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "ITEM_ATRIBUIDO":
      return (
        <svg {...svg}>
          <path d="M9 11l3 3 8-8" />
          <path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "RESUMO_SEMANAL":
      return (
        <svg {...svg}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    default:
      return (
        <svg {...svg}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M12 12v4M12 18h.01" />
        </svg>
      );
  }
}

function IconeSino() {
  return (
    <svg {...svg} width={18} height={18} aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
