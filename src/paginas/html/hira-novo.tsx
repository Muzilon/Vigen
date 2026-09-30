import Link from "next/link";
import { notFound } from "next/navigation";
import { incluirHiraAcao } from "@/app/(app)/hira/actions";
import { getAtor } from "@/lib/ator-servidor";
import { infoAprovacaoHira, opcoesHira, podeGerenciarHira } from "@/lib/hira/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { HiraFormulario } from "@/paginas/html/hira-formulario";
import styles from "@/paginas/css/hira-novo.module.css";

/**
 * Página "Nova linha HIRA" (perigo e risco ocupacional). Exige a permissão de gerenciar a HIRA.
 * `?obra=` e `?processo=` pré-selecionam esses campos. Se a empresa exige aprovação, o botão vira "Enviar para aprovação".
 */
/** Nova linha HIRA (HIRA_GERENCIAR). `?obra=` / `?processo=` pré-selecionam. */
export default async function HiraNovo({ searchParams }: PageProps<"/hira/novo">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de HIRA, a página responde "404 - não encontrada".
  exigirModulo(ctx, "HIRA");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarHira(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Busca em paralelo as opções dos campos e a regra de aprovação da empresa para a HIRA.
  const [op, aprovacao] = await Promise.all([opcoesHira(a), infoAprovacaoHira(a)]);
  // Usa a unidade da URL se for válida; se a pessoa só tem uma unidade, já seleciona ela.
  const obraId = typeof sp.obra === "string" && op.obras.some((o) => o.id === sp.obra) ? sp.obra : (op.obras.length === 1 ? op.obras[0].id : "");
  // Aceita o processo da URL só se ele existir na lista.
  const processoId = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/hira" className={styles.linkVoltar}>← Perigos e riscos (HIRA)</Link>
      </nav>
      <h1 className={styles.titulo}>Nova linha HIRA</h1>
      <Cartao>
        <HiraFormulario
          acao={incluirHiraAcao}
          modo="incluir"
          botao={aprovacao ? "Enviar para aprovação" : "Incluir linha"}
          aprovacao={aprovacao}
          escalas={op.escalas}
          obras={op.obras}
          processos={op.processos}
          usuarios={op.usuarios}
          setores={op.setores}
          inicial={{
            obraId,
            setor: "",
            processoId,
            atividade: "",
            rotineira: true,
            perigo: "",
            risco: "",
            condicao: "NORMAL",
            controlesExistentes: "",
            hierarquiaControle: "",
            controlesPropostos: "",
            probabilidade: 3,
            severidade: 3,
            probabilidadeResidual: "",
            severidadeResidual: "",
            requisitoLegal: "",
            responsavelId: a.usuarioId,
            modoReavaliacao: "ITEM",
            periodicidadeMeses: 12,
          }}
        />
      </Cartao>
    </div>
  );
}
