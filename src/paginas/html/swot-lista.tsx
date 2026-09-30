import Link from "next/link";
import { criarCicloAcao } from "@/app/(app)/swot/actions";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { anoNoFuso } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { listarCiclos, podeGerenciarSwot } from "@/lib/swot/servico";
import { getContexto } from "@/lib/tenant";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/swot-lista.module.css";

/**
 * Página "SWOT e partes interessadas": lista os ciclos anuais de análise de contexto (ISO 9001 4.1/4.2)
 * e, para quem pode gerenciar, o formulário de criar um novo ciclo (podendo copiar os itens do anterior).
 */
/** Ciclos anuais de análise de contexto (SWOT + partes interessadas, ISO 9001 4.1/4.2). */
export default async function SwotLista() {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de SWOT, a página responde "404 - não encontrada".
  exigirModulo(ctx, "SWOT");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo os ciclos já criados e o fuso horário da empresa.
  const [ciclos, fuso] = await Promise.all([listarCiclos(a), fusoDaEmpresa(a)]);
  // Ano atual e sugestão do ano do próximo ciclo (se o do ano atual já existe, sugere o seguinte).
  const anoAtual = anoNoFuso(fuso);
  const proximoAno = ciclos.some((c) => c.ano === anoAtual) ? Math.max(anoAtual, ...ciclos.map((c) => c.ano)) + 1 : anoAtual;
  // `g`: verdadeiro se o usuário pode criar/editar ciclos (senão vê só a lista).
  const g = podeGerenciarSwot(a);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="SWOT e partes interessadas"
        contador={ciclos.length}
        subtitulo="Análise de contexto da organização por ciclo anual (ISO 9001 4.1 e 4.2)."
      />

      {g && (
        <Cartao titulo="Novo ciclo">
          <FormAcao acao={criarCicloAcao} botao="Criar ciclo" className={styles.formulario}>
            <label className={styles.campo}>
              Ano <input name="ano" type="number" min={2000} max={2100} defaultValue={proximoAno} required className={styles.entrada} />
            </label>
            <label className={styles.campoLargo}>
              Título <input name="titulo" placeholder={`Análise de contexto ${proximoAno}`} maxLength={150} className={styles.entrada} />
            </label>
            {ciclos.length > 0 && (
              <label className={styles.opcao}>
                <input type="checkbox" name="copiar" value="1" defaultChecked /> Copiar itens e partes interessadas do ciclo anterior
              </label>
            )}
          </FormAcao>
        </Cartao>
      )}

      {ciclos.length === 0 ? (
        <EstadoVazio>Nenhum ciclo SWOT cadastrado.</EstadoVazio>
      ) : (
        <ul className={styles.lista}>
          {ciclos.map((c) => (
            <li key={c.id}>
              <Link href={`/swot/${c.id}`} className={styles.ciclo}>
                <span className={styles.ano}>{c.ano}</span>
                <span className={styles.tituloCiclo}>{c.titulo}</span>
                <span className={styles.contagens}>
                  {c._count.itens} itens · {c._count.partesInteressadas} partes interessadas
                </span>
                <span className={c.encerrado ? styles.encerrado : styles.aberto}>{c.encerrado ? "Encerrado" : "Em andamento"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
