import Link from "next/link";
import { notFound } from "next/navigation";
import { criarAuditoriaAcao } from "@/app/(app)/auditorias/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { opcoesAuditorias, podeGerenciarAuditorias } from "@/lib/auditorias/servico";
import { hojeNoFuso } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { CamposAuditoria } from "@/paginas/html/auditoria-formulario";
import styles from "@/paginas/css/auditorias-nova.module.css";

/**
 * Página "Nova auditoria": planeja a auditoria (dados gerais) e, opcionalmente, já cria os itens do plano,
 * um por linha no formato "requisito | pergunta". Exige permissão de gerenciar auditorias.
 */
export default async function AuditoriasNova() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Auditorias, a página responde "404 - não encontrada".
  exigirModulo(ctx, "AUDITORIAS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarAuditorias(a)) notFound();
  // Opções dos campos (programas, unidades, processos, pessoas) e fuso horário da empresa.
  const [op, fuso] = await Promise.all([opcoesAuditorias(a), fusoDaEmpresa(a)]);
  // Data de hoje (valor padrão de início e fim).
  const hoje = hojeNoFuso(fuso);
  // Ano atual, usado para escolher automaticamente o programa de auditorias do ano.
  const ano = Number(hoje.slice(0, 4));
  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/auditorias">← Auditorias</Link></nav>
      <h1 className={styles.titulo}>Nova auditoria</h1>
      <FormAcao acao={criarAuditoriaAcao} botao="Planejar auditoria" className={styles.formulario}>
        <CamposAuditoria
          v={{ dataInicio: hoje, dataFim: hoje, auditorLiderId: a.usuarioId, programaId: op.programas.find((p) => p.ano === ano)?.id ?? "" }}
          programas={op.programas}
          obras={op.obras}
          processos={op.processos}
          usuarios={op.usuarios}
        />
        <label className={styles.campo}>
          Plano da auditoria (opcional) — um item por linha, no formato &quot;requisito | pergunta/critério&quot;
          <textarea name="itens" rows={5} placeholder={"7.5.3 | Documentos obsoletos são retirados de uso?\n8.5.1 | Há controle de produção documentado?"} className={styles.entrada} />
        </label>
      </FormAcao>
    </div>
  );
}
