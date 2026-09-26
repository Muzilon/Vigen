import Link from "next/link";
import { z } from "zod";
import { getAtor } from "@/lib/ator-servidor";
import { ROTULO_STATUS_AUDITORIA, ROTULO_TIPO_AUDITORIA, STATUS_AUDITORIA } from "@/lib/auditorias/regras";
import { listarAuditorias, opcoesAuditorias, podeGerenciarAuditorias } from "@/lib/auditorias/servico";
import { formatarData } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/auditorias-lista.module.css";

const esquema = z.object({
  status: enumUrl(["PLANEJADA", "EM_EXECUCAO", "CONCLUIDA", "CANCELADA"]),
  tipo: enumUrl(["INTERNA", "EXTERNA_CERTIFICACAO"]),
  ano: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.coerce.number().int().min(2000).max(2100).optional()).catch(undefined),
  obra: uuidUrl,
});

/** Lista de auditorias: filtros status/tipo/ano/obra e contagem de constatações por tipo. */
export default async function AuditoriasLista({ searchParams }: PageProps<"/auditorias">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "AUDITORIAS");
  const a = await getAtor();
  const f = esquema.parse(await searchParams);
  const [lista, op] = await Promise.all([
    listarAuditorias(a, { status: f.status || undefined, tipo: f.tipo || undefined, ano: f.ano, obra: f.obra || undefined }),
    opcoesAuditorias(a),
  ]);
  const anos = [...new Set([...op.programas.map((p) => p.ano), new Date().getFullYear()])].sort((x, y) => y - x);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Auditorias"
        contador={lista.length}
        subtitulo="Auditorias internas e externas: plano, constatações e RNC a partir de não conformidades."
        acoes={
          <>
            <LinkBotao href="/auditorias/programa" variante="secundario">Programa anual</LinkBotao>
            {podeGerenciarAuditorias(a) && <LinkBotao href="/auditorias/nova">Nova auditoria</LinkBotao>}
          </>
        }
      />
      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={f.status}>
            <option value="">Todos</option>
            {STATUS_AUDITORIA.map((s) => <option key={s} value={s}>{ROTULO_STATUS_AUDITORIA[s]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="tipo">Tipo</Rotulo>
          <Selecao id="tipo" name="tipo" defaultValue={f.tipo}>
            <option value="">Todos</option>
            <option value="INTERNA">Interna</option>
            <option value="EXTERNA_CERTIFICACAO">Externa (certificação)</option>
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="ano">Ano</Rotulo>
          <Selecao id="ano" name="ano" defaultValue={f.ano ? String(f.ano) : ""}>
            <option value="">Todos</option>
            {anos.map((x) => <option key={x} value={x}>{x}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Obra</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra}>
            <option value="">Todas</option>
            {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/auditorias" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio>Nenhuma auditoria com estes filtros.</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Norma / escopo</th>
                <th scope="col">Tipo</th>
                <th scope="col">Período</th>
                <th scope="col">Auditor líder</th>
                <th scope="col">Status</th>
                <th scope="col" title="Não conformidades / observações / oportunidades / pontos fortes">NC · Obs · OM · PF</th>
                <th scope="col">RNCs</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id}>
                  <td className={styles.codigo}><Link href={`/auditorias/${x.id}`}>{x.codigo}</Link></td>
                  <td className={styles.titulo}>
                    <Link href={`/auditorias/${x.id}`} className={styles.link}>{x.norma}</Link>
                    <span className={styles.sub}>{x.escopo}{x.obra ? ` · ${x.obra.nome}` : ""}{x.processo ? ` · ${x.processo.codigo}` : ""}</span>
                  </td>
                  <td>{ROTULO_TIPO_AUDITORIA[x.tipo]}</td>
                  <td>{formatarData(x.dataInicio)}{x.dataFim.getTime() !== x.dataInicio.getTime() ? ` a ${formatarData(x.dataFim)}` : ""}</td>
                  <td>{x.auditorLider.nome}</td>
                  <td><span className={`${styles.status} ${styles[`status_${x.status}`]}`}>{ROTULO_STATUS_AUDITORIA[x.status]}</span></td>
                  <td className={styles.numero}>
                    <strong className={x.porTipo.NAO_CONFORMIDADE ? styles.nc : undefined}>{x.porTipo.NAO_CONFORMIDADE}</strong> · {x.porTipo.OBSERVACAO} · {x.porTipo.OPORTUNIDADE_MELHORIA} · {x.porTipo.PONTO_FORTE}
                  </td>
                  <td className={styles.numero}>{x.rncsGeradas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
