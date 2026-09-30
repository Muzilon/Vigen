import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, hojeNoFuso, paraDataDb } from "@/lib/datas";
import { ROTULO_GRAVIDADE, ROTULO_STATUS_RNC, ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { enumUrl, textoUrl, uuidUrl } from "@/lib/filtros-url";
import { filtroAcessoRnc } from "@/lib/rnc/servico";
import { getContexto, temPermissao } from "@/lib/tenant";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CampoBusca, Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { BadgeAtrasado, BadgeGravidade, BadgeStatusRnc, type GravidadeBadge, type StatusRncBadge } from "@/paginas/html/componentes/badge";
import { EnvoltorioTabela, LinhaCabecalhoTabela, LinhaTabela, Tabela, Td, Th } from "@/paginas/html/componentes/tabela";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/rncs-lista.module.css";

// Regra de validação dos filtros da URL (status, unidade, tipo, responsável, gravidade, busca).
const esquemaFiltros = z.object({
  status: enumUrl(["ABERTO", "EM_ANALISE", "PLANO_EM_EXECUCAO", "EM_VERIFICACAO", "ENCERRADO", "REABERTO", "CANCELADO"]),
  obra: uuidUrl,
  tipo: enumUrl(["QUALIDADE", "MEIO_AMBIENTE", "SSO"]),
  responsavel: uuidUrl,
  gravidade: enumUrl(["BAIXA", "MEDIA", "ALTA", "CRITICA"]),
  q: textoUrl,
});

/** Pega as iniciais do nome para o "avatar" redondo: "Maria Silva" → "MS". */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Página "Não conformidades": a lista das RNCs que o usuário pode ver (até 200), com busca e filtros,
 * gravidade, responsável, abertura, status e aviso de itens de plano atrasados. Restritas (LGPD) ganham um cadeado.
 */
/** Lista de RNCs — página-modelo da Direção A "Campo" (ver Main.dc.html). */
export default async function RncsLista({ searchParams }: PageProps<"/rncs">) {
  // Lê e valida os filtros da URL.
  const f = esquemaFiltros.parse(await searchParams);
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Fuso horário da empresa e a data de hoje nele (para achar itens atrasados).
  const fuso = await fusoDaEmpresa(a);
  const hoje = paraDataDb(hojeNoFuso(fuso));

  // Monta a condição da busca no banco: regra de acesso do usuário + cada filtro preenchido + a busca por texto.
  const where: Prisma.RncWhereInput = {
    AND: [
      // B7: mesma regra do detalhe (obra permitida ou abridor/responsável; restritas).
      filtroAcessoRnc(a),
      f.status ? { status: f.status } : {},
      f.obra ? { obraId: f.obra } : {},
      f.tipo ? { tipo: f.tipo } : {},
      f.responsavel ? { responsavelId: f.responsavel } : {},
      f.gravidade ? { gravidade: f.gravidade } : {},
      f.q
        ? { OR: [{ codigo: { contains: f.q, mode: "insensitive" } }, { titulo: { contains: f.q, mode: "insensitive" } }] }
        : {},
    ],
  };

  // Busca em paralelo as RNCs (mais novas primeiro, com unidade, responsável e itens atrasados), as unidades permitidas e os usuários.
  const [rncs, obras, usuarios] = await Promise.all([
    a.db.rnc.findMany({
      where,
      orderBy: [{ ano: "desc" }, { sequencia: "desc" }],
      take: 200,
      include: {
        obra: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        planoAcao: {
          select: {
            itens: { where: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] }, quando: { lt: hoje } }, select: { id: true } },
          },
        },
      },
    }),
    a.db.obraUnidade.findMany({ where: { ativo: true, ...(ctx.obrasPermitidas ? { id: { in: ctx.obrasPermitidas } } : {}) }, orderBy: { nome: "asc" } }),
    a.db.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  // Monta uma caixa de filtro (lista suspensa) com a opção "Todos" e as escolhas dadas.
  const sel = (id: string, name: keyof typeof f, opcoes: [string, string][], todos: string) => (
    <Selecao id={id} name={name} defaultValue={f[name]} className={styles.selecaoFiltro}>
      <option value="">{todos}</option>
      {opcoes.map(([v, r]) => (
        <option key={v} value={v}>{r}</option>
      ))}
    </Selecao>
  );

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <CabecalhoPagina
        titulo="Não conformidades"
        contador={rncs.length}
        subtitulo="Relatórios de Não Conformidade de todas as unidades"
        acoes={temPermissao(ctx, "RNC_ABRIR") && <LinkBotao href="/rncs/nova">Nova RNC</LinkBotao>}
      />

      <form className={styles.barraFiltros}>
        <div className={styles.campoBuscaFiltro}>
          <Rotulo htmlFor="f-busca" oculto>Buscar por código ou título</Rotulo>
          <CampoBusca id="f-busca" name="q" defaultValue={f.q} placeholder="Código ou título" />
        </div>
        <Rotulo htmlFor="f-status" oculto>Status</Rotulo>
        {sel("f-status", "status", Object.entries(ROTULO_STATUS_RNC), "Status: Todos")}
        <Rotulo htmlFor="f-obra" oculto>Unidade</Rotulo>
        {sel("f-obra", "obra", obras.map((o) => [o.id, o.nome]), "Unidade: Todas")}
        <Rotulo htmlFor="f-tipo" oculto>Tipo</Rotulo>
        {sel("f-tipo", "tipo", Object.entries(ROTULO_TIPO), "Tipo: Todos")}
        <Rotulo htmlFor="f-grav" oculto>Gravidade</Rotulo>
        {sel("f-grav", "gravidade", Object.entries(ROTULO_GRAVIDADE), "Gravidade: Todas")}
        <Rotulo htmlFor="f-resp" oculto>Responsável</Rotulo>
        {sel("f-resp", "responsavel", usuarios.map((u) => [u.id, u.nome]), "Responsável: Todos")}
        <Botao type="submit" variante="secundario">Filtrar</Botao>
        <Link href="/rncs" className={styles.linkLimpar}>Limpar filtros</Link>
      </form>

      <EnvoltorioTabela>
        <Tabela className={styles.tabelaRncs}>
          <colgroup>
            <col className={styles.colCodigo} />
            <col />
            <col className={styles.colTipo} />
            <col className={styles.colObra} />
            <col className={styles.colGravidade} />
            <col className={styles.colResponsavel} />
            <col className={styles.colAbertura} />
            <col className={styles.colStatus} />
          </colgroup>
          <thead>
            <LinhaCabecalhoTabela>
              <Th scope="col">Código</Th>
              <Th scope="col">Título</Th>
              <Th scope="col">Tipo</Th>
              <Th scope="col">Unidade</Th>
              <Th scope="col">Gravidade</Th>
              <Th scope="col">Responsável</Th>
              <Th scope="col">Abertura</Th>
              <Th scope="col">Status</Th>
            </LinhaCabecalhoTabela>
          </thead>
          <tbody>
            {rncs.map((r) => {
              // Quantos itens do plano desta RNC estão atrasados.
              const atrasados = r.planoAcao?.itens.length ?? 0;
              return (
                <LinhaTabela key={r.id}>
                  <Td variante="mono">
                    <span className={styles.celulaCodigo}>
                      <Link href={`/rncs/${r.id}`} className={styles.linkCodigo}>{r.codigo}</Link>
                      {r.restrita && <IconeRestrita />}
                    </span>
                  </Td>
                  <Td variante="truncado">
                    <Link href={`/rncs/${r.id}`} className={styles.linkTitulo}>{r.titulo}</Link>
                  </Td>
                  <Td variante="secundario">{ROTULO_TIPO[r.tipo]}</Td>
                  <Td variante="secundario">{r.obra.nome}</Td>
                  <Td>
                    <BadgeGravidade gravidade={r.gravidade as GravidadeBadge} rotulo={ROTULO_GRAVIDADE[r.gravidade]} />
                  </Td>
                  <Td>
                    {r.responsavel ? (
                      <span className={styles.responsavel}>
                        <span className={styles.avatarResponsavel} aria-hidden="true">{iniciais(r.responsavel.nome)}</span>
                        {r.responsavel.nome}
                      </span>
                    ) : (
                      <span className={styles.semResponsavel}>—</span>
                    )}
                  </Td>
                  <Td variante="mono">{formatarData(hojeNoFuso(fuso, r.dataAbertura))}</Td>
                  <Td>
                    <div className={styles.statusCelula}>
                      <BadgeStatusRnc status={r.status as StatusRncBadge} rotulo={ROTULO_STATUS_RNC[r.status]} />
                      {atrasados > 0 && <BadgeAtrasado>{atrasados} atrasado(s)</BadgeAtrasado>}
                    </div>
                  </Td>
                </LinhaTabela>
              );
            })}
          </tbody>
        </Tabela>
        {rncs.length === 0 && <EstadoVazio>Nenhuma RNC encontrada.</EstadoVazio>}
      </EnvoltorioTabela>
    </div>
  );
}

/** Cadeado que marca RNCs restritas (contêm dados pessoais protegidos pela LGPD). */
function IconeRestrita() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Restrita (LGPD)" className={styles.iconeRestrita}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
