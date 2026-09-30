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

/**
 * Página "Nova linha LAIA" (aspecto e impacto ambiental). Exige a permissão de gerenciar a LAIA.
 * `?obra=` e `?processo=` pré-selecionam esses campos. Se a empresa exige aprovação, o botão vira "Enviar para aprovação".
 */
/** Nova linha LAIA (LAIA_GERENCIAR). `?obra=` / `?processo=` pré-selecionam. */
export default async function LaiaNovo({ searchParams }: PageProps<"/laia/novo">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de LAIA, a página responde "404 - não encontrada".
  exigirModulo(ctx, "LAIA");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarLaia(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Busca em paralelo as opções dos campos e a regra de aprovação da empresa para a LAIA.
  const [op, aprovacao] = await Promise.all([opcoesLaia(a), infoAprovacaoLaia(a)]);
  // Usa a unidade da URL se for válida; se a pessoa só tem uma unidade, já seleciona ela.
  const obraId = typeof sp.obra === "string" && op.obras.some((o) => o.id === sp.obra) ? sp.obra : (op.obras.length === 1 ? op.obras[0].id : "");
  // Aceita o processo da URL só se ele existir na lista.
  const processoId = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteBase`}>
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
