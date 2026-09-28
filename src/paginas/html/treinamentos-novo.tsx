import Link from "next/link";
import { notFound } from "next/navigation";
import { criarTreinamentoAcao } from "@/app/(app)/treinamentos/actions";
import { getAtor } from "@/lib/ator-servidor";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { opcoesTreinamentos, podeGerenciarTreinamentos } from "@/lib/treinamentos/servico";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { CamposTreinamento } from "@/paginas/html/treinamento-formulario";
import styles from "@/paginas/css/treinamentos-novo.module.css";

/** Cadastro de treinamento no catálogo (TREINAMENTO_GERENCIAR). */
export default async function TreinamentosNovo() {
  const ctx = await getContexto();
  exigirModulo(ctx, "TREINAMENTOS");
  const a = await getAtor();
  if (!podeGerenciarTreinamentos(a)) notFound();
  const op = await opcoesTreinamentos(a);
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/treinamentos">← Treinamentos</Link></nav>
      <h1 className={styles.titulo}>Novo treinamento</h1>
      <FormAcao acao={criarTreinamentoAcao} botao="Cadastrar treinamento" className={styles.formulario}>
        <CamposTreinamento v={{}} setores={op.setores} funcoes={op.funcoes} documentos={op.documentos} />
      </FormAcao>
    </div>
  );
}
