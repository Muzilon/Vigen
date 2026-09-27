import Link from "next/link";
import { notFound } from "next/navigation";
import { criarRequisitoAcao } from "@/app/(app)/requisitos-legais/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { hojeNoFuso } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { opcoesRequisitos, podeGerenciarRequisitos } from "@/lib/requisitos-legais/servico";
import { getContexto } from "@/lib/tenant";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { CamposRequisito, CamposVerificacao } from "@/paginas/html/requisito-legal-formulario";
import styles from "@/paginas/css/requisitos-legais-novo.module.css";

/** Cadastro de requisito legal (REQUISITO_LEGAL_GERENCIAR). `?processo=` pré-seleciona o processo. */
export default async function RequisitosLegaisNovo({ searchParams }: PageProps<"/requisitos-legais/novo">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "REQUISITOS_LEGAIS");
  const a = await getAtor();
  if (!podeGerenciarRequisitos(a)) notFound();
  const sp = await searchParams;
  const [op, fuso] = await Promise.all([opcoesRequisitos(a), fusoDaEmpresa(a)]);
  const processo = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  const hoje = hojeNoFuso(fuso);
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/requisitos-legais">← Requisitos legais</Link></nav>
      <h1 className={styles.titulo}>Novo requisito legal</h1>
      <FormAcao acao={criarRequisitoAcao} botao="Cadastrar requisito" className={styles.formulario}>
        <CamposRequisito v={{ processoId: processo, responsavelId: a.usuarioId }} obras={op.obras} processos={op.processos} usuarios={op.usuarios} />
        <h2 className={styles.subtitulo}>Avaliação inicial de atendimento</h2>
        <CamposVerificacao usuarios={op.usuarios} hoje={hoje} />
      </FormAcao>
    </div>
  );
}
