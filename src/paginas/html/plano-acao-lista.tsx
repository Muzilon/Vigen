import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ItemAcoes } from "@/paginas/html/componentes/item-acoes";
import { linkPlano, podeConcluirItem, podeGerenciarPlanoManual } from "@/lib/plano-acao/acesso";
import { atorTem, fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, hojeNoFuso, paraDataDb, somarDias } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { concluidoForaDoPrazo, statusEfetivoItem, type StatusEfetivoItem } from "@/lib/plano-acao/status";
import { cicloAtual } from "@/lib/rnc/estados";
import { ROTULO_STATUS_ITEM } from "@/lib/rnc/rotulos";
import { filtroAcessoItem, filtroAcessoRnc, podeGerenciarPlanoRnc } from "@/lib/rnc/servico";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { BadgeSemEvidencia, BadgeStatusItem } from "@/paginas/html/componentes/badge-status-item";
import { EnvoltorioTabela, LinhaCabecalhoTabela, LinhaTabela, Tabela, Td, Th } from "@/paginas/html/componentes/tabela";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/plano-acao-lista.module.css";

/** Rótulo curto da origem de planos sem RNC (lista de itens). */
const ROTULO_ORIGEM_PLANO: Partial<Record<string, string>> = { MANUAL: "Manual", RISCO_OPORTUNIDADE: "Risco", HIRA: "Perigos e Riscos", LAIA: "LAIA", INSPECAO: "Inspeção", AUDITORIA: "Auditoria", INCIDENTE: "Incidente" };

// Regra de validação dos filtros da URL (escopo, status, responsável e prazo); valores inválidos viram "sem filtro".
const esquemaFiltros = z.object({
  escopo: enumUrl(["meus", "todos"]),
  status: enumUrl(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO", "ATRASADO"]),
  responsavel: uuidUrl,
  prazo: enumUrl(["vencidos", "7dias"]),
});

/** Pega as iniciais do nome para o "avatar" redondo: "Maria Silva" → "MS". */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Quantos milissegundos tem um dia (usado para calcular os dias de atraso).
const DIA_MS = 86_400_000;
// Colunas @db.Date chegam como meia-noite UTC: o dia da semana é lido em UTC para não deslocar.
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** Grupos de prazo da tabela — derivados só do status efetivo e da data "quando" do item. */
type Grupo = "atrasados" | "semana" | "depois" | "encerrados";
// Decide em qual grupo da tabela o item entra: atrasados, próximos 7 dias, depois ou encerrados.
function grupoDoItem(st: StatusEfetivoItem, quando: Date, em7: Date): Grupo {
  if (st === "ATRASADO") return "atrasados";
  if (st === "CONCLUIDO" || st === "CANCELADO") return "encerrados";
  return quando <= em7 ? "semana" : "depois";
}

/**
 * Página "Plano de Ação": lista unificada dos itens 5W2H (de RNCs e de planos avulsos), agrupados por prazo.
 * Tem abas "Meus itens" / "Todos" (só quem gerencia vê todos) e filtros de status, responsável e prazo.
 */
/** Plano de Ação — visão unificada dos itens 5W2H (RNC + planos avulsos). Ver PlanoAcao.dc.html. */
export default async function PlanoAcaoLista({ searchParams }: PageProps<"/plano-acao">) {
  // Lê e valida os filtros da URL.
  const sp = esquemaFiltros.parse(await searchParams);
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // `podeTodos`: verdadeiro se o usuário pode gerenciar planos (então pode ver os itens de todos).
  const podeTodos = atorTem(a, "PLANO_GERENCIAR");
  // Filtros efetivos: quem não gerencia sempre vê só "meus", mesmo que peça "todos" na URL.
  const f = {
    escopo: podeTodos && sp.escopo === "todos" ? "todos" : "meus",
    status: sp.status,
    responsavel: sp.responsavel,
    prazo: sp.prazo,
  };
  // Fuso horário da empresa, para calcular "hoje" corretamente.
  const fuso = await fusoDaEmpresa(a);
  // Data de hoje (no fuso da empresa) e, nas linhas seguintes, versões para comparar com as datas do banco.
  const hoje = hojeNoFuso(fuso);
  const hojeDb = paraDataDb(hoje);
  // Data daqui a 7 dias (limite do grupo "Próximos 7 dias").
  const em7Iso = somarDias(hoje, 7);
  const em7 = paraDataDb(em7Iso);
  // Filtro reaproveitado: itens ainda em aberto (pendentes ou em andamento).
  const abertos: Prisma.ItemAcaoWhereInput = { status: { in: ["PENDENTE", "EM_ANDAMENTO"] } };

  // Monta a consulta ao banco juntando as condições: escopo, status, responsável e prazo.
  const where: Prisma.ItemAcaoWhereInput = {
    AND: [
      // "Meus": todos os itens em que sou o quem, mesmo de RNC que não vejo (B4).
      f.escopo === "meus" ? { quemId: a.usuarioId } : filtroAcessoItem(a),
      f.status === "ATRASADO"
        ? { ...abertos, quando: { lt: hojeDb } }
        : f.status
          ? { status: f.status }
          : f.escopo === "meus"
            ? abertos
            : {},
      f.responsavel && f.escopo === "todos" ? { quemId: f.responsavel } : {},
      f.prazo === "vencidos" ? { quando: { lt: hojeDb } } : {},
      f.prazo === "7dias" ? { quando: { gte: hojeDb, lte: em7 } } : {},
    ],
  };

  // Busca em paralelo os itens (com responsável e plano/RNC de origem, no máximo 300) e a lista de usuários ativos para o filtro.
  const [itens, usuarios] = await Promise.all([
    a.db.itemAcao.findMany({
      where,
      orderBy: [{ quando: "asc" }],
      take: 300,
      include: {
        quem: { select: { nome: true } },
        planoAcao: {
          select: {
            id: true,
            titulo: true,
            origemTipo: true,
            obraId: true,
            rnc: { select: { id: true, codigo: true, status: true, responsavelId: true, verificacoes: { select: { resultado: true } } } },
          },
        },
      },
    }),
    a.db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  // Ids das RNCs de origem dos itens (sem repetir).
  const idsRnc = [...new Set(itens.flatMap((i) => (i.planoAcao.rnc ? [i.planoAcao.rnc.id] : [])))];
  // Dessas RNCs, quais o usuário realmente pode ver (para só criar link para as permitidas).
  const rncsVisiveis = new Set(
    idsRnc.length
      ? (await a.db.rnc.findMany({ where: { AND: [{ id: { in: idsRnc } }, filtroAcessoRnc(a)] }, select: { id: true } })).map((r) => r.id)
      : [],
  );

  // Monta um endereço da própria página mantendo os filtros atuais e trocando o que vier em `p`.
  const link = (p: Record<string, string>) => `?${new URLSearchParams({ ...f, ...p }).toString()}`;

  // Agrupamento por prazo: a query já vem ordenada por "quando", então cada grupo preserva a ordem.
  const linhas = itens.map((i) => {
    const st = statusEfetivoItem(i, hoje);
    return { i, st, grupo: grupoDoItem(st, i.quando, em7) };
  });
  const grupos: { chave: Grupo; titulo: string; detalhe?: string }[] = [
    { chave: "atrasados", titulo: "Atrasados" },
    { chave: "semana", titulo: "Próximos 7 dias", detalhe: `até ${formatarData(em7Iso)}` },
    { chave: "depois", titulo: "Depois" },
    { chave: "encerrados", titulo: "Concluídos / cancelados" },
  ];

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <CabecalhoPagina
        titulo="Plano de Ação"
        contador={itens.length}
        subtitulo="Todos os itens de ação, independente da origem."
        acoes={
          podeTodos && (
            <LinkBotao href="/plano-acao/novo">
              <IconeMais />
              Novo plano de ação
            </LinkBotao>
          )
        }
      />

      <nav aria-label="Escopo" className={styles.abas}>
        <Link href={link({ escopo: "meus" })} aria-current={f.escopo === "meus" ? "page" : undefined} className={f.escopo === "meus" ? styles.abaAtiva : styles.aba}>
          Meus itens
        </Link>
        {podeTodos && (
          <Link href={link({ escopo: "todos" })} aria-current={f.escopo === "todos" ? "page" : undefined} className={f.escopo === "todos" ? styles.abaAtiva : styles.aba}>
            Todos
          </Link>
        )}
      </nav>

      <form className={styles.barraFiltros}>
        <input type="hidden" name="escopo" value={f.escopo} />
        <Rotulo htmlFor="p-status" oculto>Status</Rotulo>
        <Selecao id="p-status" name="status" defaultValue={f.status}>
          <option value="">{f.escopo === "meus" ? "Status: Em aberto" : "Status: Todos"}</option>
          {Object.entries(ROTULO_STATUS_ITEM).map(([v, r]) => (
            <option key={v} value={v}>{r}</option>
          ))}
        </Selecao>
        {f.escopo === "todos" && (
          <>
            <Rotulo htmlFor="p-resp" oculto>Responsável</Rotulo>
            <Selecao id="p-resp" name="responsavel" defaultValue={f.responsavel}>
              <option value="">Responsável: Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </Selecao>
          </>
        )}
        <Rotulo htmlFor="p-prazo" oculto>Prazo</Rotulo>
        <Selecao id="p-prazo" name="prazo" defaultValue={f.prazo}>
          <option value="">Prazo: Qualquer</option>
          <option value="vencidos">Prazo vencido</option>
          <option value="7dias">Próximos 7 dias</option>
        </Selecao>
        <Botao type="submit" variante="secundario">Filtrar</Botao>
        <span className={styles.espacador} />
        {itens.length > 0 && <span className={styles.notaAgrupamento}>Agrupado por prazo</span>}
      </form>

      <EnvoltorioTabela>
        <div className={styles.rolagemTabela}>
          <Tabela>
            <colgroup>
              <col className={styles.colOrigem} />
              <col />
              <col className={styles.colQuem} />
              <col className={styles.colQuando} />
              <col className={styles.colStatus} />
              <col className={styles.colAcoes} />
            </colgroup>
            <thead>
              <LinhaCabecalhoTabela>
                <Th scope="col">Origem</Th>
                <Th scope="col">O quê</Th>
                <Th scope="col">Quem</Th>
                <Th scope="col">Quando</Th>
                <Th scope="col">Status</Th>
                <Th scope="col">Ações</Th>
              </LinhaCabecalhoTabela>
            </thead>
            {grupos.map((g) => {
              const doGrupo = linhas.filter((l) => l.grupo === g.chave);
              if (doGrupo.length === 0) return null;
              return (
                <tbody key={g.chave}>
                  <tr>
                    <th scope="colgroup" colSpan={6} className={g.chave === "atrasados" ? styles.grupoAtrasado : styles.grupo}>
                      <span className={styles.tituloGrupo}>
                        {g.chave === "atrasados" && <IconeRelogio />}
                        {g.titulo} · {doGrupo.length}
                        {g.detalhe && <span className={styles.detalheGrupo}>{g.detalhe}</span>}
                      </span>
                    </th>
                  </tr>
                  {doGrupo.map(({ i, st }) => {
                    // RNC de origem do item (vazia se o plano é avulso).
                    const rnc = i.planoAcao.rnc;
                    // O usuário pode abrir essa RNC?
                    const rncVisivel = !!rnc && rncsVisiveis.has(rnc.id);
                    // O item pertence ao ciclo atual da RNC? Itens de ciclos antigos ficam sem botões de ação.
                    const atual = !rnc || i.ciclo === cicloAtual(rnc.verificacoes);
                    // Quantos dias o item está atrasado (0 se não estiver).
                    const diasAtraso = st === "ATRASADO" ? Math.round((hojeDb.getTime() - i.quando.getTime()) / DIA_MS) : 0;
                    return (
                      <LinhaTabela key={i.id}>
                        <Td className={styles.celulaTopo}>
                          {rnc ? (
                            rncVisivel ? (
                              <Link href={`/rncs/${rnc.id}?aba=plano`} className={styles.linkCodigo}>{rnc.codigo}</Link>
                            ) : (
                              <span className={styles.codigoOculto}>{rnc.codigo}</span>
                            )
                          ) : (
                            <Link href={linkPlano(i.planoAcao.id)} className={styles.linkManual} title={i.planoAcao.titulo}>
                              <span className={styles.rotuloManual}>
                                <IconeLapis />
                                {ROTULO_ORIGEM_PLANO[i.planoAcao.origemTipo] ?? "Manual"}
                              </span>
                              <span className={styles.tituloPlano}>{i.planoAcao.titulo}</span>
                            </Link>
                          )}
                        </Td>
                        <Td className={styles.celulaTopo}>
                          <Link href={`/plano-acao/${i.id}`} className={styles.linkOQue}>{i.oQue}</Link>
                        </Td>
                        <Td className={styles.celulaTopo}>
                          <span className={styles.responsavel}>
                            <span className={i.quemId === a.usuarioId ? styles.avatarEu : styles.avatar} aria-hidden="true">{iniciais(i.quem.nome)}</span>
                            <span className={styles.nomeResponsavel}>{i.quem.nome}</span>
                          </span>
                        </Td>
                        <Td className={styles.celulaTopo}>
                          {st === "ATRASADO" ? (
                            <span className={styles.prazoAtrasado}>
                              <span className={styles.data}>{formatarData(i.quando)}</span> · {diasAtraso} {diasAtraso === 1 ? "dia" : "dias"}
                            </span>
                          ) : g.chave === "semana" ? (
                            <span className={styles.prazo}>
                              {fmtDiaSemana.format(i.quando)}, <span className={styles.data}>{formatarData(i.quando)}</span>
                            </span>
                          ) : (
                            <span className={styles.data}>{formatarData(i.quando)}</span>
                          )}
                        </Td>
                        <Td className={styles.celulaTopo}>
                          <BadgeStatusItem status={st} foraDoPrazo={concluidoForaDoPrazo(i)} /> <BadgeSemEvidencia item={i} />
                        </Td>
                        <Td className={styles.celulaTopo}>
                          {atual ? (
                            <ItemAcoes
                              item={i}
                              rncId={rncVisivel ? rnc?.id : undefined}
                              hoje={hoje}
                              usuarios={usuarios}
                              podeExecutar={i.quemId === a.usuarioId && (!rnc || rnc.status === "PLANO_EM_EXECUCAO")}
                              podeConcluir={podeConcluirItem(a, i, rncVisivel) && (!rnc || rnc.status === "PLANO_EM_EXECUCAO")}
                              podeGerenciar={
                                rnc
                                  ? rncVisivel && podeGerenciarPlanoRnc(a, rnc) && (rnc.status === "EM_ANALISE" || rnc.status === "PLANO_EM_EXECUCAO")
                                  : podeGerenciarPlanoManual(a, i.planoAcao)
                              }
                            />
                          ) : (
                            <span className={styles.semAcao}>—</span>
                          )}
                        </Td>
                      </LinhaTabela>
                    );
                  })}
                </tbody>
              );
            })}
          </Tabela>
        </div>
        {itens.length === 0 && <EstadoVazio>Nenhum item encontrado.</EstadoVazio>}
      </EnvoltorioTabela>
    </div>
  );
}

/** Ícone de "+" do botão Novo plano de ação. */
function IconeMais() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

/** Ícone de relógio do título do grupo "Atrasados". */
function IconeRelogio() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Ícone de lápis que marca a origem dos planos avulsos. */
function IconeLapis() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
