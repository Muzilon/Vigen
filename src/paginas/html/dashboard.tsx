import Link from "next/link";
import type { ReactNode } from "react";
import { z } from "zod";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { carregarIndicadores } from "@/lib/indicadores/servico";
import { ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { resumoHira } from "@/lib/hira/servico";
import { resumoLaia } from "@/lib/laia/servico";
import { resumoDocumentos } from "@/lib/documentos/servico";
import { resumoInspecoes } from "@/lib/inspecoes/servico";
import { resumoAuditorias } from "@/lib/auditorias/servico";
import { resumoRequisitos } from "@/lib/requisitos-legais/servico";
import { contarPorFaixa } from "@/lib/riscos/servico";
import { Botao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Entrada, Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { Barras, GraficoMensal } from "@/paginas/html/dashboard-graficos";
import styles from "@/paginas/css/dashboard.module.css";

const dataUrl = z
  .preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional())
  .catch(undefined)
  .transform((v) => v ?? "");

const esquema = z.object({
  inicio: dataUrl,
  fim: dataUrl,
  obra: uuidUrl,
  tipo: enumUrl(["QUALIDADE", "MEIO_AMBIENTE", "SSO"]),
  setor: uuidUrl,
});

/** Dashboard de indicadores (ver A-Dashboard.dc.html, Direção A "Campo"). */
export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const f = esquema.parse(await searchParams);
  const a = await getAtor();
  const [{ indicadores: ind, periodo }, obras, setores, riscosPorFaixa, hira, laia, docs, inspecoes, auditorias, requisitos] = await Promise.all([
    carregarIndicadores(a, {
      inicio: f.inicio, fim: f.fim, obraId: f.obra || undefined, tipo: f.tipo || undefined, setorId: f.setor || undefined,
    }),
    a.db.obraUnidade.findMany({
      where: { ativo: true, ...(a.obrasPermitidas === null ? {} : { id: { in: [...a.obrasPermitidas] } }) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    a.db.setor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    contarPorFaixa(a),
    resumoHira(a),
    resumoLaia(a),
    resumoDocumentos(a),
    resumoInspecoes(a),
    resumoAuditorias(a),
    resumoRequisitos(a),
  ]);
  const k = ind.kpis;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina titulo="Dashboard" subtitulo={`Indicadores de ${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`} />

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="inicio">De</Rotulo>
          <Entrada id="inicio" name="inicio" type="date" defaultValue={periodo.inicio} />
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="fim">Até</Rotulo>
          <Entrada id="fim" name="fim" type="date" defaultValue={periodo.fim} />
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Obra</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra} className={styles.selecaoFiltro}>
            <option value="">Todas</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="tipo">Tipo</Rotulo>
          <Selecao id="tipo" name="tipo" defaultValue={f.tipo} className={styles.selecaoFiltro}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="setor">Setor</Rotulo>
          <Selecao id="setor" name="setor" defaultValue={f.setor} className={styles.selecaoFiltro}>
            <option value="">Todos</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/dashboard" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      <div className={styles.gradeKpis}>
        <Kpi titulo="RNCs em aberto" valor={k.abertas} dica="Estoque atual (qualquer data de abertura)" />
        <Kpi titulo="Encerradas" valor={k.encerradasPeriodo} dica="No período" />
        <Kpi titulo="Canceladas" valor={k.canceladasPeriodo} dica="No período" />
        <Kpi titulo="Itens atrasados" valor={k.itensAtrasados} dica="Situação atual" alerta={k.itensAtrasados > 0} />
        <Kpi
          titulo="Tempo médio de fechamento"
          valor={k.tempoMedioFechamentoDias === null ? "—" : `${k.tempoMedioFechamentoDias.toLocaleString("pt-BR")} d`}
          dica="Encerradas no período"
        />
        <Kpi
          titulo="Eficácia na 1ª verificação"
          valor={k.eficaciaPrimeiraVerificacaoPct === null ? "—" : `${k.eficaciaPrimeiraVerificacaoPct.toLocaleString("pt-BR")}%`}
          dica="% de RNCs aprovadas já na 1ª verificação (no período)"
        />
      </div>

      <Painel titulo="RNCs registradas x encerradas por mês">
        <GraficoMensal dados={ind.porMes} />
      </Painel>

      <div className={styles.gradeTres}>
        <Painel titulo="Por tipo" subtitulo="Registradas no período, qualquer status"><Barras dados={ind.porTipo} /></Painel>
        <Painel titulo="Por gravidade" subtitulo="Registradas no período, qualquer status"><Barras dados={ind.porGravidade} paleta="gravidade" /></Painel>
        <Painel titulo="Por obra" subtitulo="Registradas no período, qualquer status"><Barras dados={ind.porObra.slice(0, 10)} /></Painel>
      </div>

      {docs && (
        <Painel titulo="Documentos controlados" subtitulo={docs.mestra ? "Lista mestra e ciências" : "Documentos publicados para você"}>
          <div className={styles.gradeKpis}>
            {docs.mestra && (
              <Link href="/documentos?vencidas=1" className={styles.linkKpi}>
                <Kpi titulo="Revisões vencidas" valor={docs.revisoesVencidas} dica="Revisão periódica em atraso" alerta={docs.revisoesVencidas > 0} />
              </Link>
            )}
            <Link href="/documentos/meus" className={styles.linkKpi}>
              <Kpi titulo="Minhas ciências pendentes" valor={docs.cienciasPendentes} dica={`De ${docs.publicadosParaMim} documento(s) publicados para você`} alerta={docs.cienciasPendentes > 0} />
            </Link>
            {docs.mestra && (
              <Link href="/documentos?status=EM_APROVACAO" className={styles.linkKpi}>
                <Kpi titulo="Em revisão/aprovação" valor={docs.emTramitacao} dica={`${docs.aPublicar} aprovado(s) aguardando publicação`} />
              </Link>
            )}
          </div>
        </Painel>
      )}

      {inspecoes && (
        <Painel titulo="Inspeções / checklists" subtitulo="Últimos 12 meses, obras do seu escopo">
          <div className={styles.gradeKpis}>
            <Link href="/inspecoes?status=CONCLUIDA" className={styles.linkKpi}>
              <Kpi titulo="Conformidade média" valor={inspecoes.mediaConformidade === null ? "—" : `${inspecoes.mediaConformidade}%`} dica={`${inspecoes.concluidas} inspeção(ões) concluída(s)`} />
            </Link>
            <Link href="/inspecoes?status=EM_ANDAMENTO" className={styles.linkKpi}>
              <Kpi titulo="Em andamento" valor={inspecoes.emAndamento} dica={`${inspecoes.paradas} aberta(s) há mais de 7 dias`} alerta={inspecoes.paradas > 0} />
            </Link>
            <Kpi titulo="RNCs geradas" valor={inspecoes.rncsGeradas} dica={`${inspecoes.itensGerados} item(ns) de ação direto`} />
          </div>
          {inspecoes.porModelo.length > 0 && (
            <ul className={styles.listaSimples}>
              {inspecoes.porModelo.map((m) => <li key={m.nome}><span>{m.nome}</span><strong>{m.media}%</strong><small>{m.n} inspeção(ões)</small></li>)}
            </ul>
          )}
        </Painel>
      )}

      {auditorias && (
        <Painel titulo="Auditorias — não conformidades por auditoria" subtitulo={`Em execução e concluídas mais recentes · ${auditorias.planejadas} planejada(s)`}>
          {auditorias.auditorias.length === 0 ? (
            <p className={styles.subtituloPainel}>Nenhuma auditoria executada.</p>
          ) : (
            <ul className={styles.listaSimples}>
              {auditorias.auditorias.map((x) => (
                <li key={x.id}>
                  <Link href={`/auditorias/${x.id}`}>{x.codigo} · {x.norma}</Link>
                  <strong>{x.NAO_CONFORMIDADE} NC</strong>
                  <small>{x.OBSERVACAO} obs · {x.OPORTUNIDADE_MELHORIA} OM · {x.rncs} RNC</small>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      )}

      {requisitos && (
        <Painel titulo="Requisitos legais — atendimento" subtitulo={`${requisitos.total} requisito(s) no seu escopo · ${requisitos.porStatus.NAO_APLICAVEL} não aplicável(is)`}>
          <div className={styles.gradeKpis}>
            <Link href="/requisitos-legais" className={styles.linkKpi}>
              <Kpi titulo="Atendimento" valor={requisitos.percentual === null ? "—" : `${requisitos.percentual}%`} dica="Atende ÷ (atende + parcial + não atende)" />
            </Link>
            <Link href="/requisitos-legais?status=NAO_ATENDE" className={styles.linkKpi}>
              <Kpi titulo="Não atende / parcial" valor={requisitos.porStatus.NAO_ATENDE + requisitos.porStatus.ATENDE_PARCIAL} dica={`${requisitos.porStatus.NAO_ATENDE} não atende · ${requisitos.porStatus.ATENDE_PARCIAL} parcial`} alerta={requisitos.porStatus.NAO_ATENDE > 0} />
            </Link>
            <Link href="/requisitos-legais?vencidos=1" className={styles.linkKpi}>
              <Kpi titulo="Verificação vencida" valor={requisitos.vencidos} dica={`${requisitos.porStatus.EM_ANALISE} em análise`} alerta={requisitos.vencidos > 0} />
            </Link>
          </div>
        </Painel>
      )}

      {riscosPorFaixa && (
        <Painel titulo="Riscos e oportunidades abertos por nível" subtitulo="Situação atual (nível inicial), sem os encerrados">
          <Barras
            paleta="gravidade"
            vazio="Nenhum risco ou oportunidade aberto."
            dados={(
              [
                ["CRITICA", "Crítico", riscosPorFaixa.CRITICO],
                ["ALTA", "Alto", riscosPorFaixa.ALTO],
                ["MEDIA", "Médio", riscosPorFaixa.MEDIO],
                ["BAIXA", "Baixo", riscosPorFaixa.BAIXO],
              ] as const
            ).map(([chave, rotulo, valor]) => ({ chave, rotulo, valor }))}
          />
          <Link href="/riscos" className={styles.linkLimpar}>Abrir a matriz de riscos →</Link>
        </Painel>
      )}

      {hira && (
        <Painel titulo="HIRA — perigos e riscos de SST vigentes por nível" subtitulo={`Nível inicial das linhas vigentes nas obras do seu escopo${hira.pendentes ? ` · ${hira.pendentes} pendente(s) de aprovação` : ""}`}>
          <Barras
            paleta="gravidade"
            vazio="Nenhuma linha HIRA vigente."
            dados={(
              [
                ["CRITICA", "Crítico", hira.porFaixa.CRITICO],
                ["ALTA", "Alto", hira.porFaixa.ALTO],
                ["MEDIA", "Médio", hira.porFaixa.MEDIO],
                ["BAIXA", "Baixo", hira.porFaixa.BAIXO],
              ] as const
            ).map(([chave, rotulo, valor]) => ({ chave, rotulo, valor }))}
          />
          <Link href="/hira" className={styles.linkLimpar}>Abrir a planilha HIRA →</Link>
        </Painel>
      )}

      {laia && (
        <Painel
          titulo="LAIA — aspectos e impactos vigentes por nível"
          subtitulo={`${laia.significativos} significativo(s)${laia.pendentes ? ` · ${laia.pendentes} pendente(s) de aprovação` : ""}`}
        >
          <Barras
            paleta="gravidade"
            vazio="Nenhuma linha LAIA vigente."
            dados={(
              [
                ["CRITICA", "Crítico", laia.porFaixa.CRITICO],
                ["ALTA", "Alto", laia.porFaixa.ALTO],
                ["MEDIA", "Médio", laia.porFaixa.MEDIO],
                ["BAIXA", "Baixo", laia.porFaixa.BAIXO],
              ] as const
            ).map(([chave, rotulo, valor]) => ({ chave, rotulo, valor }))}
          />
          <Link href="/laia?sig=1" className={styles.linkLimpar}>Ver aspectos significativos →</Link>
        </Painel>
      )}

      <div className={styles.gradeDuas}>
        <Painel titulo="Itens de ação por status">
          <Barras dados={ind.itensPorStatus} paleta="status" vazio="Nenhum item de ação." />
        </Painel>
        <Painel titulo="Responsáveis com mais itens atrasados">
          <Barras dados={ind.topAtrasados} paleta="alerta" vazio="Nenhum item atrasado. Bom trabalho!" />
        </Painel>
      </div>
    </div>
  );
}

function Painel({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section className={styles.painel}>
      <h2 className={styles.tituloPainel}>{titulo}</h2>
      {subtitulo && <p className={styles.subtituloPainel}>{subtitulo}</p>}
      <div className={styles.corpoPainel}>{children}</div>
    </section>
  );
}

function Kpi({ titulo, valor, dica, alerta }: { titulo: string; valor: number | string; dica: string; alerta?: boolean }) {
  return (
    <div className={styles.kpi}>
      <p className={styles.tituloKpi}>{titulo}</p>
      <p className={`${styles.valorKpi} ${alerta ? styles.valorKpiAlerta : ""}`}>{valor}</p>
      <p className={styles.dicaKpi}>{dica}</p>
    </div>
  );
}
