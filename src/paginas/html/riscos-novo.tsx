import Link from "next/link";
import { notFound } from "next/navigation";
import { criarRiscoAcao } from "@/app/(app)/riscos/actions";
import { getAtor } from "@/lib/ator-servidor";
import { exigirModulo } from "@/lib/modulos";
import { opcoesFormulario, podeGerenciarRiscos } from "@/lib/riscos/servico";
import { getContexto } from "@/lib/tenant";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { RiscoFormulario } from "@/paginas/html/riscos-formulario";
import styles from "@/paginas/css/riscos-novo.module.css";

/**
 * Página "Novo risco ou oportunidade". Exige a permissão de gerenciar riscos.
 * Monta o formulário (riscos-formulario.tsx) já com valores iniciais; `?processo=` pré-seleciona o processo.
 */
/** Novo risco/oportunidade (RISCO_GERENCIAR). `?processo=` pré-seleciona o processo. */
export default async function RiscosNovo({ searchParams }: PageProps<"/riscos/novo">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Ameaças e Oportunidades, a página responde "404 - não encontrada".
  exigirModulo(ctx, "RISCOS_OPORTUNIDADES");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarRiscos(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Opções dos campos: escalas de avaliação, processos, unidades e pessoas.
  const op = await opcoesFormulario(a);
  // Aceita o processo da URL só se ele existir na lista.
  const processoId = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteBase`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/riscos" className={styles.linkVoltar}>← Ameaças e Oportunidades</Link>
      </nav>
      <h1 className={styles.titulo}>Novo risco ou oportunidade</h1>
      <Cartao>
        <RiscoFormulario
          acao={criarRiscoAcao}
          modo="criar"
          botao="Cadastrar"
          escalas={op.escalas}
          processos={op.processos}
          obras={op.obras}
          usuarios={op.usuarios}
          inicial={{
            tipo: "RISCO",
            descricao: "",
            causa: "",
            consequencia: "",
            processoId,
            obraId: "",
            responsavelId: a.usuarioId,
            probabilidade: 3,
            impacto: 3,
            modoReavaliacao: "ITEM",
            periodicidadeMeses: 12,
          }}
        />
      </Cartao>
    </div>
  );
}
