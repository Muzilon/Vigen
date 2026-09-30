import Link from "next/link";
import { notFound } from "next/navigation";
import type { QuadranteSwot } from "@prisma/client";
import {
  editarCicloAcao,
  gerarRiscoAcao,
  removerItemAcao,
  removerParteAcao,
  salvarItemAcao,
  salvarParteAcao,
} from "@/app/(app)/swot/actions";
import { getAtor } from "@/lib/ator-servidor";
import { exigirModulo, temModulo } from "@/lib/modulos";
import { atorTem } from "@/lib/ator";
import { codigoRisco, eixosPI, ROTULO_TIPO_RISCO } from "@/lib/riscos/regras";
import { configRisco } from "@/lib/riscos/servico";
import {
  AMBIENTE_QUADRANTE,
  celulasPartes,
  estrategiaParte,
  QUADRANTES,
  ROTULO_ESTRATEGIA,
  ROTULO_QUADRANTE,
  tipoRiscoDoQuadrante,
} from "@/lib/swot/regras";
import { obterCiclo, podeGerenciarSwot } from "@/lib/swot/servico";
import { getContexto } from "@/lib/tenant";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { EstadoVazio } from "@/paginas/html/componentes/estado-vazio";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Heatmap } from "@/paginas/html/componentes/heatmap";
import styles from "@/paginas/css/swot-ciclo.module.css";

// Liga cada quadrante (Forças, Fraquezas, Oportunidades, Ameaças) à sua classe de cor do CSS.
const CLASSE_QUADRANTE: Record<QuadranteSwot, string> = {
  FORCA: styles.quadranteForca,
  FRAQUEZA: styles.quadranteFraqueza,
  OPORTUNIDADE: styles.quadranteOportunidade,
  AMEACA: styles.quadranteAmeaca,
};

// Escala de 1 a 5 usada nos eixos da matriz de partes interessadas.
const NIVEIS_15 = [1, 2, 3, 4, 5].map((v) => ({ valor: v, rotulo: String(v) }));

/**
 * Página de um ciclo SWOT com duas abas: o quadro 2×2 (itens ordenados por relevância, com opção de gerar
 * risco/oportunidade a partir de um item) e as partes interessadas (matriz influência × interesse e lista).
 * `?aba=partes` escolhe a segunda aba.
 */
/** Ciclo SWOT: quadro 2×2 (itens por relevância) e aba de partes interessadas (matriz influência × interesse). */
export default async function SwotCiclo({ params, searchParams }: PageProps<"/swot/[id]">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de SWOT, a página responde "404 - não encontrada".
  exigirModulo(ctx, "SWOT");
  // `id`: o identificador do ciclo, tirado do endereço.
  const { id } = await params;
  // Id em formato inválido → página 404.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Lê os parâmetros do endereço (a parte depois do "?" na URL).
  const sp = await searchParams;
  // Aba ativa: "partes" se pedida na URL; senão, o quadro.
  const aba = sp.aba === "partes" ? "partes" : "quadro";
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca o ciclo com itens, partes interessadas e quem o criou.
  const c = await obterCiclo(a, id);
  // Ciclo inexistente ou sem acesso → 404.
  if (!c) notFound();
  // `g`: pode editar (tem permissão e o ciclo não está encerrado).
  const g = podeGerenciarSwot(a) && !c.encerrado;
  // A empresa contratou o módulo de Riscos e Oportunidades?
  const riscosAtivos = temModulo(ctx, "RISCOS_OPORTUNIDADES");
  // Pode transformar um item do SWOT em risco/oportunidade (edita o ciclo, tem o módulo e a permissão)?
  const podeGerarRisco = g && riscosAtivos && atorTem(a, "RISCO_GERENCIAR");
  // Só quando pode gerar riscos, busca a escala de pontuação e a lista de processos para o formulário.
  const [config, processos] = podeGerarRisco
    ? await Promise.all([
        configRisco(a.db, null),
        a.db.processo.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: [{ tipo: "asc" }, { ordem: "asc" }] }),
      ])
    : [null, []];

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}>
        <Link href="/swot" className={styles.linkVoltar}>← SWOT</Link>
      </nav>

      <header className={styles.cabecalho}>
        <div>
          <p className={styles.ano}>Ciclo {c.ano}</p>
          <h1 className={styles.titulo}>{c.titulo}</h1>
          <p className={styles.meta}>
            {c.itens.length} itens · {c.partesInteressadas.length} partes interessadas · criado por {c.criadoPor.nome}
            {c.encerrado && <span className={styles.encerrado}>Encerrado</span>}
          </p>
        </div>
        {podeGerenciarSwot(a) && (
          <FormAcao
            acao={editarCicloAcao}
            botao={c.encerrado ? "Reabrir ciclo" : "Encerrar ciclo"}
            variante="secundario"
            tamanho="pequeno"
            confirmar={c.encerrado ? undefined : "Encerrar o ciclo? Ele fica somente leitura até ser reaberto."}
          >
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="encerrado" value={c.encerrado ? "false" : "true"} />
          </FormAcao>
        )}
      </header>

      <nav className={styles.abas} aria-label="Visualização">
        <Link href={`/swot/${c.id}`} className={aba === "quadro" ? styles.abaAtiva : styles.aba} aria-current={aba === "quadro" ? "page" : undefined}>
          Quadro SWOT
        </Link>
        <Link href={`/swot/${c.id}?aba=partes`} className={aba === "partes" ? styles.abaAtiva : styles.aba} aria-current={aba === "partes" ? "page" : undefined}>
          Partes interessadas
        </Link>
      </nav>

      {aba === "quadro" ? (
        <div className={styles.quadro}>
          {QUADRANTES.map((q) => {
            const itens = c.itens.filter((i) => i.quadrante === q);
            return (
              <section key={q} className={`${styles.quadrante} ${CLASSE_QUADRANTE[q]}`} aria-label={ROTULO_QUADRANTE[q]}>
                <h2 className={styles.tituloQuadrante}>
                  {ROTULO_QUADRANTE[q]} <span className={styles.ambiente}>{AMBIENTE_QUADRANTE[q]}</span>
                  <span className={styles.contagem}>{itens.length}</span>
                </h2>
                {itens.length === 0 ? (
                  <p className={styles.vazio}>Nenhum item.</p>
                ) : (
                  <ol className={styles.itens}>
                    {itens.map((i) => (
                      <li key={i.id} className={styles.item}>
                        <div className={styles.linhaItem}>
                          <span className={styles.relevancia} title={`Relevância ${i.relevancia} de 5`} aria-label={`Relevância ${i.relevancia} de 5`}>
                            {i.relevancia}
                          </span>
                          <span className={styles.descricao}>{i.descricao}</span>
                          {i.riscoOportunidade && i.riscoOportunidade.ativo && (
                            <Link href={`/riscos/${i.riscoOportunidade.id}`} className={styles.vinculo}>
                              {codigoRisco(i.riscoOportunidade)} <BadgeFaixa faixa={i.riscoOportunidade.faixa} />
                            </Link>
                          )}
                        </div>
                        {g && (
                          <div className={styles.acoesItem}>
                            <details>
                              <summary>Editar</summary>
                              <FormAcao acao={salvarItemAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
                                <input type="hidden" name="id" value={i.id} />
                                <input type="hidden" name="cicloId" value={c.id} />
                                <CamposItem quadrante={q} descricao={i.descricao} relevancia={i.relevancia} />
                              </FormAcao>
                            </details>
                            {podeGerarRisco && config && !i.riscoOportunidade && (
                              <details>
                                <summary>Gerar {ROTULO_TIPO_RISCO[tipoRiscoDoQuadrante(q)].toLowerCase()}</summary>
                                <FormAcao acao={gerarRiscoAcao} botao={`Criar ${ROTULO_TIPO_RISCO[tipoRiscoDoQuadrante(q)].toLowerCase()}`} tamanho="pequeno" className={styles.formulario}>
                                  <input type="hidden" name="id" value={i.id} />
                                  <input type="hidden" name="cicloId" value={c.id} />
                                  <label className={styles.campoLargo}>
                                    Descrição <textarea name="descricao" defaultValue={i.descricao} rows={2} required className={styles.entrada} />
                                  </label>
                                  <label className={styles.campoLargo}>
                                    Processo
                                    <select name="processoId" defaultValue="" className={styles.entrada}>
                                      <option value="">— sem processo —</option>
                                      {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
                                    </select>
                                  </label>
                                  <label className={styles.campo}>
                                    {eixosPI(config).eixoP.rotulo}
                                    <select name="probabilidade" defaultValue={Math.min(3, i.relevancia)} className={styles.entrada}>
                                      {eixosPI(config).eixoP.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
                                    </select>
                                  </label>
                                  <label className={styles.campo}>
                                    {eixosPI(config).eixoI.rotulo}
                                    <select name="impacto" defaultValue={i.relevancia} className={styles.entrada}>
                                      {eixosPI(config).eixoI.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
                                    </select>
                                  </label>
                                </FormAcao>
                              </details>
                            )}
                            <FormAcao acao={removerItemAcao} botao="Remover" variante="texto" tamanho="pequeno" confirmar="Remover este item?">
                              <input type="hidden" name="id" value={i.id} />
                              <input type="hidden" name="cicloId" value={c.id} />
                            </FormAcao>
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {g && (
                  <details className={styles.adicionar}>
                    <summary>+ Adicionar {ROTULO_QUADRANTE[q].toLowerCase().replace(/s$/, "")}</summary>
                    <FormAcao acao={salvarItemAcao} botao="Adicionar" tamanho="pequeno" className={styles.formulario}>
                      <input type="hidden" name="cicloId" value={c.id} />
                      <CamposItem quadrante={q} descricao="" relevancia={3} />
                    </FormAcao>
                  </details>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className={styles.grade}>
          <Cartao titulo="Matriz influência × interesse">
            <Heatmap
              titulo="Partes interessadas"
              eixoLinha={{ rotulo: "Influência", valores: NIVEIS_15 }}
              eixoColuna={{ rotulo: "Interesse", valores: NIVEIS_15 }}
              celulas={celulasPartes(c.partesInteressadas)}
              legenda={[
                { cor: "baixa", rotulo: "Monitorar" },
                { cor: "media", rotulo: "Manter informada/satisfeita" },
                { cor: "alta", rotulo: "Atenção" },
                { cor: "critica", rotulo: "Gerenciar de perto" },
              ]}
            />
          </Cartao>
          <Cartao titulo={`Partes interessadas · ${c.partesInteressadas.length}`}>
            {c.partesInteressadas.length === 0 ? (
              <EstadoVazio>Nenhuma parte interessada.</EstadoVazio>
            ) : (
              <ul className={styles.partes}>
                {c.partesInteressadas.map((p) => (
                  <li key={p.id} className={styles.parte}>
                    <div className={styles.cabecalhoParte}>
                      <strong>{p.nome}</strong>
                      <span className={styles.estrategia}>{ROTULO_ESTRATEGIA[estrategiaParte(p.influencia, p.interesse)]}</span>
                      <span className={styles.notas}>Influência {p.influencia} · Interesse {p.interesse}</span>
                    </div>
                    {p.necessidades && <p className={styles.textoParte}><span>Necessidades:</span> {p.necessidades}</p>}
                    {p.expectativas && <p className={styles.textoParte}><span>Expectativas:</span> {p.expectativas}</p>}
                    {g && (
                      <div className={styles.acoesItem}>
                        <details>
                          <summary>Editar</summary>
                          <FormAcao acao={salvarParteAcao} botao="Salvar" tamanho="pequeno" className={styles.formulario}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="cicloId" value={c.id} />
                            <CamposParte p={p} />
                          </FormAcao>
                        </details>
                        <FormAcao acao={removerParteAcao} botao="Remover" variante="texto" tamanho="pequeno" confirmar={`Remover ${p.nome}?`}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="cicloId" value={c.id} />
                        </FormAcao>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {g && (
              <details className={styles.adicionar}>
                <summary>+ Adicionar parte interessada</summary>
                <FormAcao acao={salvarParteAcao} botao="Adicionar" tamanho="pequeno" className={styles.formulario}>
                  <input type="hidden" name="cicloId" value={c.id} />
                  <CamposParte />
                </FormAcao>
              </details>
            )}
          </Cartao>
        </div>
      )}
    </div>
  );
}

/** Campos do formulário de um item do SWOT (descrição, quadrante e relevância), usados para adicionar e editar. */
function CamposItem({ quadrante, descricao, relevancia }: { quadrante: QuadranteSwot; descricao: string; relevancia: number }) {
  return (
    <>
      <label className={styles.campoLargo}>
        Descrição <textarea name="descricao" defaultValue={descricao} rows={2} required minLength={2} maxLength={1000} className={styles.entrada} />
      </label>
      <label className={styles.campo}>
        Quadrante
        <select name="quadrante" defaultValue={quadrante} className={styles.entrada}>
          {QUADRANTES.map((q) => <option key={q} value={q}>{ROTULO_QUADRANTE[q]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        Relevância (1–5)
        <select name="relevancia" defaultValue={relevancia} className={styles.entrada}>
          {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
    </>
  );
}

/** Campos do formulário de uma parte interessada (nome, necessidades, expectativas, influência e interesse). Sem `p`, é uma nova. */
function CamposParte({ p }: { p?: { nome: string; necessidades: string | null; expectativas: string | null; influencia: number; interesse: number } }) {
  return (
    <>
      <label className={styles.campoLargo}>
        Nome <input name="nome" defaultValue={p?.nome} required minLength={2} maxLength={150} className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>
        Necessidades <textarea name="necessidades" defaultValue={p?.necessidades ?? ""} rows={2} className={styles.entrada} />
      </label>
      <label className={styles.campoLargo}>
        Expectativas <textarea name="expectativas" defaultValue={p?.expectativas ?? ""} rows={2} className={styles.entrada} />
      </label>
      <label className={styles.campo}>
        Influência (1–5)
        <select name="influencia" defaultValue={p?.influencia ?? 3} className={styles.entrada}>
          {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        Interesse (1–5)
        <select name="interesse" defaultValue={p?.interesse ?? 3} className={styles.entrada}>
          {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
    </>
  );
}
