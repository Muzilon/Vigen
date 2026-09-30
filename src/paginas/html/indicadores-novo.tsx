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

/**
 * Página "Novo indicador". Só quem tem a permissão de gerenciar indicadores acessa.
 * Se o endereço trouxer `?processo=...`, o processo já vem selecionado no formulário.
 */
export default async function IndicadoresNovo({ searchParams }: PageProps<"/indicadores/novo">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Indicadores, a página responde "404 - não encontrada".
  exigirModulo(ctx, "INDICADORES");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarIndicadores(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Carrega as opções dos campos: lista de processos e de pessoas.
  const op = await opcoesIndicadores(a);
  // Só aceita o processo da URL se ele realmente existir na lista (evita valor inventado).
  const processo = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteBase`}>
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
