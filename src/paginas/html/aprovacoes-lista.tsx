import Link from "next/link";
import type { StatusFluxoAprovacao } from "@prisma/client";
import { contarAguardandoMim, listarAguardandoMim, listarSolicitadasPorMim, type FluxoResumo } from "@/lib/aprovacao";
import { ROTULO_ENTIDADE_APROVACAO, ROTULO_MODO_APROVACAO, ROTULO_STATUS_FLUXO, ROTULO_TIPO_ALTERACAO, STATUS_FLUXO } from "@/lib/aprovacao/rotulos";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { BadgeStatusFluxo } from "@/paginas/html/componentes/badge-aprovacao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { EnvoltorioTabela, LinhaCabecalhoTabela, LinhaTabela, Tabela, Td, Th } from "@/paginas/html/componentes/tabela";
import styles from "@/paginas/css/aprovacoes-lista.module.css";

/**
 * Página "Aprovações": duas abas — "Aguardando mim" (o que espera a sua assinatura) e "Solicitadas por mim"
 * (com filtro por status). Mostra uma tabela com resumo, entidade, tipo de alteração, solicitante, modo, progresso e data.
 */
export default async function AprovacoesLista({ searchParams }: PageProps<"/aprovacoes">) {
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Verdadeiro se a aba "Solicitadas por mim" está aberta (`?aba=solicitadas`).
  const abaSolicitadas = sp.aba === "solicitadas";
  // Filtro de status vindo da URL, aceito só se for um status conhecido (senão vira "sem filtro").
  const statusParam = typeof sp.status === "string" ? sp.status : "";
  const status = (STATUS_FLUXO as string[]).includes(statusParam) ? (statusParam as StatusFluxoAprovacao) : null;

  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca em paralelo: fuso horário, quantas aprovações aguardam o usuário e a lista da aba atual.
  const [fuso, pendentes, lista] = await Promise.all([
    fusoDaEmpresa(a),
    contarAguardandoMim(a),
    abaSolicitadas ? listarSolicitadasPorMim(a, status ? { status: [status] } : {}) : listarAguardandoMim(a),
  ]);
  // Monta as classes de CSS de uma aba, destacando a que está ativa.
  const aba = (ativo: boolean) => `${styles.aba} ${ativo ? styles.abaAtiva : ""}`;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina titulo="Aprovações" subtitulo="Pedidos de alteração que exigem assinatura de aprovadores." />

      <nav className={styles.abas} aria-label="Visão das aprovações">
        <Link href="/aprovacoes" className={aba(!abaSolicitadas)} aria-current={!abaSolicitadas ? "page" : undefined}>
          Aguardando mim
          <span className={styles.contadorAba} aria-label={`${pendentes} pendente(s)`}>
            {pendentes}
          </span>
        </Link>
        <Link href="/aprovacoes?aba=solicitadas" className={aba(abaSolicitadas)} aria-current={abaSolicitadas ? "page" : undefined}>
          Solicitadas por mim
        </Link>
      </nav>

      {abaSolicitadas && (
        <form className={styles.filtros} method="get" action="/aprovacoes">
          <input type="hidden" name="aba" value="solicitadas" />
          <label htmlFor="filtro-status" className={styles.rotuloFiltro}>
            Status
          </label>
          <select id="filtro-status" name="status" defaultValue={status ?? ""} className={styles.selecao}>
            <option value="">Todos</option>
            {STATUS_FLUXO.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_FLUXO[s]}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.botaoFiltrar}>
            Filtrar
          </button>
        </form>
      )}

      {lista.length === 0 ? (
        <div className={styles.painelVazio}>
          <EstadoVazio>{abaSolicitadas ? "Nenhuma solicitação encontrada." : "Nada aguardando sua assinatura."}</EstadoVazio>
        </div>
      ) : (
        <EnvoltorioTabela>
          <Tabela className={styles.tabela}>
            <colgroup>
              <col />
              <col className={styles.colEntidade} />
              <col className={styles.colTipo} />
              <col className={styles.colSolicitante} />
              <col className={styles.colModo} />
              <col className={styles.colProgresso} />
              <col className={styles.colData} />
            </colgroup>
            <thead>
              <LinhaCabecalhoTabela>
                <Th>Resumo</Th>
                <Th>Entidade</Th>
                <Th>Alteração</Th>
                <Th>Solicitante</Th>
                <Th>Modo</Th>
                <Th>Assinaturas</Th>
                <Th>Data</Th>
              </LinhaCabecalhoTabela>
            </thead>
            <tbody>
              {lista.map((f) => (
                <Linha key={f.id} f={f} fuso={fuso} />
              ))}
            </tbody>
          </Tabela>
        </EnvoltorioTabela>
      )}
    </div>
  );
}

/** Uma linha da tabela: resumo (link para o detalhe) com o status, entidade, alteração, solicitante, modo, progresso e data. */
function Linha({ f, fuso }: { f: FluxoResumo; fuso: string }) {
  // Quantas assinaturas já foram aprovadas, para mostrar "1 de 3".
  const assinadas = f.etapas.filter((e) => e.status === "APROVADA").length;
  return (
    <LinhaTabela>
      <Td variante="truncado">
        <div className={styles.celulaResumo}>
          <Link href={`/aprovacoes/${f.id}`} className={styles.linkResumo} title={f.resumo}>
            {f.resumo}
          </Link>
          <BadgeStatusFluxo status={f.status} />
        </div>
      </Td>
      <Td variante="secundario">{ROTULO_ENTIDADE_APROVACAO[f.entidadeTipo]}</Td>
      <Td variante="secundario">{ROTULO_TIPO_ALTERACAO[f.tipoAlteracao]}</Td>
      <Td variante="truncado">{f.solicitante.nome}</Td>
      <Td variante="secundario">{ROTULO_MODO_APROVACAO[f.modo]}</Td>
      <Td variante="mono">
        {assinadas} de {f.etapas.length}
      </Td>
      <Td variante="secundario">{formatarDataHora(f.criadoEm, fuso)}</Td>
    </LinhaTabela>
  );
}
