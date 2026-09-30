import Link from "next/link";
import { salvarProgramaAcao } from "@/app/(app)/auditorias/actions";
import { getAtor } from "@/lib/ator-servidor";
import { contarPorTipo, ROTULO_STATUS_AUDITORIA, ROTULO_TIPO_AUDITORIA } from "@/lib/auditorias/regras";
import { listarProgramas, podeGerenciarAuditorias } from "@/lib/auditorias/servico";
import { formatarData } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/auditorias-programa.module.css";

/**
 * Página "Programa anual de auditorias": mostra, para cada ano, o objetivo e o cronograma das auditorias
 * (período, código, norma/escopo, tipo, auditor líder, status e nº de não conformidades).
 * Quem gerencia pode editar o objetivo e criar o programa de um novo ano.
 */
/** Programa anual de auditorias: objetivo do ano e auditorias vinculadas (cronograma). */
export default async function AuditoriasPrograma() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Auditorias, a página responde "404 - não encontrada".
  exigirModulo(ctx, "AUDITORIAS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Programas de auditoria já cadastrados, com as auditorias de cada um.
  const programas = await listarProgramas(a);
  // `g`: verdadeiro se o usuário pode editar objetivos e criar programas.
  const g = podeGerenciarAuditorias(a);
  // Ano atual: se já existe programa dele, o campo "Ano" do novo programa sugere o ano seguinte.
  const anoAtual = new Date().getFullYear();

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/auditorias">← Auditorias</Link></nav>
      <CabecalhoPagina titulo="Programa anual de auditorias" contador={programas.length} subtitulo="Objetivo do ano e cronograma das auditorias planejadas." />
      {programas.length === 0 && <EstadoVazio>Nenhum programa cadastrado.</EstadoVazio>}
      {programas.map((p) => (
        <Cartao key={p.id} titulo={`Programa ${p.ano} · ${p.auditorias.length} auditoria(s)`}>
          <p className={styles.objetivo}>{p.objetivo}</p>
          {g && (
            <details className={styles.detalhes}>
              <summary>Editar objetivo</summary>
              <FormAcao acao={salvarProgramaAcao} botao="Salvar" tamanho="pequeno" className={styles.form}>
                <input type="hidden" name="ano" value={p.ano} />
                <textarea name="objetivo" required rows={3} defaultValue={p.objetivo} aria-label="Objetivo" className={styles.entrada} />
              </FormAcao>
            </details>
          )}
          {p.auditorias.length > 0 && (
            <div className={styles.quadro}>
              <table className={styles.tabela}>
                <thead>
                  <tr><th scope="col">Período</th><th scope="col">Código</th><th scope="col">Norma / escopo</th><th scope="col">Tipo</th><th scope="col">Auditor líder</th><th scope="col">Status</th><th scope="col">NC</th></tr>
                </thead>
                <tbody>
                  {p.auditorias.map((x) => (
                    <tr key={x.id}>
                      <td>{formatarData(x.dataInicio)}</td>
                      <td className={styles.codigo}><Link href={`/auditorias/${x.id}`}>{x.codigo}</Link></td>
                      <td>{x.norma} — {x.escopo}</td>
                      <td>{ROTULO_TIPO_AUDITORIA[x.tipo]}</td>
                      <td>{x.auditorLider.nome}</td>
                      <td>{ROTULO_STATUS_AUDITORIA[x.status]}</td>
                      <td>{contarPorTipo(x.constatacoes).NAO_CONFORMIDADE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      ))}
      {g && (
        <Cartao titulo="Novo programa">
          <FormAcao acao={salvarProgramaAcao} botao="Salvar programa" tamanho="pequeno" className={styles.form}>
            <label className={styles.campo}>Ano<input name="ano" type="number" min={2000} max={2100} defaultValue={programas.some((p) => p.ano === anoAtual) ? anoAtual + 1 : anoAtual} className={styles.entrada} /></label>
            <label className={styles.campo}>Objetivo<textarea name="objetivo" required rows={3} className={styles.entrada} /></label>
          </FormAcao>
        </Cartao>
      )}
    </div>
  );
}
