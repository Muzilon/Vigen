import Link from "next/link";
import { notFound } from "next/navigation";
import { criarDocumentoAcao } from "@/app/(app)/documentos/actions";
import { getAtor } from "@/lib/ator-servidor";
import { podeElaborarDocumentos } from "@/lib/documentos/acesso";
import { opcoesDocumentos } from "@/lib/documentos/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { DocumentoNovoFormulario } from "@/paginas/html/documento-novo-formulario";
import styles from "@/paginas/css/documentos-novo.module.css";

/**
 * Página "Novo documento": cria o registro do documento controlado. Exige a permissão de elaborar documentos.
 * Se ainda não houver nenhum tipo de documento ativo, mostra um aviso explicando onde cadastrá-los.
 */
export default async function DocumentosNovo({ searchParams }: PageProps<"/documentos/novo">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Documentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "DOCUMENTOS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeElaborarDocumentos(a)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Opções dos campos: tipos de documento, processos, unidades, setores e pessoas.
  const op = await opcoesDocumentos(a);
  // Aceita o processo da URL só se ele existir na lista.
  const processoId = typeof sp.processo === "string" && op.processos.some((p) => p.id === sp.processo) ? sp.processo : "";
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/documentos" className={styles.linkVoltar}>← Lista mestra de documentos</Link>
      </nav>
      <h1 className={styles.titulo}>Novo documento</h1>
      {op.tipos.length === 0 ? (
        <Alerta variante="aviso">Nenhum tipo de documento ativo. Cadastre os tipos em Configurações → Tipos de documento.</Alerta>
      ) : (
        <Cartao>
          <DocumentoNovoFormulario
            acao={criarDocumentoAcao}
            tipos={op.tipos}
            processos={op.processos}
            obras={op.obras}
            setores={op.setores}
            usuarios={op.usuarios}
            inicial={{ processoId, responsavelId: a.usuarioId }}
          />
        </Cartao>
      )}
    </div>
  );
}
