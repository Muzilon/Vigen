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

/** Novo risco/oportunidade (RISCO_GERENCIAR). `?processo=` pré-seleciona o processo. */
export default async function RiscosNovo({ searchParams }: PageProps<"/riscos/novo">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "RISCOS_OPORTUNIDADES");
  const a = await getAtor();
  if (!podeGerenciarRiscos(a)) notFound();
  const sp = await searchParams;
  const op = await opcoesFormulario(a);
  const processoId = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/riscos" className={styles.linkVoltar}>← Riscos e oportunidades</Link>
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
