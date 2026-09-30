import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelarAcao, decidirAcao } from "@/app/(app)/aprovacoes/actions";
import { obterFluxo } from "@/lib/aprovacao";
import { ROTULO_ENTIDADE_APROVACAO, ROTULO_MODO_APROVACAO, ROTULO_TIPO_ALTERACAO } from "@/lib/aprovacao/rotulos";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { formatarDataHora } from "@/lib/datas";
import { AprovacaoDetalheAcoes } from "@/paginas/html/aprovacao-detalhe-acoes";
import { BadgeStatusFluxo } from "@/paginas/html/componentes/badge-aprovacao";
import { CabecalhoPagina } from "@/paginas/html/componentes/cabecalho-pagina";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { PayloadAprovacao } from "@/paginas/html/componentes/payload-aprovacao";
import { TrilhaAssinaturas } from "@/paginas/html/componentes/trilha-assinaturas";
import styles from "@/paginas/css/aprovacao-detalhe.module.css";

// Formato de um id válido (UUID). Serve para recusar endereços com id inventado antes de consultar o banco.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Página de detalhe de uma aprovação: resumo (quem pediu, quando, modo, assinaturas), a alteração proposta,
 * os botões de decidir/cancelar (conforme a permissão do usuário) e a trilha de assinaturas ao lado.
 */
export default async function AprovacaoDetalhe({ params }: PageProps<"/aprovacoes/[id]">) {
  // `id`: o identificador do fluxo, tirado do endereço (/aprovacoes/ID).
  const { id } = await params;
  // Id em formato inválido → página 404.
  if (!UUID.test(id)) notFound();
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca o fluxo de aprovação; se não existe ou o usuário não pode vê-lo, vem vazio.
  const f = await obterFluxo(a, id);
  // Fluxo inexistente ou sem acesso → 404.
  if (!f) notFound();
  // Fuso horário da empresa, para mostrar as datas corretamente.
  const fuso = await fusoDaEmpresa(a);
  // Quantas assinaturas já foram aprovadas (para o resumo "2 de 3").
  const assinadas = f.etapas.filter((e) => e.status === "APROVADA").length;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <Link href="/aprovacoes" className={styles.voltar}>
        ← Aprovações
      </Link>
      <CabecalhoPagina titulo={f.resumo} contador={<BadgeStatusFluxo status={f.status} />} />

      <div className={styles.grade}>
        <div className={styles.colunaPrincipal}>
          <Cartao titulo="Resumo">
            <dl className={styles.dados}>
              <div className={styles.dado}>
                <dt>Entidade</dt>
                <dd>{ROTULO_ENTIDADE_APROVACAO[f.entidadeTipo]}</dd>
              </div>
              <div className={styles.dado}>
                <dt>Tipo de alteração</dt>
                <dd>{ROTULO_TIPO_ALTERACAO[f.tipoAlteracao]}</dd>
              </div>
              <div className={styles.dado}>
                <dt>Solicitante</dt>
                <dd>{f.solicitante.nome}</dd>
              </div>
              <div className={styles.dado}>
                <dt>Solicitado em</dt>
                <dd>{formatarDataHora(f.criadoEm, fuso)}</dd>
              </div>
              <div className={styles.dado}>
                <dt>Modo</dt>
                <dd>{ROTULO_MODO_APROVACAO[f.modo]}</dd>
              </div>
              <div className={styles.dado}>
                <dt>Assinaturas</dt>
                <dd>
                  {assinadas} de {f.etapas.length}
                </dd>
              </div>
              {f.concluidoEm && (
                <div className={styles.dado}>
                  <dt>Concluído em</dt>
                  <dd>{formatarDataHora(f.concluidoEm, fuso)}</dd>
                </div>
              )}
            </dl>
          </Cartao>

          <Cartao titulo="Alteração proposta">
            <PayloadAprovacao payload={f.payload} />
          </Cartao>

          {(f.podeDecidir || f.podeCancelar) && (
            <Cartao titulo={f.podeDecidir ? "Sua decisão" : "Solicitação"}>
              <AprovacaoDetalheAcoes
                fluxoId={f.id}
                versao={f.versao}
                podeDecidir={f.podeDecidir}
                podeCancelar={f.podeCancelar}
                decidir={decidirAcao}
                cancelar={cancelarAcao}
              />
            </Cartao>
          )}
        </div>

        <Cartao titulo="Trilha de assinaturas" className={styles.colunaLateral}>
          <TrilhaAssinaturas
            etapas={f.etapas}
            modo={f.modo}
            fuso={fuso}
            solicitante={{ nome: f.solicitante.nome, em: f.criadoEm }}
          />
          {f.status === "CANCELADO" && (
            <p className={styles.notaCancelado}>
              Cancelado pelo solicitante
              {(() => {
                const h = f.historico.find((x) => x.acao === "CANCELADO");
                return h?.comentario ? `: ${h.comentario}` : ".";
              })()}
            </p>
          )}
        </Cartao>
      </div>
    </div>
  );
}
