import Link from "next/link";
import { z } from "zod";
import { ROTULO_TIPO_ALTERACAO } from "@/lib/aprovacao/rotulos";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import {
  celulasHeatmapHira,
  codigoHira,
  eixosPS,
  FAIXAS,
  ROTULO_CONDICAO,
  ROTULO_FAIXA,
  ROTULO_HIERARQUIA,
  ROTULO_STATUS_LINHA,
  SIGLA_CONDICAO,
  STATUS_LINHA,
} from "@/lib/hira/regras";
import { configHira, listarHira, opcoesHira, pendenciasHira, podeGerenciarHira } from "@/lib/hira/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { Heatmap } from "@/paginas/html/componentes/heatmap";
import { ClonarObraForm } from "@/paginas/html/componentes/clonar-obra";
import { HiraArvore } from "@/paginas/html/hira-arvore";
import { clonarHiraObraAcao } from "@/app/(app)/hira/actions";
import styles from "@/paginas/css/hira-lista.module.css";

// Regra para ler uma nota (1 a 10) da URL; se vier inválida, vira "sem filtro".
const nota = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.coerce.number().int().min(1).max(10).optional()).catch(undefined);
// Regra para ler um texto curto (até 200 caracteres) da URL.
const texto = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().trim().max(200).optional()).catch(undefined);

// Regra de validação dos filtros da URL (unidade, setor, processo, nível, status, célula P×S, residual e vista em árvore).
const esquema = z.object({
  obra: uuidUrl,
  setor: texto,
  processo: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.union([z.literal("sem"), z.uuid()]).optional()).catch(undefined),
  faixa: enumUrl(["BAIXO", "MEDIO", "ALTO", "CRITICO"]),
  status: enumUrl(["PENDENTE_APROVACAO", "VIGENTE", "REJEITADA", "INATIVA"]),
  p: nota,
  s: nota,
  res: enumUrl(["1"]),
  vista: enumUrl(["arvore"]),
});

/**
 * Página "Perigos e Riscos": filtros, mapa de calor (probabilidade × severidade) com alternância entre risco
 * inicial e residual, e a planilha densa das linhas (ou a visão em árvore). Mostra também quantas linhas aguardam aprovação.
 */
/** Planilha de Perigos e Riscos (ISO 45001): filtros, heatmap P×S com toggle inicial/residual e a planilha densa por obra. */
export default async function HiraLista({ searchParams }: PageProps<"/hira">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Perigos e Riscos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "HIRA");
  // Lê e valida os filtros da URL (valores inválidos viram "sem filtro").
  const f = esquema.parse(await searchParams);
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo as linhas (já filtradas), as opções dos filtros, a escala de pontuação e os pedidos de aprovação em andamento.
  const [todas, opcoes, config, pendencias] = await Promise.all([
    listarHira(a, { obra: f.obra || undefined, setor: f.setor || undefined, processo: f.processo, faixa: f.faixa || undefined, status: f.status || undefined }),
    opcoesHira(a),
    configHira(a.db, f.obra || null),
    pendenciasHira(a),
  ]);
  // Mostrando o risco residual (após os controles) em vez do inicial?
  const residual = f.res === "1";
  // Célula clicada no mapa de calor (probabilidade e severidade), se houver.
  const celula = f.p && f.s ? { p: f.p, s: f.s } : null;
  // Se uma célula foi clicada, mostra só as linhas dela; senão, todas.
  const linhas = celula
    ? todas.filter((l) => (residual ? l.probabilidadeResidual === celula.p && l.severidadeResidual === celula.s : l.probabilidade === celula.p && l.severidade === celula.s))
    : todas;
  // Só as linhas vigentes entram na contagem do mapa de calor.
  const vigentes = todas.filter((l) => l.status === "VIGENTE");
  // Quantas linhas da lista têm um pedido de aprovação em andamento (aparece como aviso no topo).
  const nPendentes = [...pendencias.values()].filter((p) => todas.some((l) => l.id === p.entidadeId)).length;

  // Filtros atuais da URL, repassados aos links do mapa e dos botões (para não perdê-los ao clicar).
  const base: Record<string, string> = {};
  for (const k of ["obra", "setor", "processo", "faixa", "status"] as const) if (f[k]) base[k] = String(f[k]);
  // Monta um endereço da própria página mantendo os filtros e acrescentando/trocando o que vier em `extra`.
  const href = (extra: Record<string, string>) => `/hira?${new URLSearchParams({ ...base, ...extra }).toString()}`;
  // Está na visão em árvore (?vista=arvore) em vez da planilha?
  const emArvore = f.vista === "arvore";
  // Os dois eixos da escala (probabilidade e severidade) e, abaixo, no formato que o mapa de calor espera.
  const { eixoP, eixoS } = eixosPS(config);
  const eixoColuna = { rotulo: eixoP.rotulo, valores: eixoP.niveis };
  const eixoLinha = { rotulo: eixoS.rotulo, valores: eixoS.niveis };
  // Calcula as células do mapa (quantas linhas em cada combinação) já com o link de filtro de cada uma.
  const celulas = (res: boolean) =>
    celulasHeatmapHira(config, vigentes, res).map((c) => ({ ...c, href: href({ p: String(c.coluna), s: String(c.linha), ...(res ? { res: "1" } : {}) }) }));
  // `gerencia`: verdadeiro se o usuário pode criar, revisar e duplicar linhas.
  const gerencia = podeGerenciarHira(a);

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <CabecalhoPagina
        titulo="Perigos e Riscos"
        contador={todas.length}
        subtitulo="Identificação de perigos e avaliação de riscos de SST por unidade (ISO 45001 6.1.2) — nível = probabilidade × severidade pela escala da unidade/empresa."
        acoes={
          <>
            {nPendentes > 0 && (
              <Link href="/aprovacoes" className={styles.badgePendentes} title="Linhas com inclusão, alteração ou exclusão aguardando aprovação">
                {nPendentes} pendente{nPendentes > 1 ? "s" : ""} de aprovação
              </Link>
            )}
            {gerencia && opcoes.obras.length > 1 && <ClonarObraForm acao={clonarHiraObraAcao} obras={opcoes.obras} />}
            {gerencia && <LinkBotao href={`/hira/revisao-geral${f.obra ? `?obra=${f.obra}` : ""}`} variante="secundario">Revisão geral</LinkBotao>}
            {gerencia && <LinkBotao href={`/hira/novo${f.obra ? `?obra=${f.obra}` : ""}`}>Nova linha</LinkBotao>}
          </>
        }
      />

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Unidade</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra}>
            <option value="">Todas</option>
            {opcoes.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="setor">Setor</Rotulo>
          <Selecao id="setor" name="setor" defaultValue={f.setor ?? ""}>
            <option value="">Todos</option>
            {opcoes.setores.map((s) => <option key={s} value={s}>{s}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="processo">Processo</Rotulo>
          <Selecao id="processo" name="processo" defaultValue={f.processo ?? ""}>
            <option value="">Todos</option>
            <option value="sem">— sem processo —</option>
            {opcoes.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
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
            <option value="">Vigentes e pendentes</option>
            {STATUS_LINHA.map((x) => <option key={x} value={x}>{ROTULO_STATUS_LINHA[x]}</option>)}
          </Selecao>
        </div>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/hira" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      <div className={styles.heatmaps}>
        <div className={styles.toggleHeatmap} role="group" aria-label="Ver risco inicial ou residual">
          <Link href={href({})} aria-current={!residual ? "true" : undefined} className={!residual ? styles.toggleAtivo : styles.toggleInativo}>
            Risco inicial
          </Link>
          <Link href={href({ res: "1" })} aria-current={residual ? "true" : undefined} className={residual ? styles.toggleAtivo : styles.toggleInativo}>
            Risco residual
          </Link>
        </div>
        <Heatmap
          titulo={residual ? "Risco residual (após controles)" : "Risco inicial (P × S)"}
          eixoColuna={eixoColuna}
          eixoLinha={eixoLinha}
          celulas={celulas(residual)}
        />
      </div>

      {celula && (
        <p className={styles.filtroCelula}>
          Mostrando {residual ? "risco residual" : "risco inicial"} com {eixoP.rotulo.toLowerCase()} {celula.p} e {eixoS.rotulo.toLowerCase()} {celula.s} ·{" "}
          <Link href={href({})} className={styles.linkLimpar}>ver todas</Link>
        </p>
      )}

      <p className={styles.filtroCelula}>
        {emArvore ? (
          <Link href={href({ vista: "" })} className={styles.linkLimpar}>Ver planilha</Link>
        ) : (
          <Link href={href({ vista: "arvore" })} className={styles.linkLimpar}>Ver em árvore (Unidade › Processo › Atividade)</Link>
        )}
      </p>

      {linhas.length === 0 ? (
        <EstadoVazio>Nenhuma linha de Perigos e Riscos com estes filtros.</EstadoVazio>
      ) : emArvore ? (
        <HiraArvore linhas={linhas} />
      ) : (
        <div className={styles.quadroPlanilha} role="region" aria-label="Planilha de Perigos e Riscos" tabIndex={0}>
          <table className={styles.planilha}>
            <thead>
              <tr>
                <th scope="col" className={styles.colCodigo}>Nº</th>
                <th scope="col">Unidade</th>
                <th scope="col">Setor</th>
                <th scope="col">Processo</th>
                <th scope="col" className={styles.colTexto}>Atividade</th>
                <th scope="col" title="Rotineira / não rotineira">R/NR</th>
                <th scope="col" className={styles.colTexto}>Perigo</th>
                <th scope="col" className={styles.colTexto}>Risco / dano</th>
                <th scope="col" title="Condição: Normal, Anormal, Emergência">Cond.</th>
                <th scope="col" className={styles.colTexto}>Controles existentes</th>
                <th scope="col" title={`${eixoP.rotulo} × ${eixoS.rotulo}`}>P×S</th>
                <th scope="col">Nível</th>
                <th scope="col">Hierarquia</th>
                <th scope="col" className={styles.colTexto}>Controles propostos</th>
                <th scope="col">Residual</th>
                <th scope="col" className={styles.colTexto}>Requisito legal</th>
                <th scope="col">Responsável</th>
                <th scope="col">Plano</th>
                <th scope="col">Reavaliar</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                // Pedido de aprovação em andamento para esta linha (mostra o aviso "pendente" ao lado do status).
                const pend = pendencias.get(l.id);
                return (
                  <tr key={l.id} className={l.status !== "VIGENTE" ? styles.linhaInativa : undefined}>
                    <td className={styles.colCodigo}>
                      <Link href={`/hira/${l.id}`} className={styles.linkCodigo}>{codigoHira(l)}</Link>
                    </td>
                    <td>{l.obra.nome}</td>
                    <td>{l.setor}</td>
                    <td title={l.processo?.nome}>{l.processo?.codigo ?? "—"}</td>
                    <td className={styles.colTexto}><Link href={`/hira/${l.id}`} className={styles.linkTexto}>{l.atividade}</Link></td>
                    <td>{l.rotineira ? "R" : "NR"}</td>
                    <td className={styles.colTexto}>{l.perigo}</td>
                    <td className={styles.colTexto}>{l.risco}</td>
                    <td title={ROTULO_CONDICAO[l.condicao]}>{SIGLA_CONDICAO[l.condicao]}</td>
                    <td className={styles.colTexto}>{l.controlesExistentes ?? "—"}</td>
                    <td className={styles.numero}>{l.probabilidade}×{l.severidade}</td>
                    <td><BadgeFaixa faixa={l.faixa} score={l.score} /></td>
                    <td>{l.hierarquiaControle ? ROTULO_HIERARQUIA[l.hierarquiaControle] : "—"}</td>
                    <td className={styles.colTexto}>{l.controlesPropostos ?? "—"}</td>
                    <td>{l.faixaResidual ? <BadgeFaixa faixa={l.faixaResidual} score={l.scoreResidual} /> : "—"}</td>
                    <td className={styles.colTexto}>{l.requisitoLegal ?? "—"}</td>
                    <td>{l.responsavel?.nome ?? "—"}</td>
                    <td>{l.planoAcaoId ? "Sim" : "—"}</td>
                    <td>{formatarData(l.proximaReavaliacaoEm)}</td>
                    <td>
                      <span className={styles.status}>{ROTULO_STATUS_LINHA[l.status]}</span>
                      {pend && l.status === "VIGENTE" && (
                        <Link href={`/aprovacoes/${pend.id}`} className={styles.pendencia}>{ROTULO_TIPO_ALTERACAO[pend.tipoAlteracao]} pendente</Link>
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
