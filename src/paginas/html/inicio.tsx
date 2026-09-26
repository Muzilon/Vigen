import Link from "next/link";
import { atorTem, fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { linkThread, listarNaoLidas } from "@/lib/interacoes/servico";
import { filtroAcessoItem, filtroAcessoRnc } from "@/lib/rnc/servico";
import { getContexto } from "@/lib/tenant";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import styles from "@/paginas/css/inicio.module.css";

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Início — resumo do usuário logado (ver Inicio.dc.html, Direção A "Campo"). */
export default async function Inicio() {
  const ctx = await getContexto();
  const a = await getAtor();
  const fuso = await fusoDaEmpresa(a);
  const hoje = paraDataDb(hojeNoFuso(fuso));
  const gestor = atorTem(a, "PLANO_GERENCIAR");
  const abertos = { status: { in: ["PENDENTE" as const, "EM_ANDAMENTO" as const] } };

  const [rncsAbertas, atrasados, meus, mensagens] = await Promise.all([
    // B7: mesma regra de acesso do detalhe e da lista.
    a.db.rnc.count({ where: { AND: [filtroAcessoRnc(a), { status: { notIn: ["ENCERRADO", "CANCELADO"] } }] } }),
    a.db.itemAcao.count({ where: { AND: [gestor ? filtroAcessoItem(a) : { quemId: a.usuarioId }, abertos, { quando: { lt: hoje } }] } }),
    a.db.itemAcao.count({ where: { AND: [abertos, { quemId: a.usuarioId }] } }),
    listarNaoLidas(a, 5),
  ]);

  const cards = [
    { rotulo: "RNCs abertas", valor: rncsAbertas, href: "/rncs", destaque: styles.valorInformativo },
    { rotulo: "Itens atrasados", valor: atrasados, href: `/plano-acao?escopo=${gestor ? "todos" : "meus"}&status=ATRASADO`, destaque: styles.valorAlerta },
    { rotulo: "Meus itens pendentes", valor: meus, href: "/plano-acao", destaque: styles.valorAcento },
  ];

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina titulo={`Olá, ${ctx.usuario.nome}`} subtitulo={ctx.usuario.empresaNome} />

      <div className={styles.gradeIndicadores}>
        {cards.map((c) => (
          <Link key={c.rotulo} href={c.href} className={styles.indicador}>
            <span className={styles.rotuloIndicador}>{c.rotulo}</span>
            <span className={`${styles.valorIndicador} ${c.valor > 0 ? c.destaque : styles.valorZerado}`}>{c.valor}</span>
          </Link>
        ))}
      </div>

      <section className={styles.painelMensagens}>
        <div className={styles.cabecalhoPainel}>
          <h2 className={styles.tituloPainel}>Mensagens não lidas</h2>
          <Link href="/mensagens" className={styles.linkPainel}>Ver todas</Link>
        </div>
        {mensagens.length === 0 ? (
          <p className={styles.semMensagens}>Nenhuma mensagem nova.</p>
        ) : (
          <ul className={styles.listaMensagens}>
            {mensagens.map((m) => (
              <li key={m.id}>
                <Link href={linkThread(m)} className={styles.mensagem}>
                  <span className={styles.avatar} aria-hidden="true">{iniciais(m.autor.nome)}</span>
                  <span className={styles.corpoMensagem}>
                    <span className={styles.linhaAutor}>
                      <span className={styles.autor}>{m.autor.nome}</span>
                      <span className={styles.dataMensagem}>{formatarDataHora(m.criadoEm, fuso)}</span>
                    </span>
                    <span className={styles.textoMensagem}>{m.mensagem}</span>
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
