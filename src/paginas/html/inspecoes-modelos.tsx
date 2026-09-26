import Link from "next/link";
import { notFound } from "next/navigation";
import { criarModeloAcao } from "@/app/(app)/inspecoes/actions";
import { getAtor } from "@/lib/ator-servidor";
import { ROTULO_TIPO_CHECKLIST, TIPOS_CHECKLIST } from "@/lib/inspecoes/regras";
import { listarModelos, podeGerenciarModelos } from "@/lib/inspecoes/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/inspecoes-modelos.module.css";

/** Modelos de checklist (INSPECAO_GERENCIAR): lista e cadastro; as perguntas são editadas no detalhe. */
export default async function InspecoesModelos() {
  const ctx = await getContexto();
  exigirModulo(ctx, "INSPECOES");
  const a = await getAtor();
  if (!podeGerenciarModelos(a)) notFound();
  const modelos = await listarModelos(a, { todos: true });

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/inspecoes">← Inspeções</Link>
      </nav>
      <CabecalhoPagina titulo="Modelos de checklist" contador={modelos.length} subtitulo="Perguntas, tipo de resposta, critério e foto obrigatória em não conformidade." />

      {modelos.length === 0 ? (
        <EstadoVazio>Nenhum modelo cadastrado.</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Modelo</th>
                <th scope="col">Tipo</th>
                <th scope="col">Perguntas</th>
                <th scope="col">Nota mínima</th>
                <th scope="col">Inspeções</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => (
                <tr key={m.id} className={m.ativo ? undefined : styles.inativo}>
                  <td><Link href={`/inspecoes/modelos/${m.id}`} className={styles.link}>{m.nome}</Link></td>
                  <td>{ROTULO_TIPO_CHECKLIST[m.tipo]}</td>
                  <td>{m.totalItens}</td>
                  <td>{m.notaMinima}</td>
                  <td>{m._count.inspecoes}</td>
                  <td>{m.ativo ? "Ativo" : "Inativo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Cartao titulo="Novo modelo">
        <FormAcao acao={criarModeloAcao} botao="Criar e adicionar perguntas" className={styles.formulario}>
          <label className={styles.campoLargo}>Nome<input name="nome" required minLength={3} maxLength={150} className={styles.entrada} /></label>
          <label className={styles.campo}>Tipo
            <select name="tipo" defaultValue="GERAL" className={styles.entrada}>
              {TIPOS_CHECKLIST.map((t) => <option key={t} value={t}>{ROTULO_TIPO_CHECKLIST[t]}</option>)}
            </select>
          </label>
          <label className={styles.campo}>Nota mínima (itens de nota 1–5)
            <input name="notaMinima" type="number" min={1} max={5} defaultValue={3} className={styles.entrada} />
          </label>
          <label className={styles.campoLargo}>Descrição (opcional)<textarea name="descricao" rows={2} maxLength={2000} className={styles.entrada} /></label>
        </FormAcao>
      </Cartao>
    </div>
  );
}
