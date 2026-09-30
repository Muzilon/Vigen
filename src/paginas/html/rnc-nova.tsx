import { exigirPermissao, getDb } from "@/lib/tenant";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { LinkBotao } from "@/paginas/html/componentes/botao";
import { FormNovaRnc } from "@/paginas/html/rnc-nova-formulario";
import styles from "@/paginas/css/rnc-nova.module.css";

/**
 * Página "Nova RNC". Qualquer pessoa com a permissão RNC_ABRIR pode abrir uma não conformidade.
 * Mostra o formulário (rnc-nova-formulario.tsx) ou, se o usuário não tem nenhuma unidade liberada, um aviso.
 */
export default async function RncNova() {
  // Exige a permissão de abrir RNC; devolve o contexto do usuário.
  const ctx = await exigirPermissao("RNC_ABRIR");
  // Conexão com o banco já limitada à empresa do usuário.
  const db = await getDb();
  // Busca em paralelo: unidades permitidas ao usuário, setores ativos e usuários ativos.
  const [obras, setores, ativos] = await Promise.all([
    db.obraUnidade.findMany({
      where: { ativo: true, ...(ctx.obrasPermitidas ? { id: { in: ctx.obrasPermitidas } } : {}) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    db.setor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    usuariosAtivos(db),
  ]);
  // Responsável sugerido: só quem pode tratar RNCs (o serviço valida obra/restrita).
  const usuarios = ativos
    .filter((u) => u.permissoes.includes("RNC_TRATAR"))
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
    .map((u) => ({ id: u.id, nome: u.nome }));

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <div className={styles.cabecalho}>
        <h1 className={styles.titulo}>Nova RNC</h1>
        <span className={styles.espacador} />
        <span className={styles.dica}>
          Análise e plano de ação vêm depois · <span className={styles.obrigatorio}>*</span> obrigatório
        </span>
      </div>
      {obras.length === 0 ? (
        <div className={styles.semObras}>
          <Alerta variante="aviso">Você não tem acesso a nenhuma unidade. Solicite ao administrador.</Alerta>
          <LinkBotao href="/rncs" variante="secundario">Voltar</LinkBotao>
        </div>
      ) : (
        <FormNovaRnc obras={obras} setores={setores} usuarios={usuarios} podeSensiveis={ctx.permissoes.includes("RNC_VER_RESTRITAS")} />
      )}
    </div>
  );
}
