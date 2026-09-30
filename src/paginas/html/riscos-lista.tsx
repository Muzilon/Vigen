import Link from "next/link";
import { z } from "zod";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { exigirModulo } from "@/lib/modulos";
import {
  celulasHeatmap,
  codigoRisco,
  eixosPI,
  FAIXAS,
  ROTULO_FAIXA,
  ROTULO_STATUS_RISCO,
  ROTULO_TIPO_RISCO,
  ROTULO_TRATAMENTO,
  STATUS_RISCO,
} from "@/lib/riscos/regras";
import { configRisco, listarRiscos, opcoesFormulario, podeGerenciarRiscos } from "@/lib/riscos/servico";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { Heatmap } from "@/paginas/html/componentes/heatmap";
import { EnvoltorioTabela, LinhaCabecalhoTabela, LinhaTabela, Tabela, Td, Th } from "@/paginas/html/componentes/tabela";
import { Botao } from "@/paginas/html/componentes/botao";
import styles from "@/paginas/css/riscos-lista.module.css";

// Regra para ler uma nota (1 a 10) da URL; se vier inválida, vira "sem filtro".
const nota = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.coerce.number().int().min(1).max(10).optional()).catch(undefined);

// Regra de validação dos filtros da URL (processo, tipo, nível, status, unidade, encerrados, célula P×I e se é residual).
const esquema = z.object({
  processo: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.union([z.literal("sem"), z.uuid()]).optional()).catch(undefined),
  tipo: enumUrl(["RISCO", "OPORTUNIDADE"]),
  faixa: enumUrl(["BAIXO", "MEDIO", "ALTO", "CRITICO"]),
  status: enumUrl(["IDENTIFICADO", "EM_TRATAMENTO", "MONITORADO", "ENCERRADO"]),
  obra: uuidUrl,
  encerrados: enumUrl(["1"]),
  p: nota,
  i: nota,
  res: enumUrl(["1"]),
});

/**
 * Página "Riscos e oportunidades": filtros, o mapa de calor (probabilidade × impacto) com alternância entre risco
 * inicial e residual — cada célula é clicável e filtra a lista — e a tabela de registros.
 */
/** Matriz de riscos e oportunidades (ISO 9001 6.1): filtros, heatmap P×I com toggle inicial/residual e lista. */
export default async function RiscosLista({ searchParams }: PageProps<"/riscos">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Riscos e Oportunidades, a página responde "404 - não encontrada".
  exigirModulo(ctx, "RISCOS_OPORTUNIDADES");
  // Lê e valida os filtros da URL.
  const f = esquema.parse(await searchParams);
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo os registros (filtrados), as opções dos filtros e a escala de pontuação da unidade filtrada.
  const [todos, opcoes, config] = await Promise.all([
    listarRiscos(a, {
      processo: f.processo,
      tipo: f.tipo || undefined,
      faixa: f.faixa || undefined,
      status: f.status || undefined,
      obra: f.obra || undefined,
      encerrados: f.encerrados === "1",
    }),
    opcoesFormulario(a),
    configRisco(a.db, f.obra || null),
  ]);
  // Mostrando o nível residual (após tratamento) em vez do inicial?
  const residual = f.res === "1";
  // Célula clicada no mapa de calor (probabilidade e impacto), se houver.
  const celula = f.p && f.i ? { p: f.p, i: f.i } : null;
  // Se uma célula foi clicada, mostra só os registros dela; senão, todos.
  const lista = celula
    ? todos.filter((r) => (residual ? r.probabilidadeResidual === celula.p && r.impactoResidual === celula.i : r.probabilidade === celula.p && r.impacto === celula.i))
    : todos;

  // Filtros atuais da URL, repassados aos links do mapa e do botão de alternar (para não perdê-los ao clicar).
  const base: Record<string, string> = {};
  for (const k of ["processo", "tipo", "faixa", "status", "obra", "encerrados"] as const) if (f[k]) base[k] = String(f[k]);
  // Monta um endereço da própria página mantendo os filtros e acrescentando/trocando o que vier em `extra`.
  const href = (extra: Record<string, string>) => `/riscos?${new URLSearchParams({ ...base, ...extra }).toString()}`;
  // Os dois eixos da escala (probabilidade e impacto) e, abaixo, no formato que o mapa de calor espera.
  const { eixoP, eixoI } = eixosPI(config);
  const eixoColuna = { rotulo: eixoP.rotulo, valores: eixoP.niveis };
  const eixoLinha = { rotulo: eixoI.rotulo, valores: eixoI.niveis };
  // Calcula as células do mapa (quantos registros em cada combinação) já com o link de filtro de cada uma.
  const celulas = (res: boolean) =>
    celulasHeatmap(config, todos, res).map((c) => ({ ...c, href: href({ p: String(c.coluna), i: String(c.linha), ...(res ? { res: "1" } : {}) }) }));
  // `gerencia`: verdadeiro se o usuário pode criar e fazer revisão geral.
  const gerencia = podeGerenciarRiscos(a);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Riscos e oportunidades"
        contador={todos.length}
        subtitulo="Matriz de riscos e oportunidades por processo (ISO 9001 6.1) — nível = probabilidade × impacto pela escala da empresa/unidade."
        acoes={
          <>
            {gerencia && <LinkBotao href="/riscos/revisao-geral" variante="secundario">Revisão geral</LinkBotao>}
            {gerencia && <LinkBotao href="/riscos/novo">Novo registro</LinkBotao>}
          </>
        }
      />

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="processo">Processo</Rotulo>
          <Selecao id="processo" name="processo" defaultValue={f.processo ?? ""}>
            <option value="">Todos</option>
            <option value="sem">— sem processo —</option>
            {opcoes.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="tipo">Tipo</Rotulo>
          <Selecao id="tipo" name="tipo" defaultValue={f.tipo}>
            <option value="">Todos</option>
            <option value="RISCO">Riscos</option>
            <option value="OPORTUNIDADE">Oportunidades</option>
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="faixa">Nível</Rotulo>
          <Selecao id="faixa" name="faixa" defaultValue={f.faixa}>
            <option value="">Todos</option>
            {FAIXAS.map((x) => <option key={x} value={x}>{ROTULO_FAIXA[x]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={f.status}>
            <option value="">Abertos</option>
            {STATUS_RISCO.map((x) => <option key={x} value={x}>{ROTULO_STATUS_RISCO[x]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Unidade</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra}>
            <option value="">Todas</option>
            {opcoes.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <label className={styles.checkFiltro}>
          <input type="checkbox" name="encerrados" value="1" defaultChecked={f.encerrados === "1"} /> Incluir encerrados
        </label>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/riscos" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      <div className={styles.heatmaps}>
        <div className={styles.toggleHeatmap} role="group" aria-label="Ver nível inicial ou residual">
          <Link href={href({})} aria-current={!residual ? "true" : undefined} className={!residual ? styles.toggleAtivo : styles.toggleInativo}>
            Risco inicial
          </Link>
          <Link href={href({ res: "1" })} aria-current={residual ? "true" : undefined} className={residual ? styles.toggleAtivo : styles.toggleInativo}>
            Risco residual
          </Link>
        </div>
        <Heatmap
          titulo={residual ? "Nível residual (após tratamento)" : "Nível inicial (P × I)"}
          eixoColuna={eixoColuna}
          eixoLinha={eixoLinha}
          celulas={celulas(residual)}
        />
      </div>

      {celula && (
        <p className={styles.filtroCelula}>
          Mostrando {residual ? "nível residual" : "nível inicial"} com {eixoP.rotulo.toLowerCase()} {celula.p} e {eixoI.rotulo.toLowerCase()} {celula.i} ·{" "}
          <Link href={href({})} className={styles.linkLimpar}>ver todos</Link>
        </p>
      )}

      {lista.length === 0 ? (
        <EstadoVazio>Nenhum risco ou oportunidade com estes filtros.</EstadoVazio>
      ) : (
        <EnvoltorioTabela>
          <Tabela className={styles.tabela}>
            <colgroup>
              <col className={styles.colCodigo} />
              <col />
              <col className={styles.colProcesso} />
              <col className={styles.colNivel} />
              <col className={styles.colNivel} />
              <col className={styles.colTratamento} />
              <col className={styles.colStatus} />
              <col className={styles.colData} />
            </colgroup>
            <thead>
              <LinhaCabecalhoTabela>
                <Th scope="col">Código</Th>
                <Th scope="col">Descrição</Th>
                <Th scope="col">Processo</Th>
                <Th scope="col">Nível</Th>
                <Th scope="col">Residual</Th>
                <Th scope="col">Tratamento</Th>
                <Th scope="col">Status</Th>
                <Th scope="col">Reavaliar em</Th>
              </LinhaCabecalhoTabela>
            </thead>
            <tbody>
              {lista.map((r) => (
                <LinhaTabela key={r.id}>
                  <Td variante="mono">
                    <Link href={`/riscos/${r.id}`} className={styles.linkCodigo}>{codigoRisco(r)}</Link>
                  </Td>
                  <Td className={styles.celulaDescricao} title={r.descricao}>
                    <Link href={`/riscos/${r.id}`} className={styles.linkDescricao}>{r.descricao}</Link>
                    <span className={styles.subtexto}>
                      {ROTULO_TIPO_RISCO[r.tipo]}
                      {r.obra ? ` · ${r.obra.nome}` : ""}
                      {r.responsavel ? ` · ${r.responsavel.nome}` : ""}
                    </span>
                  </Td>
                  <Td variante="secundario">{r.processo ? r.processo.codigo : "—"}</Td>
                  <Td><BadgeFaixa faixa={r.faixa} score={r.score} /></Td>
                  <Td>{r.faixaResidual ? <BadgeFaixa faixa={r.faixaResidual} score={r.scoreResidual} /> : <span className={styles.subtexto}>—</span>}</Td>
                  <Td variante="secundario">{r.tratamento ? ROTULO_TRATAMENTO[r.tratamento] : "—"}</Td>
                  <Td variante="secundario">{ROTULO_STATUS_RISCO[r.status]}</Td>
                  <Td variante="secundario">{formatarData(r.proximaReavaliacaoEm)}</Td>
                </LinhaTabela>
              ))}
            </tbody>
          </Tabela>
        </EnvoltorioTabela>
      )}
    </div>
  );
}
