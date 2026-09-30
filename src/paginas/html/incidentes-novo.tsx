import Link from "next/link";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { dataHoraLocal, opcoesIncidentes, podeVerRestritosIncidente } from "@/lib/incidentes/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { IncidenteNovoFormulario } from "@/paginas/html/incidentes-novo-formulario";
import styles from "@/paginas/css/incidentes-novo.module.css";

/**
 * Página "Registrar incidente": qualquer usuário com o módulo pode registrar um acidente, quase-acidente
 * ou doença ocupacional nas unidades a que tem acesso. O formulário em si fica em incidentes-novo-formulario.tsx.
 * É um componente de servidor (async): busca os dados no banco antes de desenhar a tela.
 */
export default async function IncidentesNovo() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Incidentes, a página responde "404 - não encontrada".
  exigirModulo(ctx, "INCIDENTES");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo as opções dos campos (unidades, setores, pessoas) e o fuso horário da empresa.
  const [op, fuso] = await Promise.all([opcoesIncidentes(a), fusoDaEmpresa(a)]);
  return (
    <div className={`${styles.pagina} fonteBase`}>
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
