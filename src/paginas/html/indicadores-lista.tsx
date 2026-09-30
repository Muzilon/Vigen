import Link from "next/link";
import { z } from "zod";
import { getAtor } from "@/lib/ator-servidor";
import { enumUrl } from "@/lib/filtros-url";
import { ehAutomatico } from "@/lib/indicadores/automaticos";
import { listarIndicadores, opcoesIndicadores, podeGerenciarIndicadores, podeLancarResultado } from "@/lib/indicadores/gestao";
import { atingido, formatarValor, ROTULO_DIRECAO, ROTULO_PERIODICIDADE, ROTULO_SITUACAO, rotuloPeriodo } from "@/lib/indicadores/periodos";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeSituacaoIndicador } from "@/paginas/html/componentes/badge";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/indicadores-lista.module.css";

// Quando a URL repete um parâmetro, o Next entrega uma lista; esta função pega só o primeiro valor.
const um = (v: unknown) => (Array.isArray(v) ? v[0] : v);
// Regra de validação dos filtros da URL (processo, situação, mostrar inativos).
const esquema = z.object({
  processo: z.preprocess(um, z.union([z.uuid(), z.literal("sem")]).optional()).catch(undefined),
  situacao: enumUrl(["ATINGIDO", "NAO_ATINGIDO", "SEM_LANCAMENTO"]),
  inativos: z.preprocess(um, z.literal("1").optional()).catch(undefined),
});

/**
 * Lista de indicadores (todos ou só os do usuário — "Meus indicadores") com a situação no último período fechado:
 * badge atingido/não atingido/sem lançamento e os últimos resultados vigentes.
 */
export default async function IndicadoresLista({ searchParams, meus = false }: { searchParams: Promise<Record<string, string | string[] | undefined>>; meus?: boolean }) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Indicadores, a página responde "404 - não encontrada".
  exigirModulo(ctx, "INDICADORES");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Lê e valida os filtros da URL (valores inválidos viram "sem filtro").
  const f = esquema.parse(await searchParams);
  // Busca em paralelo os indicadores (filtrados; na versão "meus", só os do usuário) e as opções dos filtros.
  const [todos, op] = await Promise.all([
    listarIndicadores(a, { processo: f.processo, inativos: f.inativos === "1", responsavelId: meus ? a.usuarioId : undefined }),
    opcoesIndicadores(a),
  ]);
  // Aplica o filtro de situação (atingido / não atingido / sem lançamento) sobre a lista.
  const lista = f.situacao ? todos.filter((i) => i.situacao === f.situacao) : todos;
  // Conta quantos indicadores ativos estão em cada situação (números do resumo do topo).
  const conta = (s: "ATINGIDO" | "NAO_ATINGIDO" | "SEM_LANCAMENTO") => todos.filter((i) => i.situacao === s && i.ativo).length;
  // `g`: verdadeiro se o usuário pode criar/editar indicadores.
  const g = podeGerenciarIndicadores(a);
  // Endereço-base da página (muda entre "Indicadores" e "Meus indicadores").
  const base = meus ? "/indicadores/meus" : "/indicadores";
  // Monta o link do resumo que filtra por uma situação mantendo o filtro de processo.
  const filtroSituacao = (s: string) => `${base}?${new URLSearchParams({ ...(f.processo ? { processo: f.processo } : {}), situacao: s })}`;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo={meus ? "Meus indicadores" : "Indicadores"}
        contador={lista.length}
        subtitulo={
          meus
            ? "Indicadores sob sua responsabilidade: lance o resultado de cada período fechado."
            : "Metas por processo com resultados periódicos. Situação avaliada no último período já encerrado."
        }
        acoes={g ? <LinkBotao href="/indicadores/novo">Novo indicador</LinkBotao> : undefined}
      />

      <div className={styles.resumo}>
        <Link href={filtroSituacao("ATINGIDO")}><strong className={`${styles.numero} ${styles.ok}`}>{conta("ATINGIDO")}</strong> meta atingida</Link>
        <Link href={filtroSituacao("NAO_ATINGIDO")}><strong className={`${styles.numero} ${conta("NAO_ATINGIDO") ? styles.ruim : ""}`}>{conta("NAO_ATINGIDO")}</strong> não atingida</Link>
        <Link href={filtroSituacao("SEM_LANCAMENTO")}><strong className={`${styles.numero} ${conta("SEM_LANCAMENTO") ? styles.alerta : ""}`}>{conta("SEM_LANCAMENTO")}</strong> sem lançamento no período</Link>
      </div>

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="processo">Processo</Rotulo>
          <Selecao id="processo" name="processo" defaultValue={f.processo ?? ""}>
            <option value="">Todos</option>
            <option value="sem">Sem processo (empresa)</option>
            {op.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="situacao">Situação</Rotulo>
          <Selecao id="situacao" name="situacao" defaultValue={f.situacao}>
            <option value="">Todas</option>
            <option value="ATINGIDO">{ROTULO_SITUACAO.ATINGIDO}</option>
            <option value="NAO_ATINGIDO">{ROTULO_SITUACAO.NAO_ATINGIDO}</option>
            <option value="SEM_LANCAMENTO">{ROTULO_SITUACAO.SEM_LANCAMENTO}</option>
          </Selecao>
        </div>
        <label className={styles.caixa}>
          <input type="checkbox" name="inativos" value="1" defaultChecked={f.inativos === "1"} /> Mostrar inativos
        </label>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href={base} className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio>{meus ? "Nenhum indicador sob sua responsabilidade com estes filtros." : "Nenhum indicador com estes filtros."}</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Indicador</th>
                <th scope="col">Processo</th>
                <th scope="col">Meta</th>
                <th scope="col">Periodicidade</th>
                <th scope="col">Responsável</th>
                <th scope="col">Últimos resultados</th>
                <th scope="col">Período</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => {
                // Indicador ativo sem lançamento no período (a linha ganha destaque e o botão "Lançar").
                const pendente = i.situacao === "SEM_LANCAMENTO" && i.ativo;
                return (
                  <tr key={i.id} className={pendente ? styles.linhaPendente : undefined}>
                    <td className={styles.nome}>
                      <Link href={`/indicadores/${i.id}`} className={styles.link}>{i.nome}</Link>
                      <span className={styles.sub}>
                        {ehAutomatico(i.fonte) ? <span className={styles.selo}>automático</span> : null}
                        {!i.ativo && <span className={styles.selo}>inativo</span>}
                        {ROTULO_DIRECAO[i.direcao]}
                      </span>
                    </td>
                    <td className={styles.mono}>{i.processo ? <Link href={`/processos/${i.processo.id}`} title={i.processo.nome}>{i.processo.codigo}</Link> : "—"}</td>
                    <td className={styles.mono}>{i.direcao === "MAIOR_MELHOR" ? "≥ " : "≤ "}{formatarValor(i.meta, i.unidade)}</td>
                    <td>{ROTULO_PERIODICIDADE[i.periodicidade]}</td>
                    <td>{i.responsavel?.nome ?? "—"}</td>
                    <td>
                      {i.ultimos.length === 0 ? (
                        <span className={styles.sub}>—</span>
                      ) : (
                        <ul className={styles.ultimos} aria-label="Últimos resultados">
                          {i.ultimos.slice(-4).map((r) => (
                            <li key={r.periodo} className={atingido(r.valor, r.meta, r.direcao) ? styles.chipOk : styles.chipRuim} title={rotuloPeriodo(r.periodo)}>
                              <span className={styles.chipPeriodo}>{rotuloPeriodo(r.periodo)}</span> {formatarValor(r.valor, i.unidade)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={styles.mono}>{rotuloPeriodo(i.periodoReferencia)}</td>
                    <td>
                      <BadgeSituacaoIndicador situacao={i.situacao} rotulo={ROTULO_SITUACAO[i.situacao]} />
                      {pendente && podeLancarResultado(a, i) && (
                        <Link href={`/indicadores/${i.id}#lancar`} className={styles.lancar}>Lançar</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
