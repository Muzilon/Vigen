import Link from "next/link";
import { notFound } from "next/navigation";
import { revisaoGeralAcao } from "@/app/(app)/riscos/actions";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { codigoRisco, eixosPI } from "@/lib/riscos/regras";
import { listarRiscos, opcoesFormulario, podeGerenciarRiscos } from "@/lib/riscos/servico";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/riscos-revisao-geral.module.css";

/**
 * Revisão geral (decisão 4 do dono): reavalia de uma vez todos os registros abertos de um
 * processo, dos "sem processo" ou da empresa inteira; cada um ganha histórico REVISAO_GERAL
 * e nova data de reavaliação.
 */
export default async function RiscosRevisaoGeral({ searchParams }: PageProps<"/riscos/revisao-geral">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "RISCOS_OPORTUNIDADES");
  const a = await getAtor();
  if (!podeGerenciarRiscos(a)) notFound();
  const sp = await searchParams;
  const op = await opcoesFormulario(a);
  const processo =
    typeof sp.processo === "string" && (sp.processo === "sem" || op.processos.some((p) => p.id === sp.processo)) ? sp.processo : "";
  const itens = await listarRiscos(a, { processo: processo || undefined });
  const nomeEscopo =
    processo === "sem" ? "registros sem processo" : processo ? `processo ${op.processos.find((p) => p.id === processo)?.codigo}` : "toda a empresa";

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/riscos" className={styles.linkVoltar}>← Riscos e oportunidades</Link>
      </nav>
      <h1 className={styles.titulo}>Revisão geral de riscos e oportunidades</h1>
      <p className={styles.subtitulo}>Confirme ou ajuste a avaliação de cada registro aberto do escopo e registre a revisão de uma vez.</p>

      <form method="get" className={styles.barraEscopo}>
        <div className={styles.campoEscopo}>
          <Rotulo htmlFor="processo">Escopo</Rotulo>
          <Selecao id="processo" name="processo" defaultValue={processo}>
            <option value="">Toda a empresa</option>
            <option value="sem">— sem processo —</option>
            {op.processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </Selecao>
        </div>
        <Botao type="submit" variante="secundario">Carregar</Botao>
      </form>

      {itens.length === 0 ? (
        <EstadoVazio>Nenhum registro aberto neste escopo.</EstadoVazio>
      ) : (
        <FormAcao
          acao={revisaoGeralAcao}
          botao={`Registrar revisão geral (${itens.length})`}
          className={styles.formulario}
          confirmar={`Registrar a revisão geral de ${itens.length} registro(s) de ${nomeEscopo}?`}
        >
          <input type="hidden" name="processo" value={processo} />
          <div className={styles.rolagem}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th scope="col">Registro</th>
                  <th scope="col">Atual</th>
                  <th scope="col">P</th>
                  <th scope="col">I</th>
                  <th scope="col">P residual</th>
                  <th scope="col">I residual</th>
                  <th scope="col">Reavaliar em</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((r) => {
                  const cfg = op.escalas[r.obraId ?? ""] ?? op.escalas[""];
                  const { eixoP, eixoI } = eixosPI(cfg);
                  const sel = (nome: string, niveis: { valor: number }[], valor: number | null, rotulo: string, opcional = false) => (
                    <select
                      name={`${nome}_${r.id}`}
                      defaultValue={valor ?? ""}
                      required={!opcional}
                      aria-label={`${rotulo} de ${codigoRisco(r)}`}
                      className={styles.selecao}
                    >
                      {opcional && <option value="">—</option>}
                      {niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor}</option>)}
                    </select>
                  );
                  return (
                    <tr key={r.id}>
                      <td className={styles.celulaRegistro}>
                        <input type="hidden" name="ids" value={r.id} />
                        <Link href={`/riscos/${r.id}`} className={styles.linkCodigo}>{codigoRisco(r)}</Link> {r.descricao}
                        {r.processo && <span className={styles.subtexto}>{r.processo.codigo}</span>}
                      </td>
                      <td><BadgeFaixa faixa={r.faixa} score={r.score} /></td>
                      <td>{sel("p", eixoP.niveis, r.probabilidade, eixoP.rotulo)}</td>
                      <td>{sel("i", eixoI.niveis, r.impacto, eixoI.rotulo)}</td>
                      <td>{sel("pr", eixoP.niveis, r.probabilidadeResidual, `${eixoP.rotulo} residual`, true)}</td>
                      <td>{sel("ir", eixoI.niveis, r.impactoResidual, `${eixoI.rotulo} residual`, true)}</td>
                      <td className={styles.data}>{formatarData(r.proximaReavaliacaoEm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className={styles.observacao}>
            Observação da revisão
            <input name="observacao" maxLength={1000} placeholder="Ex.: análise crítica anual" className={styles.entrada} />
          </label>
        </FormAcao>
      )}
    </div>
  );
}
