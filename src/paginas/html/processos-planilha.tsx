"use client";

import Link from "next/link";
import { Fragment, useRef, useState, useTransition } from "react";
import type { TipoProcesso } from "@prisma/client";
import { definirAtivoAcao, moverProcessoAcao, salvarProcessoAcao } from "@/app/(app)/processos/actions";
import type { ResultadoAcao } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/processos-planilha.module.css";

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

type Acao = (prev: ResultadoAcao, fd: FormData) => Promise<ResultadoAcao>;

const TIPOS: { tipo: TipoProcesso; rotulo: string; curto: string }[] = [
  { tipo: "GESTAO", rotulo: "Processos de gestão", curto: "Gestão" },
  { tipo: "FINALISTICO", rotulo: "Processos finalísticos", curto: "Finalístico" },
  { tipo: "APOIO", rotulo: "Processos de apoio", curto: "Apoio" },
];

const COLUNAS = 11;

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
  const [novos, setNovos] = useState<TipoProcesso[]>([]);
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
  const novo = !linha;
  const [editando, setEditando] = useState(novo);
  const [res, setRes] = useState<ResultadoAcao>(null);
  const [pendente, iniciar] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const formId = `f-${linha?.id ?? `novo-${tipoNovo}`}`;

  const executar = (acao: Acao, fd: FormData, aoOk?: () => void) =>
    iniciar(async () => {
      const r = await acao(null, fd);
      setRes(r);
      if (r && !r.erro) aoOk?.();
    });
  const simples = (acao: Acao, campos: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    executar(acao, fd);
  };
  const salvar = () => {
    if (!formRef.current) return;
    executar(salvarProcessoAcao, new FormData(formRef.current), () => {
      if (novo) aoCancelar?.();
      else setEditando(false);
    });
  };

  const retorno = res?.erro ? (
    <tr className={styles.linhaRetorno}>
      <td colSpan={COLUNAS}>
        <p role="alert" className={styles.erro}>{res.erro}</p>
      </td>
    </tr>
  ) : null;

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

  const tipo = linha?.tipo ?? tipoNovo ?? "FINALISTICO";
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
