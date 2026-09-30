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

/**
 * Página "Novo treinamento": cadastra um treinamento no catálogo (nome, validade, para quem é obrigatório etc.).
 * Só quem tem a permissão de gerenciar treinamentos acessa.
 */
export default async function TreinamentosNovo() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Treinamentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "TREINAMENTOS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarTreinamentos(a)) notFound();
  // Opções dos campos: setores, funções e documentos publicados.
  const op = await opcoesTreinamentos(a);
  return (
    <div className={`${styles.pagina} fonteBase`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/treinamentos">← Treinamentos</Link></nav>
      <h1 className={styles.titulo}>Novo treinamento</h1>
      <FormAcao acao={criarTreinamentoAcao} botao="Cadastrar treinamento" className={styles.formulario}>
        <CamposTreinamento v={{}} setores={op.setores} funcoes={op.funcoes} documentos={op.documentos} />
      </FormAcao>
    </div>
  );
}
