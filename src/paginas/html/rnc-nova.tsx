import { exigirPermissao, getDb } from "@/lib/tenant";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { Alerta } from "@/paginas/html/componentes/alerta";
import { LinkBotao } from "@/paginas/html/componentes/botao";
import { FormNovaRnc } from "@/paginas/html/rnc-nova-formulario";
import styles from "@/paginas/css/rnc-nova.module.css";

/** Nova RNC — Direção A "Campo" (ver NovaRnc.dc.html e Mobile-NovaRnc.dc.html). */
export default async function RncNova() {
  const ctx = await exigirPermissao("RNC_ABRIR");
  const db = await getDb();
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
          <Alerta variante="aviso">Você não tem acesso a nenhuma obra/unidade. Solicite ao administrador.</Alerta>
          <LinkBotao href="/rncs" variante="secundario">Voltar</LinkBotao>
        </div>
      ) : (
        <FormNovaRnc obras={obras} setores={setores} usuarios={usuarios} podeSensiveis={ctx.permissoes.includes("RNC_VER_RESTRITAS")} />
      )}
    </div>
  );
}
