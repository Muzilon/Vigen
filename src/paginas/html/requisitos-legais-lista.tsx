import Link from "next/link";
import { z } from "zod";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData, hojeNoFuso } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { exigirModulo } from "@/lib/modulos";
import {
  ESFERAS,
  percentualAtendimento,
  ROTULO_ESFERA,
  ROTULO_STATUS_REQUISITO,
  ROTULO_TEMA,
  ROTULO_TIPO_REQUISITO,
  STATUS_REQUISITO,
  TEMAS,
  verificacaoVencida,
} from "@/lib/requisitos-legais/regras";
import { listarRequisitos, opcoesRequisitos, podeGerenciarRequisitos } from "@/lib/requisitos-legais/servico";
import { getContexto } from "@/lib/tenant";
import { BadgeStatusRequisito } from "@/paginas/html/componentes/badge";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/requisitos-legais-lista.module.css";

const um = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const esquema = z.object({
  tema: enumUrl(["QUALIDADE", "SSO", "MEIO_AMBIENTE"]),
  esfera: enumUrl(["FEDERAL", "ESTADUAL", "MUNICIPAL"]),
  status: enumUrl(["ATENDE", "ATENDE_PARCIAL", "NAO_ATENDE", "NAO_APLICAVEL", "EM_ANALISE"]),
  obra: uuidUrl,
  processo: z.preprocess(um, z.union([z.uuid(), z.literal("sem")]).optional()).catch(undefined),
  vencidos: z.preprocess(um, z.literal("1").optional()).catch(undefined),
});

/** Registro de requisitos legais: planilha densa com filtros, status colorido e verificação vencida. */
export default async function RequisitosLegaisLista({ searchParams }: PageProps<"/requisitos-legais">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "REQUISITOS_LEGAIS");
  const a = await getAtor();
  const f = esquema.parse(await searchParams);
  const [lista, op, fuso] = await Promise.all([
    listarRequisitos(a, {
      tema: f.tema || undefined,
      esfera: f.esfera || undefined,
      status: f.status || undefined,
      obra: f.obra || undefined,
      processo: f.processo,
      vencidos: f.vencidos === "1",
    }),
    opcoesRequisitos(a),
    fusoDaEmpresa(a),
  ]);
  const hoje = hojeNoFuso(fuso);
  const pct = percentualAtendimento(lista.map((r) => r.status));
  const vencidos = lista.filter((r) => verificacaoVencida(r.proximaVerificacaoEm ? dataIso(r.proximaVerificacaoEm) : null, hoje, r.status)).length;
  const g = podeGerenciarRequisitos(a);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Requisitos legais"
        contador={lista.length}
        subtitulo="Leis, normas e licenças aplicáveis, com status de atendimento e verificação periódica."
        acoes={
          g ? (
            <>
              <LinkBotao href="/requisitos-legais/revisao-geral" variante="secundario">Revisão geral</LinkBotao>
              <LinkBotao href="/requisitos-legais/novo">Novo requisito</LinkBotao>
            </>
          ) : undefined
        }
      />

      <div className={styles.resumo}>
        <span><strong className={styles.numero}>{pct === null ? "—" : `${pct}%`}</strong> de atendimento nos requisitos listados</span>
        <Link href="/requisitos-legais?vencidos=1" className={vencidos ? styles.alerta : undefined}>
          <strong className={styles.numero}>{vencidos}</strong> com verificação vencida
        </Link>
      </div>

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="tema">Tema</Rotulo>
          <Selecao id="tema" name="tema" defaultValue={f.tema}>
            <option value="">Todos</option>
            {TEMAS.map((t) => <option key={t} value={t}>{ROTULO_TEMA[t]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="esfera">Esfera</Rotulo>
          <Selecao id="esfera" name="esfera" defaultValue={f.esfera}>
            <option value="">Todas</option>
            {ESFERAS.map((e) => <option key={e} value={e}>{ROTULO_ESFERA[e]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={f.status}>
            <option value="">Todos</option>
            {STATUS_REQUISITO.map((s) => <option key={s} value={s}>{ROTULO_STATUS_REQUISITO[s]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Obra</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra}>
            <option value="">Todas</option>
            {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="processo">Processo</Rotulo>
          <Selecao id="processo" name="processo" defaultValue={f.processo ?? ""}>
            <option value="">Todos</option>
            <option value="sem">Sem processo</option>
            {op.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </Selecao>
        </div>
        <label className={styles.caixa}>
          <input type="checkbox" name="vencidos" value="1" defaultChecked={f.vencidos === "1"} /> Só verificação vencida
        </label>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/requisitos-legais" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio>Nenhum requisito legal com estes filtros.</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Requisito</th>
                <th scope="col">Tipo</th>
                <th scope="col">Esfera</th>
                <th scope="col">Tema</th>
                <th scope="col">Aplicável a</th>
                <th scope="col">Processo</th>
                <th scope="col">Responsável</th>
                <th scope="col">Status</th>
                <th scope="col">Próx. verificação</th>
                <th scope="col">Plano</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => {
                const venc = verificacaoVencida(r.proximaVerificacaoEm ? dataIso(r.proximaVerificacaoEm) : null, hoje, r.status);
                return (
                  <tr key={r.id} className={venc ? styles.linhaVencida : undefined}>
                    <td className={styles.codigo}><Link href={`/requisitos-legais/${r.id}`}>{r.codigo}</Link></td>
                    <td className={styles.titulo}>
                      <Link href={`/requisitos-legais/${r.id}`} className={styles.link}>{r.numero}</Link>
                      <span className={styles.sub}>{r.titulo}{r.orgaoEmissor ? ` · ${r.orgaoEmissor}` : ""}</span>
                    </td>
                    <td>{ROTULO_TIPO_REQUISITO[r.tipo]}</td>
                    <td>{ROTULO_ESFERA[r.esfera]}</td>
                    <td>{ROTULO_TEMA[r.tema]}</td>
                    <td>{r.obra?.nome ?? "Empresa toda"}</td>
                    <td className={styles.mono}>{r.processo ? <Link href={`/processos/${r.processo.id}`} title={r.processo.nome}>{r.processo.codigo}</Link> : "—"}</td>
                    <td>{r.responsavel?.nome ?? "—"}</td>
                    <td><BadgeStatusRequisito status={r.status} rotulo={ROTULO_STATUS_REQUISITO[r.status]} /></td>
                    <td className={styles.mono}>
                      {r.status === "NAO_APLICAVEL" ? "—" : formatarData(r.proximaVerificacaoEm)}
                      {venc && <span className={styles.vencida}>vencida</span>}
                    </td>
                    <td>{r.planoAcao ? <Link href={`/plano-acao/planos/${r.planoAcao.id}`}>Ver</Link> : "—"}</td>
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
