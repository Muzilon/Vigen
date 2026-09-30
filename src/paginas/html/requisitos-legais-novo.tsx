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

/**
 * Página "Novo requisito legal": cadastra a norma/lei e já registra a avaliação inicial de atendimento.
 * Exige a permissão de gerenciar requisitos. `?processo=` pré-seleciona o processo.
 */
export default async function RequisitosLegaisNovo({ searchParams }: PageProps<"/requisitos-legais/novo">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Requisitos Legais, a página responde "404 - não encontrada".
  exigirModulo(ctx, "REQUISITOS_LEGAIS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarRequisitos(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Busca em paralelo as opções dos campos e o fuso horário da empresa.
  const [op, fuso] = await Promise.all([opcoesRequisitos(a), fusoDaEmpresa(a)]);
  // Aceita o processo da URL só se ele existir na lista.
  const processo = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  // Data de hoje no fuso da empresa (valor padrão da data de verificação).
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
