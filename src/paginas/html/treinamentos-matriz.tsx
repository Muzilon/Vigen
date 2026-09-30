import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { uuidUrl } from "@/lib/filtros-url";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { ROTULO_STATUS_COMPETENCIA } from "@/lib/treinamentos/regras";
import { listarTreinamentos, matrizCompetencias, opcoesTreinamentos, podeGerenciarTreinamentos } from "@/lib/treinamentos/servico";
import { BadgeAptidao, BadgeStatusCompetencia } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/treinamentos-matriz.module.css";

// Regra de validação dos filtros da URL (unidade, pessoa, treinamento).
const esquema = z.object({ obra: uuidUrl, usuario: uuidUrl, treinamento: uuidUrl });

/**
 * Página "Matriz de competências": uma grade pessoas × treinamentos, com a aptidão de cada pessoa e o status
 * (em dia, a vencer, vencido...) em cada treinamento. Filtros por unidade, pessoa e treinamento.
 * Exige a permissão de gerenciar treinamentos.
 */
/** Matriz de competências (TREINAMENTO_GERENCIAR): pessoas × treinamentos com status; filtro por obra, pessoa e treinamento. */
export default async function TreinamentosMatriz({ searchParams }: PageProps<"/treinamentos/matriz">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Treinamentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "TREINAMENTOS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Sem a permissão necessária, a página responde 404 (não revela que ela existe).
  if (!podeGerenciarTreinamentos(a)) notFound();
  // Lê e valida os filtros da URL.
  const f = esquema.parse(await searchParams);
  // Busca em paralelo a matriz (já filtrada), as opções dos filtros e o catálogo de treinamentos.
  const [m, op, catalogo] = await Promise.all([
    matrizCompetencias(a, { obraId: f.obra || undefined, usuarioId: f.usuario || undefined, treinamentoId: f.treinamento || undefined }),
    opcoesTreinamentos(a),
    listarTreinamentos(a),
  ]);
  // `r`: os números do resumo (% em dia, a vencer, vencidos...).
  const r = m.resumo;
  // Dicionário id → nome do treinamento, para explicar as pendências de cada pessoa.
  const nomeTreinamento = new Map(m.treinamentos.map((t) => [t.id, t.nome]));

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <CabecalhoPagina
        titulo="Matriz de competências"
        contador={m.linhas.length}
        subtitulo="Situação de cada pessoa em cada treinamento (última realização válida). Célula vazia: não obrigatório e não realizado."
      />

      <div className={styles.resumo}>
        <span><strong className={styles.numero}>{r.percentualEmDia === null ? "—" : `${r.percentualEmDia}%`}</strong> em dia ({r.emDia} de {r.obrigatorias} obrigatórios)</span>
        <span className={r.aVencer ? styles.aviso : undefined}><strong className={styles.numero}>{r.aVencer}</strong> vencendo em 30 dias</span>
        <span className={r.vencidos ? styles.alerta : undefined}><strong className={styles.numero}>{r.vencidos}</strong> vencido(s)</span>
        <span><strong className={styles.numero}>{r.naoRealizados}</strong> obrigatório(s) não realizado(s)</span>
        <span className={r.reciclagemPendente ? styles.alerta : undefined}><strong className={styles.numero}>{r.reciclagemPendente}</strong> reciclagem(ns) pendente(s)</span>
        <span className={r.inaptos ? styles.alerta : undefined}><strong className={styles.numero}>{r.inaptos}</strong> pessoa(s) inapta(s)</span>
      </div>

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Unidade</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra}>
            <option value="">Empresa toda</option>
            {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="usuario">Pessoa</Rotulo>
          <Selecao id="usuario" name="usuario" defaultValue={f.usuario}>
            <option value="">Todas</option>
            {op.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="treinamento">Treinamento</Rotulo>
          <Selecao id="treinamento" name="treinamento" defaultValue={f.treinamento}>
            <option value="">Todos</option>
            {catalogo.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/treinamentos/matriz" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>
      {f.obra && <p className={styles.nota}>Com unidade selecionada: só pessoas com acesso explícito a ela.</p>}

      {m.linhas.length === 0 || m.treinamentos.length === 0 ? (
        <EstadoVazio>Nenhuma pessoa ou treinamento com estes filtros.</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col" className={styles.colPessoa}>Pessoa</th>
                <th scope="col" title="Inapto: pendência em treinamento crítico obrigatório">Aptidão</th>
                {m.treinamentos.map((t) => (
                  <th key={t.id} scope="col"><Link href={`/treinamentos/${t.id}`}>{t.nome}</Link>{t.critico && <span className={styles.sub}>crítico</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.linhas.map((l) => (
                <tr key={l.usuario.id}>
                  <th scope="row" className={styles.colPessoa}>
                    {l.usuario.nome}
                    <span className={styles.sub}>{l.usuario.setor?.nome ?? "sem setor"}{l.usuario.funcao ? ` · ${l.usuario.funcao.nome}` : ""}</span>
                  </th>
                  <td>
                    <BadgeAptidao
                      apto={l.aptidao.apto}
                      titulo={l.aptidao.pendencias.map((p) => `${nomeTreinamento.get(p.treinamentoId)}: ${ROTULO_STATUS_COMPETENCIA[p.status]}`).join("\n") || undefined}
                    />
                  </td>
                  {l.celulas.map((c) => (
                    <td key={c.treinamentoId} className={c.obrigatorio ? undefined : styles.opcional}>
                      {c.status ? (
                        <>
                          <BadgeStatusCompetencia status={c.status} rotulo={ROTULO_STATUS_COMPETENCIA[c.status]} />
                          {c.dataValidade && <span className={styles.sub}>até {formatarData(c.dataValidade)}</span>}
                          {!c.dataValidade && c.dataRealizacao && <span className={styles.sub}>em {formatarData(c.dataRealizacao)}</span>}
                        </>
                      ) : (
                        <span className={styles.vazio} title="Não obrigatório e não realizado">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
