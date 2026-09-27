import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { revisaoGeralRequisitosAcao } from "@/app/(app)/requisitos-legais/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataIso, formatarData, hojeNoFuso } from "@/lib/datas";
import { enumUrl } from "@/lib/filtros-url";
import { exigirModulo } from "@/lib/modulos";
import { ROTULO_STATUS_REQUISITO, ROTULO_TEMA, TEMAS, verificacaoVencida } from "@/lib/requisitos-legais/regras";
import { listarRequisitos, podeGerenciarRequisitos } from "@/lib/requisitos-legais/servico";
import { getContexto } from "@/lib/tenant";
import { BadgeStatusRequisito } from "@/paginas/html/componentes/badge";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/requisitos-legais-revisao-geral.module.css";

const esquema = z.object({ tema: enumUrl(["QUALIDADE", "SSO", "MEIO_AMBIENTE"]) });

/**
 * Revisão geral: marca um lote de requisitos como revisados numa data (status mantido; cada um ganha histórico
 * e nova data de verificação). Para mudar o status de um requisito, use "Registrar verificação" no detalhe.
 */
export default async function RequisitosLegaisRevisaoGeral({ searchParams }: PageProps<"/requisitos-legais/revisao-geral">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "REQUISITOS_LEGAIS");
  const a = await getAtor();
  if (!podeGerenciarRequisitos(a)) notFound();
  const f = esquema.parse(await searchParams);
  const [lista, fuso] = await Promise.all([listarRequisitos(a, { tema: f.tema || undefined }), fusoDaEmpresa(a)]);
  const hoje = hojeNoFuso(fuso);
  const ativos = lista.filter((r) => r.status !== "NAO_APLICAVEL");

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/requisitos-legais">← Requisitos legais</Link></nav>
      <h1 className={styles.titulo}>Revisão geral de requisitos legais</h1>
      <p className={styles.descricao}>
        Marque os requisitos revisados e a data da revisão. O status de cada um é mantido; todos ganham registro no histórico e a
        próxima verificação é recalculada pela periodicidade. Requisitos &quot;não aplicáveis&quot; ficam fora.
      </p>
      <nav className={styles.temas} aria-label="Filtrar por tema">
        <Link href="/requisitos-legais/revisao-geral" aria-current={!f.tema ? "page" : undefined}>Todos</Link>
        {TEMAS.map((t) => (
          <Link key={t} href={`/requisitos-legais/revisao-geral?tema=${t}`} aria-current={f.tema === t ? "page" : undefined}>{ROTULO_TEMA[t]}</Link>
        ))}
      </nav>
      {ativos.length === 0 ? (
        <EstadoVazio>Nenhum requisito aplicável neste escopo.</EstadoVazio>
      ) : (
        <FormAcao acao={revisaoGeralRequisitosAcao} botao="Registrar revisão geral" className={styles.formulario}>
          <div className={styles.campos}>
            <label className={styles.campo}>Data da revisão
              <input type="date" name="data" required defaultValue={hoje} max={hoje} className={styles.entrada} />
            </label>
            <label className={styles.campoLargo}>Observação
              <input name="observacao" maxLength={2000} placeholder="Ex.: Revisão anual do registro legal — análise crítica" className={styles.entrada} />
            </label>
          </div>
          <div className={styles.quadro}>
            <table className={styles.tabela}>
              <thead>
                <tr><th scope="col">Revisar</th><th scope="col">Código</th><th scope="col">Requisito</th><th scope="col">Tema</th><th scope="col">Status</th><th scope="col">Última</th><th scope="col">Próxima</th></tr>
              </thead>
              <tbody>
                {ativos.map((r) => {
                  const venc = verificacaoVencida(r.proximaVerificacaoEm ? dataIso(r.proximaVerificacaoEm) : null, hoje, r.status);
                  return (
                    <tr key={r.id}>
                      <td><input type="checkbox" name="ids" value={r.id} defaultChecked aria-label={`Revisar ${r.codigo}`} /></td>
                      <td className={styles.mono}>{r.codigo}</td>
                      <td><strong>{r.numero}</strong> <span className={styles.sub}>{r.titulo}</span></td>
                      <td>{ROTULO_TEMA[r.tema]}</td>
                      <td><BadgeStatusRequisito status={r.status} rotulo={ROTULO_STATUS_REQUISITO[r.status]} /></td>
                      <td className={styles.mono}>{formatarData(r.ultimaVerificacaoEm)}</td>
                      <td className={`${styles.mono} ${venc ? styles.vencida : ""}`}>{formatarData(r.proximaVerificacaoEm)}{venc ? " (vencida)" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FormAcao>
      )}
    </div>
  );
}
