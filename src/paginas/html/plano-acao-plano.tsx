import Link from "next/link";
import { notFound } from "next/navigation";
import { adicionarItensPlanoAcao } from "@/app/(app)/plano-acao/actions";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { ItemAcoes } from "@/paginas/html/componentes/item-acoes";
import { ItensForm } from "@/paginas/html/componentes/tabela-5w2h";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { listarAnexos, podeEnviarAnexo } from "@/lib/anexos/servico";
import { usuariosAtivos } from "@/lib/notificacoes/destinatarios";
import { statusEfetivoItem } from "@/lib/plano-acao/status";
import { obterPlanoManual } from "@/lib/plano-acao/servico";
import { BadgeOrigem, BadgeStatusItem, BadgeStatusPlano } from "@/paginas/html/componentes/badge-status-item";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { EnvoltorioTabela, LinhaCabecalhoTabela, LinhaTabela, Tabela, Td, Th } from "@/paginas/html/componentes/tabela";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { EditarPlanoForm } from "@/paginas/html/plano-acao-plano-editar";
import styles from "@/paginas/css/plano-acao-plano.module.css";

/** Detalhe de um plano de ação avulso (sem RNC de origem). */
export default async function PlanoAcaoPlano({ params }: PageProps<"/plano-acao/planos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await getAtor();
  const plano = await obterPlanoManual(a, id);
  if (!plano) notFound();
  const fuso = await fusoDaEmpresa(a);
  const ativos = (await usuariosAtivos(a.db)).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  // "Quem": ativos com acesso à obra do plano (o serviço valida de novo).
  const usuariosQuem = ativos
    .filter((u) => !plano.obraId || u.obras === null || u.obras.includes(plano.obraId))
    .map((u) => ({ id: u.id, nome: u.nome }));
  const alvoAnexo = { tipo: "PLANO_ACAO" as const, entidadeId: plano.id };
  const [anexos, podeAnexar] = plano.visaoCompleta
    ? await Promise.all([listarAnexos(a, alvoAnexo), podeEnviarAnexo(a, alvoAnexo)])
    : [[], false];
  const ativosNoPlano = plano.itens.filter((i) => i.status !== "CANCELADO");
  const concluidos = ativosNoPlano.filter((i) => i.status === "CONCLUIDO").length;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      {/* 1. Trilha + título + selos */}
      <div>
        <nav aria-label="Trilha da página" className={styles.trilha}>
          <Link href="/plano-acao" className={styles.linkTrilha}>Plano de Ação</Link>
          <span aria-hidden="true">/</span>
          <span className={styles.trilhaAtual}>Plano avulso</span>
        </nav>
        <h1 className={styles.titulo}>{plano.titulo}</h1>
        <div className={styles.selos}>
          <BadgeOrigem>Manual</BadgeOrigem>
          <BadgeStatusPlano status={plano.statusGeral} />
          {plano.visaoCompleta && (
            <span className={styles.progresso}>
              <span className={styles.numero}>{concluidos}/{ativosNoPlano.length}</span> item(ns) concluído(s)
            </span>
          )}
        </div>
      </div>

      {/* 2. Dados do plano (+ edição do cabeçalho) */}
      <Cartao titulo="Plano de ação">
        <dl className={styles.dados}>
          <div className={styles.dadoLargo}>
            <dt>Objetivo</dt>
            <dd className={styles.textoLivre}>{plano.descricao ?? "—"}</dd>
          </div>
          <div>
            <dt>Obra / unidade</dt>
            <dd>{plano.obra?.nome ?? "Toda a empresa"}</dd>
          </div>
          <div>
            <dt>Criado por</dt>
            <dd>{plano.criadoPor.nome}</dd>
          </div>
          <div>
            <dt>Criado em</dt>
            <dd className={styles.numero}>{formatarDataHora(plano.criadoEm, fuso)}</dd>
          </div>
        </dl>
        {plano.podeGerenciar && (
          <details className={styles.edicao}>
            <summary className={styles.resumoEdicao}>Editar título / objetivo</summary>
            <EditarPlanoForm planoId={plano.id} versao={plano.versao} titulo={plano.titulo} descricao={plano.descricao ?? ""} />
          </details>
        )}
      </Cartao>

      {/* 3. Itens do plano */}
      <section aria-labelledby="t-itens" className={styles.secaoItens}>
        <h2 id="t-itens" className={styles.tituloSecao}>
          {plano.visaoCompleta ? (
            <>
              Itens <span className={styles.contagem}>· {plano.itens.length}</span>
            </>
          ) : (
            "Seus itens neste plano"
          )}
        </h2>
        <EnvoltorioTabela>
          <div className={styles.rolagemTabela}>
            <Tabela>
              <colgroup>
                <col />
                <col className={styles.colQuem} />
                <col className={styles.colQuando} />
                <col className={styles.colStatus} />
                <col className={styles.colAcoes} />
              </colgroup>
              <thead>
                <LinhaCabecalhoTabela>
                  <Th scope="col">O quê</Th>
                  <Th scope="col">Quem</Th>
                  <Th scope="col">Quando</Th>
                  <Th scope="col">Status</Th>
                  <Th scope="col">Ações</Th>
                </LinhaCabecalhoTabela>
              </thead>
              <tbody>
                {plano.itens.map((i) => {
                  const st = statusEfetivoItem(i, plano.hoje);
                  return (
                    <LinhaTabela key={i.id}>
                      <Td className={styles.celulaTopo}>
                        <Link href={`/plano-acao/${i.id}`} className={styles.linkOQue}>{i.oQue}</Link>
                        {(i.porQue || i.onde || i.como) && (
                          <div className={styles.detalheItem}>
                            {[i.porQue && `Por quê: ${i.porQue}`, i.onde && `Onde: ${i.onde}`, i.como && `Como: ${i.como}`].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {i.evidenciaConclusao && (
                          <div className={styles.evidenciaItem}>
                            Evidência ({formatarData(i.dataConclusao)}): {i.evidenciaConclusao}
                          </div>
                        )}
                        <Link href={`/plano-acao/${i.id}`} className={styles.linkThread}>Anexos e mensagens →</Link>
                      </Td>
                      <Td className={styles.celulaTopo}>{i.quem.nome}</Td>
                      <Td className={`${styles.celulaTopo} ${styles.numero}`}>{formatarData(i.quando)}</Td>
                      <Td className={styles.celulaTopo}>
                        <BadgeStatusItem status={st} />
                      </Td>
                      <Td className={styles.celulaTopo}>
                        <ItemAcoes
                          item={i}
                          hoje={plano.hoje}
                          usuarios={usuariosQuem.some((u) => u.id === i.quemId) ? usuariosQuem : [...usuariosQuem, { id: i.quemId, nome: i.quem.nome }]}
                          podeExecutar={i.quemId === a.usuarioId}
                          podeGerenciar={plano.podeGerenciar}
                        />
                      </Td>
                    </LinhaTabela>
                  );
                })}
              </tbody>
            </Tabela>
          </div>
          {plano.itens.length === 0 && <EstadoVazio>Nenhum item.</EstadoVazio>}
        </EnvoltorioTabela>
      </section>

      {/* 4. Adicionar itens (componente compartilhado ItensForm) */}
      {plano.podeGerenciar && (
        <Cartao titulo="Adicionar itens (5W2H)">
          <ItensForm acao={adicionarItensPlanoAcao} ocultos={{ planoId: plano.id }} usuarios={usuariosQuem} />
        </Cartao>
      )}

      {/* 5. Anexos do plano */}
      {plano.visaoCompleta && (
        <Cartao
          titulo={
            <>
              Anexos do plano{anexos.length > 0 && <span className={styles.contagem}> · {anexos.length}</span>}
            </>
          }
        >
          <GaleriaAnexos anexos={anexos} fuso={fuso} />
          {podeAnexar && <EnviarAnexos tipo="PLANO_ACAO" entidadeId={plano.id} />}
        </Cartao>
      )}
    </div>
  );
}
