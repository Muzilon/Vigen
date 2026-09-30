import Link from "next/link";
import { z } from "zod";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, hojeNoFuso } from "@/lib/datas";
import { enumUrl, uuidUrl } from "@/lib/filtros-url";
import { ROTULO_STATUS_INSPECAO, ROTULO_TIPO_CHECKLIST, STATUS_INSPECAO } from "@/lib/inspecoes/regras";
import { listarInspecoes, opcoesInspecoes, podeGerenciarModelos, podeRealizarInspecao } from "@/lib/inspecoes/servico";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { Botao, LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Entrada, Rotulo, Selecao } from "@/paginas/html/componentes/campo-formulario";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/inspecoes-lista.module.css";

// Regra para ler uma data da URL (AAAA-MM-DD): se vier inválida, vira "sem filtro".
const dataUrl = z
  .preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional())
  .catch(undefined)
  .transform((v) => v ?? "");

// Regra de validação dos filtros da URL (unidade, modelo, status, data inicial e final).
const esquema = z.object({
  obra: uuidUrl,
  modelo: uuidUrl,
  status: enumUrl(["EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]),
  de: dataUrl,
  ate: dataUrl,
});

/**
 * Página "Inspeções / checklists": cartões com as inspeções (código, status, modelo, unidade, data, inspetor),
 * % de conformidade, NCs e o que cada uma gerou (RNCs, itens de ação). Tem filtros e um resumo no topo.
 */
/** Lista de inspeções/checklists: filtros obra/modelo/status/data, % de conformidade e o que cada uma gerou. */
export default async function InspecoesLista({ searchParams }: PageProps<"/inspecoes">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Inspeções, a página responde "404 - não encontrada".
  exigirModulo(ctx, "INSPECOES");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Lê e valida os filtros da URL.
  const f = esquema.parse(await searchParams);
  // Busca em paralelo as inspeções (já filtradas), as opções dos filtros e o fuso horário da empresa.
  const [lista, op, fuso] = await Promise.all([
    listarInspecoes(a, { obra: f.obra || undefined, modelo: f.modelo || undefined, status: f.status || undefined, de: f.de || undefined, ate: f.ate || undefined }),
    opcoesInspecoes(a),
    fusoDaEmpresa(a),
  ]);
  // Data de hoje no fuso da empresa (para detectar inspeções paradas há dias).
  const hoje = hojeNoFuso(fuso);
  // Números do resumo do topo: quantas estão em andamento, conformidade média das concluídas e total de RNCs geradas.
  const emAndamento = lista.filter((i) => i.status === "EM_ANDAMENTO").length;
  const concluidas = lista.filter((i) => i.status === "CONCLUIDA" && i.percentualConformidade !== null);
  const media = concluidas.length ? Math.round(concluidas.reduce((s, i) => s + (i.percentualConformidade ?? 0), 0) / concluidas.length) : null;
  const rncs = lista.reduce((s, i) => s + i.rncsGeradas, 0);

  return (
    <div className={`${styles.pagina} fonteBase`}>
      <CabecalhoPagina
        titulo="Inspeções / checklists"
        contador={lista.length}
        subtitulo="Inspeções de campo por unidade. Uma resposta não conforme vira RNC ou item de ação direto da tela."
        acoes={
          <>
            {podeGerenciarModelos(a) && <LinkBotao href="/inspecoes/modelos" variante="secundario">Modelos de checklist</LinkBotao>}
            {podeRealizarInspecao(a) && <LinkBotao href="/inspecoes/nova">Nova inspeção</LinkBotao>}
          </>
        }
      />

      <div className={styles.resumo}>
        <Link href="/inspecoes?status=EM_ANDAMENTO" className={styles.indicador}><strong>{emAndamento}</strong> em andamento</Link>
        <span className={styles.indicador}><strong>{media === null ? "—" : `${media}%`}</strong> conformidade média (concluídas)</span>
        <span className={styles.indicador}><strong>{rncs}</strong> RNC(s) gerada(s)</span>
      </div>

      <form className={styles.barraFiltros} method="get">
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="obra">Unidade</Rotulo>
          <Selecao id="obra" name="obra" defaultValue={f.obra}>
            <option value="">Todas</option>
            {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="modelo">Modelo</Rotulo>
          <Selecao id="modelo" name="modelo" defaultValue={f.modelo}>
            <option value="">Todos</option>
            {op.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="status">Status</Rotulo>
          <Selecao id="status" name="status" defaultValue={f.status}>
            <option value="">Todos</option>
            {STATUS_INSPECAO.map((s) => <option key={s} value={s}>{ROTULO_STATUS_INSPECAO[s]}</option>)}
          </Selecao>
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="de">De</Rotulo>
          <Entrada id="de" name="de" type="date" defaultValue={f.de} />
        </div>
        <div className={styles.campoFiltro}>
          <Rotulo htmlFor="ate">Até</Rotulo>
          <Entrada id="ate" name="ate" type="date" defaultValue={f.ate} />
        </div>
        <div className={styles.acoesFiltro}>
          <Botao type="submit" variante="secundario">Aplicar</Botao>
          <Link href="/inspecoes" className={styles.linkLimpar}>Limpar</Link>
        </div>
      </form>

      {lista.length === 0 ? (
        <EstadoVazio>Nenhuma inspeção com estes filtros.</EstadoVazio>
      ) : (
        <ul className={styles.lista}>
          {lista.map((i) => {
            // Inspeção em andamento cuja data já passou → destaca "em aberto desde ...".
            const parada = i.status === "EM_ANDAMENTO" && i.dataInspecao.toISOString().slice(0, 10) < hoje;
            return (
              <li key={i.id} className={styles.cartao}>
                <Link href={`/inspecoes/${i.id}`} className={styles.linkCartao}>
                  <div className={styles.topo}>
                    <span className={styles.codigo}>{i.codigo}</span>
                    <span className={`${styles.status} ${styles[`status_${i.status}`]}`}>{ROTULO_STATUS_INSPECAO[i.status]}</span>
                  </div>
                  <p className={styles.nome}>{i.modelo.nome}</p>
                  <p className={styles.meta}>
                    {i.obra.nome} · {formatarData(i.dataInspecao)} · {i.inspetor.nome} · {ROTULO_TIPO_CHECKLIST[i.modelo.tipo]}
                  </p>
                  <div className={styles.numeros}>
                    <span className={styles.percentual}>{i.percentualAtual === null ? "—" : `${i.percentualAtual}%`}<small> conformidade</small></span>
                    {i.status === "EM_ANDAMENTO" && <span>{i.total - i.pendentes}/{i.total} respondidas</span>}
                    {i.naoConformes > 0 && <span className={styles.nc}>{i.naoConformes} NC</span>}
                    {i.rncsGeradas > 0 && <span>{i.rncsGeradas} RNC</span>}
                    {i.itensGerados > 0 && <span>{i.itensGerados} item(ns) de ação</span>}
                    {parada && <span className={styles.nc}>em aberto desde {formatarData(i.dataInspecao)}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
