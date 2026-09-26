import Link from "next/link";
import { notFound } from "next/navigation";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { ItemAcoes } from "@/paginas/html/componentes/item-acoes";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { linkPlano, podeGerenciarPlanoManual } from "@/lib/plano-acao/acesso";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { cicloAtual } from "@/lib/rnc/estados";
import { filtroAcessoItem, filtroAcessoRnc, podeGerenciarPlanoRnc } from "@/lib/rnc/servico";
import { BadgeStatusItem } from "@/paginas/html/componentes/badge-status-item";
import styles from "@/paginas/css/plano-acao-item.module.css";

const DIA_MS = 86_400_000;
// Colunas @db.Date chegam como meia-noite UTC: o dia da semana é lido em UTC para não deslocar.
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });

/** Texto do chip de prazo (só para itens em aberto): "vence hoje", "vence em 3 dias", "atrasado há 2 dias". */
function textoPrazo(dias: number) {
  if (dias === 0) return "vence hoje";
  if (dias > 0) return `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  return `atrasado há ${-dias} ${dias === -1 ? "dia" : "dias"}`;
}

/**
 * Página do item de ação (responsiva, estilo Mobile-Item.dc.html).
 * Visão reduzida do item (B4): o "quem" vê o próprio item e sua thread mesmo sem acesso à RNC,
 * sem descrição, causa raiz, outros itens ou dados sensíveis da RNC.
 */
export default async function PlanoAcaoItem({ params }: PageProps<"/plano-acao/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const item = await a.db.itemAcao.findFirst({
    where: { AND: [{ id }, filtroAcessoItem(a)] },
    include: {
      quem: { select: { nome: true } },
      planoAcao: {
        select: {
          id: true,
          titulo: true,
          obraId: true,
          rnc: { select: { id: true, codigo: true, status: true, responsavelId: true, obraId: true, verificacoes: { select: { resultado: true } } } },
        },
      },
    },
  });
  if (!item) notFound();
  const rnc = item.planoAcao.rnc;
  const rncVisivel = !rnc || (await a.db.rnc.count({ where: { AND: [{ id: rnc.id }, filtroAcessoRnc(a)] } })) > 0;
  const fuso = await fusoDaEmpresa(a);
  const hoje = hojeNoFuso(fuso);
  const st = statusEfetivoItem(item, hoje);
  const atual = !rnc || item.ciclo === cicloAtual(rnc.verificacoes);
  const ativos = (await usuariosAtivos(a.db)).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  const usuarios = ativos.map((u) => ({ id: u.id, nome: u.nome }));
  // "Quem": só usuários ativos com acesso à obra da RNC / do plano avulso (mantém o atual na lista).
  const obraQuem = rnc ? rnc.obraId : item.planoAcao.obraId;
  const usuariosQuem = ativos
    .filter((u) => !obraQuem || u.obras === null || u.obras.includes(obraQuem) || u.id === item.quemId)
    .map((u) => ({ id: u.id, nome: u.nome }));
  const podeGerenciar =
    atual &&
    (rnc
      ? rncVisivel && podeGerenciarPlanoRnc(a, rnc) && (rnc.status === "EM_ANALISE" || rnc.status === "PLANO_EM_EXECUCAO")
      : podeGerenciarPlanoManual(a, item.planoAcao));
  const podeExecutar = atual && item.quemId === a.usuarioId && (!rnc || rnc.status === "PLANO_EM_EXECUCAO");
  const alvoAnexo = { tipo: "ITEM_ACAO" as const, entidadeId: item.id };
  const [anexos, podeAnexar] = await Promise.all([listarAnexos(a, alvoAnexo), podeEnviarAnexo(a, alvoAnexo)]);

  const aberto = item.status === "PENDENTE" || item.status === "EM_ANDAMENTO";
  const diasParaPrazo = Math.round((item.quando.getTime() - paraDataDb(hoje).getTime()) / DIA_MS);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/plano-acao" className={styles.linkVoltar}>
          <IconeVoltar />
          Plano de Ação
        </Link>
        <span aria-hidden="true">/</span>
        {rnc ? (
          rncVisivel ? (
            <Link href={`/rncs/${rnc.id}?aba=plano`} className={styles.linkCodigo}>{rnc.codigo}</Link>
          ) : (
            <span className={styles.codigoOculto}>{rnc.codigo}</span>
          )
        ) : (
          <Link href={linkPlano(item.planoAcao.id)} className={styles.linkPlano}>Plano manual: {item.planoAcao.titulo}</Link>
        )}
      </nav>

      {/* 1. Cartão do item (5W2H) */}
      <section aria-label="Item do plano" className={styles.cartaoItem}>
        <div className={styles.linhaSelos}>
          <BadgeStatusItem status={st} />
          {aberto && (
            <span className={diasParaPrazo < 0 ? styles.chipPrazoAtrasado : diasParaPrazo <= 2 ? styles.chipPrazoProximo : styles.chipPrazo}>
              <IconeRelogio />
              {textoPrazo(diasParaPrazo)}
            </span>
          )}
        </div>

        <div>
          <div className={styles.rotuloOQue}>O quê</div>
          <h1 className={styles.titulo}>{item.oQue}</h1>
        </div>

        <dl className={styles.detalhes}>
          <dt>Prazo</dt>
          <dd>
            <span className={styles.data}>{formatarData(item.quando)}</span> · {fmtDiaSemana.format(item.quando)}
          </dd>
          <dt>Quem</dt>
          <dd>{item.quem.nome}</dd>
          <dt>Onde</dt>
          <dd>{item.onde ?? "—"}</dd>
          <dt>Por quê</dt>
          <dd>{item.porQue ?? "—"}</dd>
          <dt>Como</dt>
          <dd>{item.como ?? "—"}</dd>
          <dt>Quanto</dt>
          <dd className={styles.data}>
            {item.quanto ? Number(item.quanto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          </dd>
        </dl>

        {item.evidenciaConclusao && (
          <div className={styles.evidencia}>
            <div className={styles.rotuloEvidencia}>Evidência ({formatarData(item.dataConclusao)})</div>
            <p className={styles.textoEvidencia}>{item.evidenciaConclusao}</p>
          </div>
        )}
      </section>

      {/* 2. Ações (iniciar / concluir / editar / cancelar) — componente compartilhado */}
      <section aria-label="Ações do item" className={styles.acoes}>
        <ItemAcoes
          item={item}
          rncId={rnc && rncVisivel ? rnc.id : undefined}
          hoje={hoje}
          usuarios={usuariosQuem}
          podeExecutar={podeExecutar}
          podeGerenciar={podeGerenciar}
        />
      </section>

      {/* 3. Evidências / anexos */}
      <section aria-labelledby="t-evid" className={styles.cartao}>
        <div className={styles.cabecalhoCartao}>
          <h2 id="t-evid" className={styles.tituloCartao}>
            Evidências / anexos
            {anexos.length > 0 && <span className={styles.contagem}> · {anexos.length}</span>}
          </h2>
        </div>
        <GaleriaAnexos anexos={anexos} fuso={fuso} />
        {podeAnexar && <EnviarAnexos tipo="ITEM_ACAO" entidadeId={item.id} />}
      </section>

      {/* 4. Interações (thread do item) — componente compartilhado */}
      <Interacoes a={a} tipo="ITEM_ACAO" entidadeId={item.id} usuarios={usuarios} fuso={fuso} />
    </div>
  );
}

function IconeVoltar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconeRelogio() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
