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

// Prefixo do nome de cada campo enviado (s = severidade, f = frequência, a = abrangência), para o servidor saber qual é qual.
const PREFIXO = { severidade: "s", frequencia: "f", abrangencia: "a" } as const;

/**
 * Página "Revisão geral da LAIA": escolhendo uma unidade, mostra todas as linhas vigentes para confirmar ou ajustar
 * severidade, frequência e abrangência, e registra a revisão de todas de uma vez. Exige permissão de gerenciar a LAIA.
 */
/** Revisão geral da LAIA por obra (decisão 4): reavalia de uma vez todas as linhas vigentes da obra. */
export default async function LaiaRevisaoGeral({ searchParams }: PageProps<"/laia/revisao-geral">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de LAIA, a página responde "404 - não encontrada".
  exigirModulo(ctx, "LAIA");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarLaia(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Opções dos campos: unidades e as escalas de pontuação.
  const op = await opcoesLaia(a);
  // Aceita a unidade da URL só se ela existir na lista.
  const obraId = typeof sp.obra === "string" && op.obras.some((o) => o.id === sp.obra) ? sp.obra : "";
  // Linhas vigentes da unidade escolhida (vazio enquanto nenhuma unidade foi escolhida).
  const itens = obraId ? await listarLaia(a, { obra: obraId, status: "VIGENTE" }) : [];
  // Nome da unidade, usado na mensagem de confirmação.
  const obraNome = op.obras.find((o) => o.id === obraId)?.nome ?? "";
  // Escala de pontuação da unidade (ou a padrão da empresa, se a unidade não tiver a sua).
  const config = op.escalas[obraId] ?? op.escalas[""];

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/laia" className={styles.linkVoltar}>← Aspectos e impactos (LAIA)</Link>
      </nav>
      <h1 className={styles.titulo}>Revisão geral da LAIA</h1>
      <p className={styles.subtitulo}>Confirme ou ajuste a avaliação de cada linha vigente da unidade e registre a revisão de uma vez.</p>

      <form method="get" className={styles.barraEscopo}>
        <div className={styles.campoEscopo}>
          <Rotulo htmlFor="obra">Unidade</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={obraId}>
            <option value="">— escolha a unidade —</option>
            {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <Botao type="submit" variante="secundario">Carregar</Botao>
      </form>

      {!obraId ? (
        <EstadoVazio>Escolha a unidade cuja planilha será revisada.</EstadoVazio>
      ) : itens.length === 0 ? (
        <EstadoVazio>Nenhuma linha vigente nesta unidade.</EstadoVazio>
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
            <input name="observacao" maxLength={1000} placeholder="Ex.: revisão anual da LAIA da unidade" className={styles.entrada} />
          </label>
        </FormAcao>
      )}
    </div>
  );
}
