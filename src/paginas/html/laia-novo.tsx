import Link from "next/link";
import { notFound } from "next/navigation";
import { incluirLaiaAcao } from "@/app/(app)/laia/actions";
import { getAtor } from "@/lib/ator-servidor";
import { infoAprovacaoLaia, opcoesLaia, podeGerenciarLaia } from "@/lib/laia/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { LaiaFormulario } from "@/paginas/html/laia-formulario";
import styles from "@/paginas/css/laia-novo.module.css";

/** Nova linha LAIA (LAIA_GERENCIAR). `?obra=` / `?processo=` pré-selecionam. */
export default async function LaiaNovo({ searchParams }: PageProps<"/laia/novo">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "LAIA");
  const a = await getAtor();
  if (!podeGerenciarLaia(a)) notFound();
  const sp = await searchParams;
  const [op, aprovacao] = await Promise.all([opcoesLaia(a), infoAprovacaoLaia(a)]);
  const obraId = typeof sp.obra === "string" && op.obras.some((o) => o.id === sp.obra) ? sp.obra : (op.obras.length === 1 ? op.obras[0].id : "");
  const processoId = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/laia" className={styles.linkVoltar}>← Aspectos e impactos (LAIA)</Link>
      </nav>
      <h1 className={styles.titulo}>Nova linha LAIA</h1>
      <Cartao>
        <LaiaFormulario
          acao={incluirLaiaAcao}
          modo="incluir"
          botao={aprovacao ? "Enviar para aprovação" : "Incluir linha"}
          aprovacao={aprovacao}
          escalas={op.escalas}
          obras={op.obras}
          processos={op.processos}
          usuarios={op.usuarios}
          inicial={{
            obraId,
            processoId,
            atividade: "",
            aspecto: "",
            impacto: "",
            situacao: "NORMAL",
            temporalidade: "ATUAL",
            incidencia: "DIRETA",
            severidade: 2,
            frequencia: 2,
            abrangencia: 1,
            requisitoLegal: false,
            partesInteressadas: false,
            controles: "",
            responsavelId: a.usuarioId,
            modoReavaliacao: "ITEM",
            periodicidadeMeses: 12,
          }}
        />
      </Cartao>
    </div>
  );
}
