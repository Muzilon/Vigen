import Link from "next/link";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { exigirPermissao, getDb } from "@/lib/tenant";
import { FormNovoPlano } from "@/paginas/html/plano-acao-novo-formulario";
import styles from "@/paginas/css/plano-acao-novo.module.css";

/** Novo plano de ação avulso (sem RNC de origem). Ver PlanoManual.dc.html. */
export default async function PlanoAcaoNovo() {
  const ctx = await exigirPermissao("PLANO_GERENCIAR");
  const db = await getDb();
  const [obras, ativos] = await Promise.all([
    db.obraUnidade.findMany({
      where: { ativo: true, ...(ctx.obrasPermitidas ? { id: { in: ctx.obrasPermitidas } } : {}) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    usuariosAtivos(db),
  ]);
  // O formulário filtra o "quem" pela obra escolhida; o serviço valida de novo.
  const usuarios = ativos
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
    .map((u) => ({ id: u.id, nome: u.nome, obras: u.obras }));

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <div>
        <nav aria-label="Trilha da página" className={styles.trilha}>
          <Link href="/plano-acao" className={styles.linkTrilha}>Plano de Ação</Link>
          <span aria-hidden="true">/</span>
          <span className={styles.trilhaAtual}>Novo plano avulso</span>
        </nav>
        <h1 className={styles.titulo}>Novo plano de ação</h1>
        <p className={styles.subtitulo}>Plano avulso, sem RNC de origem (ex.: melhoria, reunião, requisito legal).</p>
      </div>
      <FormNovoPlano obras={obras} usuarios={usuarios} />
    </div>
  );
}
