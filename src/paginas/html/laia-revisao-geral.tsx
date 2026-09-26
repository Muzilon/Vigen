import Link from "next/link";
import { notFound } from "next/navigation";
import { revisaoGeralLaiaAcao } from "@/app/(app)/laia/actions";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { codigoLaia, eixoLaia, EIXOS_LAIA } from "@/lib/laia/regras";
import { listarLaia, opcoesLaia, podeGerenciarLaia } from "@/lib/laia/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/laia-revisao-geral.module.css";

const PREFIXO = { severidade: "s", frequencia: "f", abrangencia: "a" } as const;

/** Revisão geral da LAIA por obra (decisão 4): reavalia de uma vez todas as linhas vigentes da obra. */
export default async function LaiaRevisaoGeral({ searchParams }: PageProps<"/laia/revisao-geral">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "LAIA");
  const a = await getAtor();
  if (!podeGerenciarLaia(a)) notFound();
  const sp = await searchParams;
  const op = await opcoesLaia(a);
  const obraId = typeof sp.obra === "string" && op.obras.some((o) => o.id === sp.obra) ? sp.obra : "";
  const itens = obraId ? await listarLaia(a, { obra: obraId, status: "VIGENTE" }) : [];
  const obraNome = op.obras.find((o) => o.id === obraId)?.nome ?? "";
  const config = op.escalas[obraId] ?? op.escalas[""];

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/laia" className={styles.linkVoltar}>← Aspectos e impactos (LAIA)</Link>
      </nav>
      <h1 className={styles.titulo}>Revisão geral da LAIA</h1>
      <p className={styles.subtitulo}>Confirme ou ajuste a avaliação de cada linha vigente da obra e registre a revisão de uma vez.</p>

      <form method="get" className={styles.barraEscopo}>
        <div className={styles.campoEscopo}>
          <Rotulo htmlFor="obra">Obra</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={obraId}>
            <option value="">— escolha a obra —</option>
            {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <Botao type="submit" variante="secundario">Carregar</Botao>
      </form>

      {!obraId ? (
        <EstadoVazio>Escolha a obra cuja planilha será revisada.</EstadoVazio>
      ) : itens.length === 0 ? (
        <EstadoVazio>Nenhuma linha vigente nesta obra.</EstadoVazio>
      ) : (
        <FormAcao
          acao={revisaoGeralLaiaAcao}
          botao={`Registrar revisão geral (${itens.length})`}
          className={styles.formulario}
          confirmar={`Registrar a revisão geral de ${itens.length} linha(s) da LAIA da ${obraNome}?`}
        >
          <input type="hidden" name="obraId" value={obraId} />
          <div className={styles.rolagem}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th scope="col">Linha</th>
                  <th scope="col">Atual</th>
                  {EIXOS_LAIA.map((k) => <th key={k} scope="col">{eixoLaia(config, k)?.rotulo ?? k}</th>)}
                  <th scope="col">Reavaliar em</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((l) => (
                  <tr key={l.id}>
                    <td className={styles.celulaRegistro}>
                      <input type="hidden" name="ids" value={l.id} />
                      <Link href={`/laia/${l.id}`} className={styles.linkCodigo}>{codigoLaia(l)}</Link> {l.aspecto} → {l.impacto}
                      <span className={styles.subtexto}>{l.atividade}</span>
                    </td>
                    <td><BadgeFaixa faixa={l.faixa} score={l.score} /></td>
                    {EIXOS_LAIA.map((k) => {
                      const e = eixoLaia(config, k);
                      return (
                        <td key={k}>
                          {e ? (
                            <select name={`${PREFIXO[k]}_${l.id}`} defaultValue={l[k]} required aria-label={`${e.rotulo} de ${codigoLaia(l)}`} className={styles.selecao}>
                              {e.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor}</option>)}
                            </select>
                          ) : (
                            <input type="hidden" name={`${PREFIXO[k]}_${l.id}`} value={l[k]} />
                          )}
                        </td>
                      );
                    })}
                    <td className={styles.data}>{formatarData(l.proximaReavaliacaoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className={styles.observacao}>
            Observação da revisão
            <input name="observacao" maxLength={1000} placeholder="Ex.: revisão anual da LAIA da obra" className={styles.entrada} />
          </label>
        </FormAcao>
      )}
    </div>
  );
}
