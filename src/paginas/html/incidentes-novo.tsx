import Link from "next/link";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataHoraLocal, opcoesIncidentes, podeVerRestritosIncidente } from "@/lib/incidentes/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { IncidenteNovoFormulario } from "@/paginas/html/incidentes-novo-formulario";
import styles from "@/paginas/css/incidentes-novo.module.css";

/** Registro de incidente/acidente — aberto a qualquer usuário com o módulo (obras do seu escopo). */
export default async function IncidentesNovo() {
  const ctx = await getContexto();
  exigirModulo(ctx, "INCIDENTES");
  const a = await getAtor();
  const [op, fuso] = await Promise.all([opcoesIncidentes(a), fusoDaEmpresa(a)]);
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/incidentes">← Incidentes e acidentes</Link></nav>
      <h1 className={styles.titulo}>Registrar incidente</h1>
      <p className={styles.descricao}>Registre acidentes, quase-acidentes e doenças ocupacionais. Dados pessoais ficam protegidos (LGPD).</p>
      {op.obras.length === 0 ? (
        <p className={styles.descricao}>Você não tem acesso a nenhuma unidade.</p>
      ) : (
        <IncidenteNovoFormulario obras={op.obras} setores={op.setores} usuarios={op.usuarios} agora={dataHoraLocal(new Date(), fuso)} podeSensiveis={podeVerRestritosIncidente(a)} />
      )}
    </div>
  );
}
