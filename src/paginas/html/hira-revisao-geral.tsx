import Link from "next/link";
import { notFound } from "next/navigation";
import { revisaoGeralHiraAcao } from "@/app/(app)/hira/actions";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { codigoHira, eixosPS } from "@/lib/hira/regras";
import { listarHira, opcoesHira, podeGerenciarHira } from "@/lib/hira/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/hira-revisao-geral.module.css";

/**
 * Revisão geral do HIRA por obra (decisão 4): reavalia de uma vez todas as linhas vigentes da
 * planilha da obra; cada uma ganha histórico REVISAO_GERAL e nova data de reavaliação.
 */
export default async function HiraRevisaoGeral({ searchParams }: PageProps<"/hira/revisao-geral">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de HIRA, a página responde "404 - não encontrada".
  exigirModulo(ctx, "HIRA");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarHira(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Opções dos campos: unidades e as escalas de pontuação.
  const op = await opcoesHira(a);
  // Aceita a unidade da URL só se ela existir na lista.
  const obraId = typeof sp.obra === "string" && op.obras.some((o) => o.id === sp.obra) ? sp.obra : "";
  // Linhas vigentes da unidade escolhida (vazio enquanto nenhuma unidade foi escolhida).
  const itens = obraId ? await listarHira(a, { obra: obraId, status: "VIGENTE" }) : [];
  // Nome da unidade, usado na mensagem de confirmação.
  const obraNome = op.obras.find((o) => o.id === obraId)?.nome ?? "";
  // Os dois eixos da escala (probabilidade e severidade) com seus níveis, da unidade ou da empresa.
  const { eixoP, eixoS } = eixosPS(op.escalas[obraId] ?? op.escalas[""]);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/hira" className={styles.linkVoltar}>← Perigos e riscos (HIRA)</Link>
      </nav>
      <h1 className={styles.titulo}>Revisão geral do HIRA</h1>
      <p className={styles.subtitulo}>Confirme ou ajuste a avaliação de cada linha vigente da planilha da unidade e registre a revisão de uma vez.</p>

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
          acao={revisaoGeralHiraAcao}
          botao={`Registrar revisão geral (${itens.length})`}
          className={styles.formulario}
          confirmar={`Registrar a revisão geral de ${itens.length} linha(s) do HIRA da ${obraNome}?`}
        >
          <input type="hidden" name="obraId" value={obraId} />
          <div className={styles.rolagem}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th scope="col">Linha</th>
                  <th scope="col">Atual</th>
                  <th scope="col">{eixoP.rotulo.slice(0, 1)}</th>
                  <th scope="col">{eixoS.rotulo.slice(0, 1)}</th>
                  <th scope="col">{eixoP.rotulo.slice(0, 1)} residual</th>
                  <th scope="col">{eixoS.rotulo.slice(0, 1)} residual</th>
                  <th scope="col">Reavaliar em</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((l) => {
                  // Monta uma caixa de seleção de nível (1, 2, 3...) para uma linha; `opcional` permite deixar em branco ("—").
                  const sel = (nome: string, niveis: { valor: number }[], valor: number | null, rotulo: string, opcional = false) => (
                    <select name={`${nome}_${l.id}`} defaultValue={valor ?? ""} required={!opcional} aria-label={`${rotulo} de ${codigoHira(l)}`} className={styles.selecao}>
                      {opcional && <option value="">—</option>}
                      {niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor}</option>)}
                    </select>
                  );
                  return (
                    <tr key={l.id}>
                      <td className={styles.celulaRegistro}>
                        <input type="hidden" name="ids" value={l.id} />
                        <Link href={`/hira/${l.id}`} className={styles.linkCodigo}>{codigoHira(l)}</Link> {l.atividade} — {l.perigo}
                        <span className={styles.subtexto}>{l.setor}</span>
                      </td>
                      <td><BadgeFaixa faixa={l.faixa} score={l.score} /></td>
                      <td>{sel("p", eixoP.niveis, l.probabilidade, eixoP.rotulo)}</td>
                      <td>{sel("s", eixoS.niveis, l.severidade, eixoS.rotulo)}</td>
                      <td>{sel("pr", eixoP.niveis, l.probabilidadeResidual, `${eixoP.rotulo} residual`, true)}</td>
                      <td>{sel("sr", eixoS.niveis, l.severidadeResidual, `${eixoS.rotulo} residual`, true)}</td>
                      <td className={styles.data}>{formatarData(l.proximaReavaliacaoEm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className={styles.observacao}>
            Observação da revisão
            <input name="observacao" maxLength={1000} placeholder="Ex.: revisão anual do HIRA da unidade" className={styles.entrada} />
          </label>
        </FormAcao>
      )}
    </div>
  );
}
