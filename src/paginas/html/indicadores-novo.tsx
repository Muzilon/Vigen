import Link from "next/link";
import { notFound } from "next/navigation";
import { criarIndicadorAcao } from "@/app/(app)/indicadores/actions";
import { getAtor } from "@/lib/ator-servidor";
import { opcoesIndicadores, podeGerenciarIndicadores } from "@/lib/indicadores/gestao";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { CamposIndicador } from "@/paginas/html/indicador-formulario";
import styles from "@/paginas/css/indicadores-novo.module.css";

/** Cadastro de indicador (INDICADOR_GERENCIAR). `?processo=` pré-seleciona o processo. */
export default async function IndicadoresNovo({ searchParams }: PageProps<"/indicadores/novo">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "INDICADORES");
  const a = await getAtor();
  if (!podeGerenciarIndicadores(a)) notFound();
  const sp = await searchParams;
  const op = await opcoesIndicadores(a);
  const processo = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/indicadores">← Indicadores</Link></nav>
      <h1 className={styles.titulo}>Novo indicador</h1>
      <p className={styles.texto}>
        Indicadores manuais têm o valor lançado pelo responsável a cada período. Os automáticos calculam o valor a partir dos dados
        do sistema (RNC e Plano de Ação) e o responsável só confirma o registro.
      </p>
      <FormAcao acao={criarIndicadorAcao} botao="Cadastrar indicador" className={styles.formulario}>
        <CamposIndicador v={{ processoId: processo, responsavelId: a.usuarioId }} processos={op.processos} usuarios={op.usuarios} />
      </FormAcao>
    </div>
  );
}
