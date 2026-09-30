import Link from "next/link";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { exigirPermissao, getDb } from "@/lib/tenant";
import { FormNovoPlano } from "@/paginas/html/plano-acao-novo-formulario";
import styles from "@/paginas/css/plano-acao-novo.module.css";

/**
 * Página "Novo plano de ação" (avulso, sem RNC de origem). Exige a permissão PLANO_GERENCIAR.
 * Só lista as unidades a que o usuário tem acesso.
 */
export default async function PlanoAcaoNovo() {
  // Exige a permissão e devolve o contexto do usuário; sem permissão, a página é bloqueada.
  const ctx = await exigirPermissao("PLANO_GERENCIAR");
  // Conexão com o banco já limitada à empresa do usuário logado.
  const db = await getDb();
  // Busca em paralelo: as unidades (filtradas pelo acesso do usuário) e os usuários ativos.
  const [obras, ativos] = await Promise.all([
    db.obraUnidade.findMany({
      where: { ativo: true, ...(ctx.obrasPermitidas ? { id: { in: ctx.obrasPermitidas } } : {}) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    usuariosAtivos(db),
  ]);
  // O formulário filtra o "quem" pela obra escolhida; o serviço valida de novo.
  // Ordena as pessoas por nome (alfabeto do português) e deixa só os campos que o formulário usa.
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
