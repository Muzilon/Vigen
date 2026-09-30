"use client";

import Link from "next/link";
import { Fragment, useRef, useState, useTransition } from "react";
import type { TipoProcesso } from "@prisma/client";
import { definirAtivoAcao, moverProcessoAcao, salvarProcessoAcao } from "@/app/(app)/processos/actions";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/processos-planilha.module.css";

/** Os dados de um processo como a planilha precisa (já com nome do dono e listas de indicadores prontos). */
export interface LinhaProcesso {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoProcesso;
  ativo: boolean;
  revisao: number;
  versao: number;
  donoId: string | null;
  donoNome: string | null;
  entradas: string;
  saidas: string;
  fornecedores: string;
  clientes: string;
  indicadores: string[];
}

// Formato de uma server action de formulário (recebe o estado anterior e o FormData, devolve o resultado).
type Acao = (prev: ResultadoAcao, fd: FormData) => Promise<ResultadoAcao>;

// Os três tipos de processo (raias) com o nome longo e o curto, na ordem em que aparecem.
const TIPOS: { tipo: TipoProcesso; rotulo: string; curto: string }[] = [
  { tipo: "GESTAO", rotulo: "Processos de gestão", curto: "Gestão" },
  { tipo: "FINALISTICO", rotulo: "Processos finalísticos", curto: "Finalístico" },
  { tipo: "APOIO", rotulo: "Processos de apoio", curto: "Apoio" },
];

// Número de colunas da tabela (usado para as linhas de título ocuparem a largura toda).
const COLUNAS = 11;

/**
 * A planilha de processos: uma raia (grupo de linhas) por tipo. Cada linha pode ser editada ali mesmo,
 * movida para cima/baixo, reativada (se inativa) e novas linhas podem ser adicionadas.
 * `podeGerenciar` liga os botões de edição.
 */
/** Planilha editável: uma raia por tipo, edição inline por linha, ↑↓ e mover de tipo. */
export function PlanilhaProcessos({
  linhas,
  usuarios,
  podeGerenciar,
}: {
  linhas: LinhaProcesso[];
  usuarios: { id: string; nome: string }[];
  podeGerenciar: boolean;
}) {
  // Lista das linhas novas em preenchimento (uma entrada por clique em "+ Adicionar linha"); a tela se redesenha quando muda.
  const [novos, setNovos] = useState<TipoProcesso[]>([]);
  // Processos inativos, mostrados numa raia à parte no fim.
  const inativas = linhas.filter((l) => !l.ativo);
  return (
    <div className={styles.envoltorio}>
      <table className={styles.planilha}>
        <thead>
          <tr>
            <th className={styles.colOrdem} aria-label="Ordem" />
            <th className={styles.colCodigo}>Código</th>
            <th className={styles.colNome}>Nome</th>
            <th className={styles.colTipo}>Tipo</th>
            <th className={styles.colDono}>Dono</th>
            <th>Entradas</th>
            <th>Saídas</th>
            <th>Fornecedores</th>
            <th>Clientes</th>
            <th>Indicadores</th>
            <th className={styles.colAcoes}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {TIPOS.map(({ tipo, rotulo }) => {
            const daRaia = linhas.filter((l) => l.ativo && l.tipo === tipo);
            return (
              <Fragment key={tipo}>
                <tr className={styles.linhaGrupo}>
                  <th colSpan={COLUNAS} scope="colgroup">
                    <span className={styles[`marca${tipo}`]} aria-hidden="true" />
                    {rotulo} <span className={styles.contagem}>{daRaia.length}</span>
                  </th>
                </tr>
                {daRaia.map((l, i) => (
                  <Linha key={l.id} linha={l} usuarios={usuarios} podeGerenciar={podeGerenciar} primeira={i === 0} ultima={i === daRaia.length - 1} />
                ))}
                {novos.filter((t) => t === tipo).map((t, i) => (
                  <Linha
                    key={`novo-${t}-${i}`}
                    usuarios={usuarios}
                    podeGerenciar
                    tipoNovo={t}
                    aoCancelar={() => setNovos((n) => { const k = n.indexOf(t); return n.filter((_, j) => j !== k); })}
                  />
                ))}
                {daRaia.length === 0 && !novos.includes(tipo) && (
                  <tr>
                    <td colSpan={COLUNAS} className={styles.vazio}>Nenhum processo nesta raia.</td>
                  </tr>
                )}
                {podeGerenciar && (
                  <tr className={styles.linhaAdicionar}>
                    <td colSpan={COLUNAS}>
                      <button type="button" className={styles.botaoAdicionar} onClick={() => setNovos((n) => [...n, tipo])}>
                        + Adicionar linha
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {inativas.length > 0 && (
            <>
              <tr className={styles.linhaGrupo}>
                <th colSpan={COLUNAS} scope="colgroup">
                  Inativos <span className={styles.contagem}>{inativas.length}</span>
                </th>
              </tr>
              {inativas.map((l) => (
                <Linha key={l.id} linha={l} usuarios={usuarios} podeGerenciar={podeGerenciar} primeira ultima />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Uma linha da planilha. Tem dois modos: leitura (mostra os dados e os botões) e edição (campos para preencher).
 * Sem `linha`, é uma linha nova (`tipoNovo` diz em qual raia). `aoCancelar` é chamado ao descartar uma linha nova.
 */
function Linha({
  linha,
  usuarios,
  podeGerenciar,
  primeira,
  ultima,
  tipoNovo,
  aoCancelar,
}: {
  linha?: LinhaProcesso;
  usuarios: { id: string; nome: string }[];
  podeGerenciar: boolean;
  primeira?: boolean;
  ultima?: boolean;
  tipoNovo?: TipoProcesso;
  aoCancelar?: () => void;
}) {
  // É uma linha nova (ainda não existe no banco)?
  const novo = !linha;
  // Está no modo de edição? (linhas novas já começam editando)
  const [editando, setEditando] = useState(novo);
  // Resposta da última ação (guarda a mensagem de erro, se houver).
  const [res, setRes] = useState<ResultadoAcao>(null);
  // `pendente` fica verdadeiro enquanto uma ação está sendo enviada ao servidor (desliga os botões).
  const [pendente, iniciar] = useTransition();
  // Referência ao formulário, para ler os campos na hora de salvar.
  const formRef = useRef<HTMLFormElement>(null);
  // Nome único do formulário; os campos da linha apontam para ele (`form={formId}`) mesmo estando em colunas diferentes.
  const formId = `f-${linha?.id ?? `novo-${tipoNovo}`}`;

  // Roda uma server action, guarda a resposta e, se deu certo, chama `aoOk`.
  const executar = (acao: Acao, fd: FormData, aoOk?: () => void) =>
    iniciar(async () => {
      const r = await acao(null, fd);
      setRes(r);
      if (r && !r.erro) aoOk?.();
    });
  // Atalho para ações sem formulário (mover, reativar): monta o FormData com os campos dados e executa.
  const simples = (acao: Acao, campos: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    executar(acao, fd);
  };
  // Salva a linha: envia o formulário e, se deu certo, fecha o modo de edição (ou descarta a linha nova).
  const salvar = () => {
    if (!formRef.current) return;
    executar(salvarProcessoAcao, new FormData(formRef.current), () => {
      if (novo) aoCancelar?.();
      else setEditando(false);
    });
  };

  // Linha extra com a mensagem de erro, mostrada abaixo da linha quando a ação falha.
  const retorno = res?.erro ? (
    <tr className={styles.linhaRetorno}>
      <td colSpan={COLUNAS}>
        <p role="alert" className={styles.erro}>{res.erro}</p>
      </td>
    </tr>
  ) : null;

  // Modo leitura: mostra os dados do processo e os botões (↑ ↓, Editar ou Reativar).
  if (!editando && linha) {
    return (
      <>
        <tr className={linha.ativo ? styles.linha : styles.linhaInativa}>
          <td className={styles.colOrdem}>
            {podeGerenciar && linha.ativo && (
              <span className={styles.setas}>
                <button type="button" className={styles.botaoSeta} disabled={primeira || pendente} onClick={() => simples(moverProcessoAcao, { id: linha.id, direcao: "cima" })} aria-label={`Mover ${linha.codigo} para cima`}>↑</button>
                <button type="button" className={styles.botaoSeta} disabled={ultima || pendente} onClick={() => simples(moverProcessoAcao, { id: linha.id, direcao: "baixo" })} aria-label={`Mover ${linha.codigo} para baixo`}>↓</button>
              </span>
            )}
          </td>
          <td className={styles.codigo}>{linha.codigo}</td>
          <td>
            <Link href={`/processos/${linha.id}`} className={styles.linkNome}>{linha.nome}</Link>
            {linha.versao > 0 && <span className={styles.selo}>v{linha.versao}</span>}
          </td>
          <td>{TIPOS.find((t) => t.tipo === linha.tipo)?.curto}</td>
          <td>{linha.donoNome ?? <span className={styles.fraco}>—</span>}</td>
          <td className={styles.texto}>{linha.entradas || <span className={styles.fraco}>—</span>}</td>
          <td className={styles.texto}>{linha.saidas || <span className={styles.fraco}>—</span>}</td>
          <td className={styles.texto}>{linha.fornecedores || <span className={styles.fraco}>—</span>}</td>
          <td className={styles.texto}>{linha.clientes || <span className={styles.fraco}>—</span>}</td>
          <td className={styles.texto}>
            {linha.indicadores.length ? (
              <ul className={styles.listaIndicadores}>{linha.indicadores.map((n) => <li key={n}>{n}</li>)}</ul>
            ) : (
              <span className={styles.fraco}>—</span>
            )}
          </td>
          <td className={styles.colAcoes}>
            {podeGerenciar && linha.ativo && (
              <button key="editar" type="button" className={styles.botaoAcao} onClick={() => { setRes(null); setEditando(true); }}>Editar</button>
            )}
            {podeGerenciar && !linha.ativo && (
              <button type="button" className={styles.botaoAcao} disabled={pendente} onClick={() => simples(definirAtivoAcao, { id: linha.id, ativo: "true" })}>Reativar</button>
            )}
          </td>
        </tr>
        {retorno}
      </>
    );
  }

  // Tipo inicial no modo edição: o da linha, o da raia onde foi criada ou Finalístico por padrão.
  const tipo = linha?.tipo ?? tipoNovo ?? "FINALISTICO";
  // Cria uma célula com campo de texto grande (entradas, saídas, fornecedores, clientes).
  const area = (nome: keyof LinhaProcesso, rotulo: string) => (
    <td>
      <textarea
        form={formId}
        name={nome}
        defaultValue={(linha?.[nome] as string | undefined) ?? ""}
        aria-label={rotulo}
        rows={3}
        className={styles.area}
      />
    </td>
  );
  return (
    <>
      <tr className={styles.linhaEdicao}>
        <td className={styles.colOrdem}>
          <form
            id={formId}
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              salvar();
            }}
          >
            {linha && <input type="hidden" name="id" value={linha.id} />}
            {linha && <input type="hidden" name="revisao" value={linha.revisao} />}
          </form>
        </td>
        <td>
          <input form={formId} name="codigo" defaultValue={linha?.codigo ?? ""} required maxLength={20} aria-label="Código" className={styles.entrada} placeholder="PG-01" />
        </td>
        <td>
          <input form={formId} name="nome" defaultValue={linha?.nome ?? ""} required maxLength={150} aria-label="Nome" className={styles.entrada} placeholder="Nome do processo" autoFocus={novo} />
        </td>
        <td>
          <select form={formId} name="tipo" defaultValue={tipo} aria-label="Tipo (mover de raia)" className={styles.entrada}>
            {TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.curto}</option>)}
          </select>
        </td>
        <td>
          <select form={formId} name="donoId" defaultValue={linha?.donoId ?? ""} aria-label="Dono" className={styles.entrada}>
            <option value="">— sem dono —</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </td>
        {area("entradas", "Entradas")}
        {area("saidas", "Saídas")}
        {area("fornecedores", "Fornecedores")}
        {area("clientes", "Clientes")}
        <td>
          <textarea
            form={formId}
            name="indicadores"
            defaultValue={linha?.indicadores.join("\n") ?? ""}
            aria-label="Indicadores (um por linha)"
            placeholder="Um por linha"
            rows={3}
            className={styles.area}
          />
        </td>
        <td className={styles.colAcoes}>
          <button key="salvar" type="submit" form={formId} className={styles.botaoSalvar} disabled={pendente}>{pendente ? "Salvando..." : "Salvar"}</button>
          <button
            type="button"
            className={styles.botaoAcao}
            disabled={pendente}
            onClick={() => {
              setRes(null);
              if (novo) aoCancelar?.();
              else setEditando(false);
            }}
          >
            Cancelar
          </button>
        </td>
      </tr>
      {retorno}
    </>
  );
}
