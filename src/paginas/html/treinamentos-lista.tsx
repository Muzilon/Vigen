import Link from "next/link";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { getContexto } from "@/lib/tenant";
import { ROTULO_TIPO_TREINAMENTO } from "@/lib/treinamentos/regras";
import { listarTreinamentos, opcoesTreinamentos, podeGerenciarTreinamentos } from "@/lib/treinamentos/servico";
import { LinkBotao } from "@/paginas/html/componentes/botao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import styles from "@/paginas/css/treinamentos-lista.module.css";

/**
 * Página "Treinamentos": o catálogo (tipo, carga, validade, para quem é obrigatório, nº de sessões, última sessão)
 * e as 10 sessões realizadas mais recentes. Links para "Meus treinamentos", matriz e cadastro (quem gerencia).
 */
/** Catálogo de treinamentos e sessões realizadas recentes. */
export default async function TreinamentosLista({ searchParams }: PageProps<"/treinamentos">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Treinamentos, a página responde "404 - não encontrada".
  exigirModulo(ctx, "TREINAMENTOS");
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Lê os parâmetros do endereço: `?inativos=1` mostra também os treinamentos inativos.
  const sp = await searchParams;
  const inativos = sp.inativos === "1";
  // Busca em paralelo os treinamentos e as opções (aqui, para traduzir ids de setor em nomes).
  const [lista, op] = await Promise.all([listarTreinamentos(a, { inativos }), opcoesTreinamentos(a)]);
  // `g`: verdadeiro se o usuário pode gerenciar (mostra os botões de matriz e de novo treinamento).
  const g = podeGerenciarTreinamentos(a);
  // Dicionário id do setor → nome, para escrever "Segurança" em vez do código interno.
  const nomeSetor = new Map(op.setores.map((s) => [s.id, s.nome]));
  // Junta as sessões de todos os treinamentos, ordena da mais recente para a mais antiga e guarda as 10 primeiras.
  const sessoes = lista
    .flatMap((t) => t.sessoes.map((s) => ({ ...s, treinamento: { id: t.id, nome: t.nome } })))
    .sort((x, y) => y.dataRealizacao.getTime() - x.dataRealizacao.getTime())
    .slice(0, 10);

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <CabecalhoPagina
        titulo="Treinamentos"
        contador={lista.length}
        subtitulo="Catálogo de treinamentos (integração, NRs, reciclagens) com validade e obrigatoriedade, e as sessões realizadas."
        acoes={
          <>
            <LinkBotao href="/treinamentos/meus" variante="secundario">Meus treinamentos</LinkBotao>
            {g && <LinkBotao href="/treinamentos/matriz" variante="secundario">Matriz de competências</LinkBotao>}
            {g && <LinkBotao href="/treinamentos/novo">Novo treinamento</LinkBotao>}
          </>
        }
      />
      <p className={styles.filtro}>
        {inativos ? <Link href="/treinamentos">Ocultar inativos</Link> : <Link href="/treinamentos?inativos=1">Mostrar inativos</Link>}
      </p>

      {lista.length === 0 ? (
        <EstadoVazio>Nenhum treinamento cadastrado.</EstadoVazio>
      ) : (
        <div className={styles.quadro}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Treinamento</th>
                <th scope="col">Tipo</th>
                <th scope="col">Carga</th>
                <th scope="col">Validade</th>
                <th scope="col">Obrigatório para</th>
                <th scope="col">Sessões</th>
                <th scope="col">Última sessão</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id}>
                  <td className={styles.nome}>
                    <Link href={`/treinamentos/${t.id}`} className={styles.link}>{t.nome}</Link>
                    {!t.ativo && <span className={styles.selo}>inativo</span>}
                  </td>
                  <td>{ROTULO_TIPO_TREINAMENTO[t.tipo]}</td>
                  <td className={styles.mono}>{t.cargaHoraria ? `${t.cargaHoraria} h` : "—"}</td>
                  <td className={styles.mono}>{t.validadeMeses ? `${t.validadeMeses} meses` : "não vence"}</td>
                  <td>
                    {t.obrigatorioTodos
                      ? "Todos"
                      : t.obrigatorioSetorIds.length
                        ? t.obrigatorioSetorIds.map((id) => nomeSetor.get(id) ?? "?").join(", ")
                        : <span className={styles.fraco}>Opcional</span>}
                  </td>
                  <td className={styles.mono}>{t.sessoes.length}</td>
                  <td className={styles.mono}>{t.sessoes[0] ? formatarData(t.sessoes[0].dataRealizacao) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Cartao titulo="Sessões recentes">
        {sessoes.length === 0 ? (
          <p className={styles.fraco}>Nenhuma sessão registrada.</p>
        ) : (
          <ul className={styles.sessoes}>
            {sessoes.map((s) => (
              <li key={s.id} className={styles.sessao}>
                <span className={styles.mono}>{formatarData(s.dataRealizacao)}</span>
                <Link href={`/treinamentos/${s.treinamento.id}#sessao-${s.id}`} className={styles.link}>{s.treinamento.nome}</Link>
                <span className={styles.fraco}>{s.instrutor}{s.obra ? ` · ${s.obra.nome}` : ""} · {s._count.participacoes} presente(s)</span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
