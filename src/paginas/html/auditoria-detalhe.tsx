import Link from "next/link";
import { notFound } from "next/navigation";
import {
  abrirRncConstatacaoAcao,
  editarAuditoriaAcao,
  itemAuditoriaAcao,
  mudarStatusAcao,
  registrarConstatacaoAcao,
  removerConstatacaoAcao,
} from "@/app/(app)/auditorias/actions";
import { listarAnexosDe } from "@/lib/anexos/servico";
import { fusoDaEmpresa } from "@/lib/ator";
import { getAtor } from "@/lib/ator-servidor";
import { contarPorTipo, permitido, ROTULO_STATUS_AUDITORIA, ROTULO_TIPO_AUDITORIA, ROTULO_TIPO_CONSTATACAO, TIPOS_CONSTATACAO } from "@/lib/auditorias/regras";
import { obterAuditoria, opcoesAuditorias, podeExecutarAuditoria, podeGerenciarAuditorias, sugestaoRncConstatacao } from "@/lib/auditorias/servico";
import { dataIso, formatarData, formatarDataHora } from "@/lib/datas";
import { exigirModulo } from "@/lib/modulos";
import { ROTULO_GRAVIDADE, ROTULO_STATUS_RNC, ROTULO_TIPO } from "@/lib/rnc/rotulos";
import { getContexto } from "@/lib/tenant";
import { EnviarAnexos, GaleriaAnexos } from "@/paginas/html/componentes/anexos";
import { Cartao } from "@/paginas/html/componentes/cartao";
import { FormAcao } from "@/paginas/html/componentes/form-acao";
import { Interacoes } from "@/paginas/html/componentes/interacoes";
import { CamposAuditoria } from "@/paginas/html/auditoria-formulario";
import styles from "@/paginas/css/auditoria-detalhe.module.css";

/**
 * Página de detalhe da auditoria: dados gerais, plano (itens reordenáveis), constatações com evidências e botão
 * de abrir RNC (nas não conformidades), conclusão/cancelamento e comentários. O que aparece depende do status da
 * auditoria e das permissões do usuário (gerenciar ou executar).
 */
/** Detalhe da auditoria: dados, status, plano (itens), constatações com evidências e RNC, conclusão e comentários. */
export default async function AuditoriaDetalhe({ params }: PageProps<"/auditorias/[id]">) {
  // Descobre quem está logado: usuário, empresa, permissões e módulos contratados.
  const ctx = await getContexto();
  // Se a empresa não contratou o módulo de Auditorias, a página responde "404 - não encontrada".
  exigirModulo(ctx, "AUDITORIAS");
  // `id`: o identificador da auditoria, tirado do endereço.
  const { id } = await params;
  // Id em formato inválido → página 404.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // `a` (o "ator") é quem faz a operação; os serviços usam ele para ler só os dados desta empresa.
  const a = await getAtor();
  // Busca a auditoria com plano, constatações e dados de quem a criou.
  const au = await obterAuditoria(a, id);
  // Auditoria inexistente → 404.
  if (!au) notFound();
  // Busca em paralelo as opções (unidades, pessoas, programas...), o fuso horário e os anexos de evidência de cada constatação.
  const [op, fuso, anexos] = await Promise.all([opcoesAuditorias(a), fusoDaEmpresa(a), listarAnexosDe(a, "CONSTATACAO_AUDITORIA", au.constatacoes.map((c) => c.id))]);
  // `g`: verdadeiro se o usuário pode gerenciar (editar dados, cancelar).
  const g = podeGerenciarAuditorias(a);
  // `ex`: verdadeiro se o usuário executa esta auditoria (é o auditor líder ou gerencia).
  const ex = podeExecutarAuditoria(a, au);
  // Três permissões que dependem do status da auditoria: editar o plano, registrar constatações e abrir RNC.
  const plano = ex && permitido(au.status, "EDITAR_PLANO");
  const constatar = ex && permitido(au.status, "CONSTATAR");
  const rnc = ex && permitido(au.status, "GERAR_RNC");
  // Contagem de constatações por tipo (NC, observação, oportunidade, ponto forte) para o resumo do topo.
  const cont = contarPorTipo(au.constatacoes);
  // Atalho para criar um campo escondido (<input type="hidden">) que leva um valor junto com o formulário.
  const hid = (n: string, v: string | number) => <input type="hidden" name={n} value={v} />;

  return (
    <div className={`${styles.pagina} fonteIbmPlex`}>
      <nav aria-label="Trilha da página" className={styles.trilha}><Link href="/auditorias">← Auditorias</Link></nav>
      <header className={styles.cabecalho}>
        <div>
          <p className={styles.codigo}>{au.codigo} · {ROTULO_TIPO_AUDITORIA[au.tipo]}{au.programa ? ` · Programa ${au.programa.ano}` : ""}</p>
          <h1 className={styles.titulo}>{au.norma}</h1>
          <p className={styles.meta}>
            <span className={`${styles.status} ${styles[`status_${au.status}`]}`}>{ROTULO_STATUS_AUDITORIA[au.status]}</span>
            <span>{formatarData(au.dataInicio)} a {formatarData(au.dataFim)}</span>
            <span>Auditor líder: {au.auditorLider.nome}</span>
            {au.obra && <span>{au.obra.nome}</span>}
            {au.processo && <Link href={`/processos/${au.processo.id}`}>{au.processo.codigo}</Link>}
          </p>
        </div>
        <div className={styles.acoesCabecalho}>
          {ex && permitido(au.status, "INICIAR") && (
            <FormAcao acao={mudarStatusAcao} botao="Iniciar execução" tamanho="pequeno">{hid("id", au.id)}{hid("versao", au.versao)}{hid("acao", "iniciar")}</FormAcao>
          )}
        </div>
      </header>

      <div className={styles.resumo}>
        <span className={`${styles.indicador} ${cont.NAO_CONFORMIDADE ? styles.indicadorNc : ""}`}><strong>{cont.NAO_CONFORMIDADE}</strong> não conformidade(s)</span>
        <span className={styles.indicador}><strong>{cont.OBSERVACAO}</strong> observação(ões)</span>
        <span className={styles.indicador}><strong>{cont.OPORTUNIDADE_MELHORIA}</strong> oportunidade(s) de melhoria</span>
        <span className={styles.indicador}><strong>{cont.PONTO_FORTE}</strong> ponto(s) forte(s)</span>
      </div>

      <div className={styles.grade}>
        <div className={styles.coluna}>
          <Cartao titulo={`Plano da auditoria · ${au.itens.length}`}>
            {au.itens.length === 0 ? <p className={styles.vazio}>Nenhum item no plano.</p> : (
              <ol className={styles.itens}>
                {au.itens.map((it) => (
                  <li key={it.id} className={styles.item}>
                    <div className={styles.linhaItem}>
                      <span className={styles.ordem}>{it.ordem}</span>
                      <div className={styles.textoItem}>
                        <strong>{it.requisito}</strong>
                        {it.pergunta && <span>{it.pergunta}</span>}
                        <span className={styles.sub}>{au.constatacoes.filter((c) => c.itemAuditoriaId === it.id).length} constatação(ões)</span>
                      </div>
                      {plano && (
                        <div className={styles.botoes}>
                          {(["cima", "baixo"] as const).map((d) => (
                            <FormAcao key={d} acao={itemAuditoriaAcao} botao={d === "cima" ? "↑" : "↓"} variante="texto" tamanho="pequeno">
                              {hid("auditoriaId", au.id)}{hid("itemId", it.id)}{hid("op", d)}
                            </FormAcao>
                          ))}
                        </div>
                      )}
                    </div>
                    {plano && (
                      <details className={styles.detalhes}>
                        <summary>Editar item</summary>
                        <FormAcao acao={itemAuditoriaAcao} botao="Salvar" tamanho="pequeno" className={styles.form}>
                          {hid("auditoriaId", au.id)}{hid("itemId", it.id)}{hid("op", "editar")}
                          <input name="requisito" required defaultValue={it.requisito} aria-label="Requisito" className={styles.entrada} />
                          <input name="pergunta" defaultValue={it.pergunta ?? ""} aria-label="Pergunta" className={styles.entrada} />
                        </FormAcao>
                        <FormAcao acao={itemAuditoriaAcao} botao="Remover item" variante="perigo" tamanho="pequeno" confirmar="Remover este item do plano?">
                          {hid("auditoriaId", au.id)}{hid("itemId", it.id)}{hid("op", "remover")}
                        </FormAcao>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {plano && (
              <FormAcao acao={itemAuditoriaAcao} botao="Adicionar item" tamanho="pequeno" className={styles.form}>
                {hid("auditoriaId", au.id)}{hid("op", "adicionar")}
                <input name="requisito" required placeholder="Requisito / cláusula (ex.: 7.5.3)" aria-label="Requisito" className={styles.entrada} />
                <input name="pergunta" placeholder="Pergunta / critério (opcional)" aria-label="Pergunta" className={styles.entrada} />
              </FormAcao>
            )}
          </Cartao>

          <Cartao titulo={`Constatações · ${au.constatacoes.length}`}>
            {au.constatacoes.length === 0 ? <p className={styles.vazio}>{au.status === "PLANEJADA" ? "Inicie a execução para registrar constatações." : "Nenhuma constatação."}</p> : (
              <ul className={styles.constatacoes}>
                {au.constatacoes.map((c) => {
                  // Sugestão de título, descrição e tipo para a RNC que pode nascer desta constatação.
                  const sug = sugestaoRncConstatacao(au, c);
                  // Anexos de evidência desta constatação.
                  const ev = anexos.get(c.id) ?? [];
                  return (
                    <li key={c.id} className={`${styles.constatacao} ${c.tipo === "NAO_CONFORMIDADE" ? styles.constatacaoNc : ""}`}>
                      <div className={styles.linhaItem}>
                        <span className={`${styles.tipo} ${styles[`tipo_${c.tipo}`]}`}>{ROTULO_TIPO_CONSTATACAO[c.tipo]}</span>
                        {c.itemAuditoria && <span className={styles.sub}>Item {c.itemAuditoria.ordem} · {c.itemAuditoria.requisito}</span>}
                      </div>
                      <p className={styles.texto}>{c.descricao}</p>
                      {c.evidencia && <p className={styles.sub}>Evidência: {c.evidencia}</p>}
                      <p className={styles.sub}>{c.criadoPor.nome} · {formatarDataHora(c.criadoEm, fuso)}</p>
                      {ev.length > 0 && <GaleriaAnexos anexos={ev} fuso={fuso} />}
                      {constatar && <EnviarAnexos tipo="CONSTATACAO_AUDITORIA" entidadeId={c.id} rotulo="Evidências (fotos/arquivos)" />}
                      {c.geradaRnc ? (
                        <p className={styles.gerado}>RNC <Link href={`/rncs/${c.geradaRnc.id}`}>{c.geradaRnc.codigo}</Link> · {ROTULO_STATUS_RNC[c.geradaRnc.status]}</p>
                      ) : (
                        c.tipo === "NAO_CONFORMIDADE" && rnc && (
                          <details className={styles.detalhes}>
                            <summary>Abrir RNC</summary>
                            <FormAcao acao={abrirRncConstatacaoAcao} botao="Abrir RNC" tamanho="pequeno" className={styles.form}>
                              {hid("auditoriaId", au.id)}{hid("id", c.id)}
                              <label className={styles.campo}>Título<input name="titulo" defaultValue={sug.titulo} maxLength={200} className={styles.entrada} /></label>
                              <label className={styles.campo}>Descrição<textarea name="descricao" rows={4} defaultValue={sug.descricao} className={styles.entrada} /></label>
                              <div className={styles.linhaCampos}>
                                <label className={styles.campo}>Tipo
                                  <select name="tipo" defaultValue={sug.tipo} className={styles.entrada}>
                                    {(["QUALIDADE", "SSO", "MEIO_AMBIENTE"] as const).map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
                                  </select>
                                </label>
                                <label className={styles.campo}>Gravidade
                                  <select name="gravidade" defaultValue="MEDIA" className={styles.entrada}>
                                    {(["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const).map((x) => <option key={x} value={x}>{ROTULO_GRAVIDADE[x]}</option>)}
                                  </select>
                                </label>
                                {!au.obraId && (
                                  <label className={styles.campo}>Unidade
                                    <select name="obraId" required defaultValue="" className={styles.entrada}>
                                      <option value="">Selecione…</option>
                                      {op.obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                                    </select>
                                  </label>
                                )}
                                <label className={styles.campo}>Responsável
                                  <select name="responsavelId" defaultValue="" className={styles.entrada}>
                                    <option value="">— definir depois —</option>
                                    {op.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                  </select>
                                </label>
                              </div>
                              <p className={styles.sub}>Origem: {sug.origem === "AUDITORIA_INTERNA" ? "Auditoria interna" : "Auditoria externa"}{ev.length ? ` · ${ev.length} evidência(s) anexada(s) à RNC` : ""}.</p>
                            </FormAcao>
                          </details>
                        )
                      )}
                      {constatar && !c.geradaRnc && (
                        <FormAcao acao={removerConstatacaoAcao} botao="Remover" variante="texto" tamanho="pequeno" confirmar="Remover esta constatação?">
                          {hid("auditoriaId", au.id)}{hid("id", c.id)}
                        </FormAcao>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {constatar && (
              <>
                <h3 className={styles.subtitulo}>Registrar constatação</h3>
                <FormAcao acao={registrarConstatacaoAcao} botao="Registrar" tamanho="pequeno" className={styles.form}>
                  {hid("auditoriaId", au.id)}
                  <div className={styles.linhaCampos}>
                    <label className={styles.campo}>Tipo
                      <select name="tipo" defaultValue="NAO_CONFORMIDADE" className={styles.entrada}>
                        {TIPOS_CONSTATACAO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_CONSTATACAO[t]}</option>)}
                      </select>
                    </label>
                    <label className={styles.campo}>Item do plano
                      <select name="itemAuditoriaId" defaultValue="" className={styles.entrada}>
                        <option value="">— geral —</option>
                        {au.itens.map((it) => <option key={it.id} value={it.id}>{it.ordem}. {it.requisito}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className={styles.campo}>Descrição<textarea name="descricao" required rows={3} maxLength={4000} className={styles.entrada} /></label>
                  <label className={styles.campo}>Evidência (texto)<textarea name="evidencia" rows={2} maxLength={4000} className={styles.entrada} /></label>
                </FormAcao>
              </>
            )}
          </Cartao>
        </div>

        <div className={styles.coluna}>
          <Cartao titulo="Dados">
            <dl className={styles.dados}>
              <dt>Escopo</dt><dd>{au.escopo}</dd>
              <dt>Equipe</dt><dd>{au.equipe ?? "—"}</dd>
              <dt>Planejada por</dt><dd>{au.criadoPor.nome}</dd>
              {au.conclusao && (<><dt>Conclusão</dt><dd>{au.conclusao}</dd></>)}
              {au.concluidaEm && (<><dt>Concluída em</dt><dd>{formatarDataHora(au.concluidaEm, fuso)}</dd></>)}
            </dl>
            {g && plano && (
              <details className={styles.detalhes}>
                <summary>Editar dados</summary>
                <FormAcao acao={editarAuditoriaAcao} botao="Salvar" tamanho="pequeno" className={styles.form}>
                  {hid("id", au.id)}{hid("versao", au.versao)}
                  <CamposAuditoria
                    v={{ ...au, programaId: au.programaId ?? "", processoId: au.processoId ?? "", obraId: au.obraId ?? "", equipe: au.equipe ?? "", dataInicio: dataIso(au.dataInicio), dataFim: dataIso(au.dataFim) }}
                    programas={op.programas}
                    obras={op.obras}
                    processos={op.processos}
                    usuarios={op.usuarios}
                  />
                </FormAcao>
              </details>
            )}
          </Cartao>

          {ex && permitido(au.status, "CONCLUIR") && (
            <Cartao titulo="Concluir auditoria">
              <FormAcao acao={mudarStatusAcao} botao="Concluir" tamanho="pequeno" className={styles.form}>
                {hid("id", au.id)}{hid("versao", au.versao)}{hid("acao", "concluir")}
                <textarea name="texto" required rows={3} placeholder="Conclusão / parecer do auditor" aria-label="Conclusão" className={styles.entrada} />
              </FormAcao>
            </Cartao>
          )}
          {g && permitido(au.status, "CANCELAR") && (
            <details className={styles.detalhes}>
              <summary>Cancelar auditoria</summary>
              <FormAcao acao={mudarStatusAcao} botao="Cancelar auditoria" variante="perigo" tamanho="pequeno" className={styles.form} confirmar="Cancelar esta auditoria?">
                {hid("id", au.id)}{hid("versao", au.versao)}{hid("acao", "cancelar")}
                <input name="texto" required placeholder="Motivo" aria-label="Motivo" className={styles.entrada} />
              </FormAcao>
            </details>
          )}

          <Interacoes a={a} tipo="AUDITORIA" entidadeId={au.id} usuarios={op.usuarios} fuso={fuso} />
        </div>
      </div>
    </div>
  );
}
