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

/** Novo documento (DOCUMENTO_ELABORAR). `?processo=` pré-seleciona o processo. */
export default async function DocumentosNovo({ searchParams }: PageProps<"/documentos/novo">) {
  const ctx = await getContexto();
  exigirModulo(ctx, "DOCUMENTOS");
  const a = await getAtor();
  if (!podeElaborarDocumentos(a)) notFound();
  const sp = await searchParams;
  const op = await opcoesDocumentos(a);
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
