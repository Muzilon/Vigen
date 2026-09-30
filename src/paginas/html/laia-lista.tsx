import Link from "next/link";
import { z } from "zod";
import { ROTULO_TIPO_ALTERACAO } from "@/lib/aprovacao/rotulos";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import {
  celulasHeatmapLaia,
  codigoLaia,
  eixoLaia,
  FAIXAS,
  ROTULO_FAIXA,
  ROTULO_INCIDENCIA,
  ROTULO_SITUACAO,
  ROTULO_STATUS_LINHA,
  ROTULO_TEMPORALIDADE,
  SIGLA_SITUACAO,
  STATUS_LINHA,
} from "@/lib/laia/regras";
import { configLaia, listarLaia, opcoesLaia, pendenciasLaia, podeGerenciarLaia } from "@/lib/laia/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { ClonarObraForm } from "@/paginas/html/componentes/clonar-obra";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { Heatmap } from "@/paginas/html/componentes/heatmap";
import { LaiaArvore } from "@/paginas/html/laia-arvore";
import { clonarLaiaObraAcao } from "@/app/(app)/laia/actions";
import styles from "@/paginas/css/laia-lista.module.css";

// Regra para ler uma nota (1 a 10) da URL; se vier inválida, vira "sem filtro".
const nota = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.coerce.number().int().min(1).max(10).optional()).catch(undefined);

// Regra de validação dos filtros da URL (unidade, processo, nível, status, só significativos, célula S×F e vista em árvore).
const esquema = z.object({
  obra: uuidUrl,
  processo: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.union([z.literal("sem"), z.uuid()]).optional()).catch(undefined),
  faixa: enumUrl(["BAIXO", "MEDIO", "ALTO", "CRITICO"]),
  status: enumUrl(["PENDENTE_APROVACAO", "VIGENTE", "REJEITADA", "INATIVA"]),
  sig: enumUrl(["1"]),
  s: nota,
  f: nota,
  vista: enumUrl(["arvore"]),
});

/**
 * Página "Aspectos e impactos (LAIA)": filtros (inclui "somente significativos"), mapa de calor severidade × frequência,
 * resumo de quantos aspectos são significativos e a planilha densa (ou a visão em árvore).
 */
/** Planilha LAIA (ISO 14001): filtros (inclui "somente significativos"), heatmap severidade × frequência e planilha densa. */
export default async function LaiaLista({ searchParams }: PageProps<"/laia">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de LAIA, a página responde "404 - não encontrada".
  exigirModulo(ctx, "LAIA");
  // Lê e valida os filtros da URL (valores inválidos viram "sem filtro").
  const q = esquema.parse(await searchParams);
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo as linhas (já filtradas), as opções dos filtros, a escala de pontuação e os pedidos de aprovação em andamento.
  const [todas, opcoes, config, pendencias] = await Promise.all([
    listarLaia(a, { obra: q.obra || undefined, processo: q.processo, faixa: q.faixa || undefined, status: q.status || undefined, significativos: q.sig === "1" }),
    opcoesLaia(a),
    configLaia(a.db, q.obra || null),
    pendenciasLaia(a),
  ]);
  // Célula clicada no mapa de calor (severidade e frequência), se houver.
  const celula = q.s && q.f ? { s: q.s, f: q.f } : null;
  // Se uma célula foi clicada, mostra só as linhas dela; senão, todas.
  const linhas = celula ? todas.filter((l) => l.severidade === celula.s && l.frequencia === celula.f) : todas;
  // Só as linhas vigentes entram nas contagens.
  const vigentes = todas.filter((l) => l.status === "VIGENTE");
  // Quantas linhas da lista têm um pedido de aprovação em andamento (aparece como aviso no topo).
  const nPendentes = [...pendencias.values()].filter((p) => todas.some((l) => l.id === p.entidadeId)).length;
  // Quantos aspectos vigentes são significativos (nível alto ou crítico).
  const nSignificativos = vigentes.filter((l) => l.significativo).length;

  // Filtros atuais da URL, repassados aos links (para não perdê-los ao clicar).
  const base: Record<string, string> = {};
  for (const k of ["obra", "processo", "faixa", "status", "sig"] as const) if (q[k]) base[k] = String(q[k]);
  // Monta um endereço da própria página mantendo os filtros e acrescentando/trocando o que vier em `extra`.
  const href = (extra: Record<string, string>) => `/laia?${new URLSearchParams({ ...base, ...extra }).toString()}`;
  // Os três eixos da escala (severidade, frequência, abrangência), quando a empresa os configurou.
  const eS = eixoLaia(config, "severidade");
  const eF = eixoLaia(config, "frequencia");
  const eA = eixoLaia(config, "abrangencia");
  // Calcula as células do mapa (quantas linhas em cada combinação) já com o link de filtro de cada uma.
  const celulas = celulasHeatmapLaia(config, vigentes).map((c) => ({ ...c, href: href({ s: String(c.linha), f: String(c.coluna) }) }));
  // `gerencia`: verdadeiro se o usuário pode criar, revisar e duplicar linhas.
  const gerencia = podeGerenciarLaia(a);
  // Está na visão em árvore (?vista=arvore) em vez da planilha?
  const emArvore = q.vista === "arvore";

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <CabecalhoPagina
        titulo="Aspectos e impactos (LAIA)"
        contador={todas.length}
        subtitulo="Levantamento de aspectos e impactos ambientais por unidade (ISO 14001 6.1.2) — pontuação = severidade × frequência × abrangência; requisito legal e partes interessadas elevam a significância."
        acoes={
          <>
            {nPendentes > 0 && (
              <Link href="/aprovacoes" className={styles.badgePendentes} title="Linhas com inclusão, alteração ou exclusão aguardando aprovação">
                {nPendentes} pendente{nPendentes > 1 ? "s" : ""} de aprovação
              </Link>
            )}
            {gerencia && opcoes.obras.length > 1 && <ClonarObraForm acao={clonarLaiaObraAcao} obras={opcoes.obras} />}
            {gerencia && <LinkBotao href={`/laia/revisao-geral${q.obra ? `?obra=${q.obra}` : ""}`} variante="secundario">Revisão geral</LinkBotao>}
            {gerencia && <LinkBotao href={`/laia/novo${q.obra ? `?obra=${q.obra}` : ""}`}>Nova linha</LinkBotao>}
          </>
        }
      />

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Unidade</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={q.obra}>
            <option value="">Todas</option>
            {opcoes.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="processo">Processo</Rotulo>
          <Selecao id="processo" name="processo" defaultValue={q.processo ?? ""}>
            <option value="">Todos</option>
            <option value="sem">— sem processo —</option>
            {opcoes.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="faixa">Nível</Rotulo>
          <Selecao id="faixa" name="faixa" defaultValue={q.faixa}>
            <option value="">Todos</option>
            {FAIXAS.map((x) => <option key={x} value={x}>{ROTULO_FAIXA[x]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={q.status}>
            <option value="">Vigentes e pendentes</option>
            {STATUS_LINHA.map((x) => <option key={x} value={x}>{ROTULO_STATUS_LINHA[x]}</option>)}
          </Selecao>
        </div>
        <label className={styles.checkFiltro}>
          <input type="checkbox" name="sig" value="1" defaultChecked={q.sig === "1"} /> Somente significativos
        </label>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/laia" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      <div className={styles.heatmaps}>
        {eS && eF ? (
          <Heatmap
            titulo="Severidade × frequência (linhas vigentes)"
            eixoColuna={{ rotulo: eF.rotulo, valores: eF.niveis }}
            eixoLinha={{ rotulo: eS.rotulo, valores: eS.niveis }}
            celulas={celulas}
          />
        ) : (
          <p className={styles.filtroCelula}>A escala da empresa não tem os eixos severidade e frequência.</p>
        )}
        <div className={styles.resumo}>
          <p className={styles.numeroResumo}>{nSignificativos}</p>
          <p className={styles.rotuloResumo}>aspecto(s) significativo(s) de {vigentes.length} vigente(s)</p>
          <p className={styles.notaResumo}>A cor da célula considera {eA ? `${eA.rotulo.toLowerCase()} mínima e ` : ""}nenhum critério extra; a significância real de cada linha está na planilha.</p>
          <Link href={href({ sig: "1" })} className={styles.linkLimpar}>Ver só os significativos →</Link>
        </div>
      </div>

      {celula && (
        <p className={styles.filtroCelula}>
          Mostrando severidade {celula.s} e frequência {celula.f} · <Link href={href({})} className={styles.linkLimpar}>ver todas</Link>
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
        <EstadoVazio>Nenhuma linha LAIA com estes filtros.</EstadoVazio>
      ) : emArvore ? (
        <LaiaArvore linhas={linhas} />
      ) : (
        <div className={styles.quadroPlanilha} role="region" aria-label="Planilha LAIA" tabIndex={0}>
          <table className={styles.planilha}>
            <thead>
              <tr>
                <th scope="col" className={styles.colCodigo}>Nº</th>
                <th scope="col">Unidade</th>
                <th scope="col">Processo</th>
                <th scope="col" className={styles.colTexto}>Atividade</th>
                <th scope="col" className={styles.colTexto}>Aspecto</th>
                <th scope="col" className={styles.colTexto}>Impacto</th>
                <th scope="col" title="Situação: Normal, Anormal, Emergência">Sit.</th>
                <th scope="col">Temp.</th>
                <th scope="col">Incid.</th>
                <th scope="col" title="Severidade">Sev</th>
                <th scope="col" title="Frequência">Freq</th>
                <th scope="col" title="Abrangência">Abr</th>
                <th scope="col" title="Requisito legal">RL</th>
                <th scope="col" title="Partes interessadas">PI</th>
                <th scope="col">Pontuação</th>
                <th scope="col">Significativo</th>
                <th scope="col" className={styles.colTexto}>Controles</th>
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
                    <td className={styles.colCodigo}><Link href={`/laia/${l.id}`} className={styles.linkCodigo}>{codigoLaia(l)}</Link></td>
                    <td>{l.obra.nome}</td>
                    <td title={l.processo?.nome}>{l.processo?.codigo ?? "—"}</td>
                    <td className={styles.colTexto}><Link href={`/laia/${l.id}`} className={styles.linkTexto}>{l.atividade}</Link></td>
                    <td className={styles.colTexto}>{l.aspecto}</td>
                    <td className={styles.colTexto}>{l.impacto}</td>
                    <td title={ROTULO_SITUACAO[l.situacao]}>{SIGLA_SITUACAO[l.situacao]}</td>
                    <td>{ROTULO_TEMPORALIDADE[l.temporalidade]}</td>
                    <td>{ROTULO_INCIDENCIA[l.incidencia]}</td>
                    <td className={styles.numero}>{l.severidade}</td>
                    <td className={styles.numero}>{l.frequencia}</td>
                    <td className={styles.numero}>{l.abrangencia}</td>
                    <td>{l.requisitoLegal ? "Sim" : "—"}</td>
                    <td>{l.partesInteressadas ? "Sim" : "—"}</td>
                    <td><BadgeFaixa faixa={l.faixa} score={l.score} /></td>
                    <td className={l.significativo ? styles.significativo : undefined}>{l.significativo ? "Sim" : "Não"}</td>
                    <td className={styles.colTexto}>{l.controles ?? "—"}</td>
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
