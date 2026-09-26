"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { ConfigEscala } from "@/lib/escala/tipos";
import { avaliar, exigePlano, ROTULO_TRATAMENTO, eixosPI, type Avaliacao } from "@/lib/riscos/regras";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/riscos-formulario.module.css";

export interface ValoresRisco {
  id?: string;
  versao?: number;
  tipo: "RISCO" | "OPORTUNIDADE";
  descricao: string;
  causa: string;
  consequencia: string;
  processoId: string;
  obraId: string;
  responsavelId: string;
  probabilidade: number;
  impacto: number;
  modoReavaliacao: "ITEM" | "GERAL";
  periodicidadeMeses: number;
}

type Opcao = { id: string; nome: string };

/**
 * Formulário de risco/oportunidade com cálculo do nível ao vivo (escala resolvida pela obra
 * escolhida: `escalas[obraId]` ou `escalas[""]` = padrão da empresa). Modos: "criar" (inclui
 * tratamento inicial e, se exigido, a primeira ação do plano), "editar" e "aprovacao"
 * (mesmos campos + aprovadores; envia à action de solicitação).
 */
export function RiscoFormulario({
  acao,
  modo,
  inicial,
  escalas,
  processos,
  obras,
  usuarios,
  aprovadores = [],
  botao,
  rodape,
}: {
  acao: AcaoServidor;
  modo: "criar" | "editar" | "aprovacao";
  inicial: ValoresRisco;
  escalas: Record<string, ConfigEscala>;
  processos: (Opcao & { codigo: string })[];
  obras: Opcao[];
  usuarios: Opcao[];
  aprovadores?: Opcao[];
  botao: string;
  rodape?: ReactNode;
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  const [v, setV] = useState(inicial);
  const [tratamento, setTratamento] = useState("");
  const set = <K extends keyof ValoresRisco>(k: K, valor: ValoresRisco[K]) => setV((x) => ({ ...x, [k]: valor }));
  const config = escalas[v.obraId] ?? escalas[""];
  const { eixoP, eixoI } = eixosPI(config);
  let aval: Avaliacao | null = null;
  try {
    aval = avaliar(config, v.probabilidade, v.impacto);
  } catch {
    aval = null;
  }
  const tratamentos = v.tipo === "RISCO" ? (["ACEITAR", "MITIGAR", "TRANSFERIR", "EVITAR"] as const) : (["ACEITAR", "EXPLORAR"] as const);
  const precisaPlano = !!aval && exigePlano(tratamento as never, aval.faixa);

  return (
    <form action={executar} className={styles.formulario}>
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.versao !== undefined && <input type="hidden" name="versao" value={v.versao} />}

      <fieldset className={styles.campoLargo}>
        <legend className={styles.rotulo}>Tipo</legend>
        <div className={styles.segmentado}>
          {(["RISCO", "OPORTUNIDADE"] as const).map((t) => (
            <label key={t} className={v.tipo === t ? styles.opcaoMarcada : styles.opcao}>
              <input type="radio" name="tipo" value={t} checked={v.tipo === t} onChange={() => set("tipo", t)} className={styles.radio} />
              {t === "RISCO" ? "Risco" : "Oportunidade"}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.campoLargo}>
        <span className={styles.rotulo}>Descrição *</span>
        <textarea name="descricao" required minLength={3} maxLength={2000} rows={2} value={v.descricao} onChange={(e) => set("descricao", e.target.value)} className={styles.entrada} />
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Causa</span>
        <textarea name="causa" rows={2} value={v.causa} onChange={(e) => set("causa", e.target.value)} className={styles.entrada} />
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Consequência</span>
        <textarea name="consequencia" rows={2} value={v.consequencia} onChange={(e) => set("consequencia", e.target.value)} className={styles.entrada} />
      </label>

      <label className={styles.campo}>
        <span className={styles.rotulo}>Processo</span>
        <select name="processoId" value={v.processoId} onChange={(e) => set("processoId", e.target.value)} className={styles.entrada}>
          <option value="">— sem processo —</option>
          {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Obra/unidade (escala por local)</span>
        <select name="obraId" value={v.obraId} onChange={(e) => set("obraId", e.target.value)} className={styles.entrada}>
          <option value="">— empresa toda —</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Responsável</span>
        <select name="responsavelId" value={v.responsavelId} onChange={(e) => set("responsavelId", e.target.value)} className={styles.entrada}>
          <option value="">— sem responsável —</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <div className={styles.campo} />

      <div className={styles.avaliacao}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>{eixoP.rotulo} *</span>
          <select name="probabilidade" value={v.probabilidade} onChange={(e) => set("probabilidade", Number(e.target.value))} className={styles.entrada}>
            {eixoP.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
          </select>
        </label>
        <span className={styles.vezes} aria-hidden="true">×</span>
        <label className={styles.campo}>
          <span className={styles.rotulo}>{eixoI.rotulo} *</span>
          <select name="impacto" value={v.impacto} onChange={(e) => set("impacto", Number(e.target.value))} className={styles.entrada}>
            {eixoI.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
          </select>
        </label>
        <div className={styles.resultado} aria-live="polite">
          <span className={styles.rotulo}>Nível calculado</span>
          {aval ? <BadgeFaixa faixa={aval.faixa} score={aval.score} /> : <span className={styles.aviso}>Valor fora da escala</span>}
        </div>
      </div>

      <label className={styles.campo}>
        <span className={styles.rotulo}>Reavaliação</span>
        <select name="modoReavaliacao" value={v.modoReavaliacao} onChange={(e) => set("modoReavaliacao", e.target.value as "ITEM" | "GERAL")} className={styles.entrada}>
          <option value="ITEM">Item a item</option>
          <option value="GERAL">Na revisão geral (processo/empresa)</option>
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Periodicidade (meses)</span>
        <input name="periodicidadeMeses" type="number" min={1} max={60} value={v.periodicidadeMeses} onChange={(e) => set("periodicidadeMeses", Number(e.target.value))} className={styles.entrada} />
      </label>

      {modo === "criar" && (
        <fieldset className={styles.bloco}>
          <legend className={styles.rotuloBloco}>Tratamento inicial (opcional)</legend>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Tratamento</span>
            <select name="tratamento" value={tratamento} onChange={(e) => setTratamento(e.target.value)} className={styles.entrada}>
              <option value="">— definir depois —</option>
              {tratamentos.map((t) => <option key={t} value={t}>{ROTULO_TRATAMENTO[t]}</option>)}
            </select>
          </label>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Como será tratado</span>
            <input name="descricaoTratamento" className={styles.entrada} />
          </label>
          {precisaPlano && <PrimeiraAcao usuarios={usuarios} />}
        </fieldset>
      )}

      {modo === "aprovacao" && (
        <fieldset className={styles.bloco}>
          <legend className={styles.rotuloBloco}>Aprovação</legend>
          <label className={styles.campoLargo}>
            <span className={styles.rotulo}>Resumo (opcional)</span>
            <input name="resumo" maxLength={300} className={styles.entrada} />
          </label>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Modo</span>
            <select name="modo" defaultValue="SEQUENCIAL" className={styles.entrada}>
              <option value="SEQUENCIAL">Sequencial (em ordem)</option>
              <option value="PARALELO">Simultâneo</option>
            </select>
          </label>
          <div className={styles.campoLargo}>
            <span className={styles.rotulo}>Aprovadores</span>
            <div className={styles.listaOpcoes}>
              {aprovadores.map((u) => (
                <label key={u.id} className={styles.opcaoCheck}>
                  <input type="checkbox" name="aprovadorIds" value={u.id} /> {u.nome}
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      )}

      <div className={styles.rodape}>
        <Botao type="submit" disabled={pendente}>{pendente ? "Aguarde..." : botao}</Botao>
        {rodape}
      </div>
      <div className={styles.campoLargo}>
        <RetornoAcao res={res} />
      </div>
    </form>
  );
}

/**
 * Definir tratamento + avaliação residual (detalhe do registro). Se o tratamento escolhido
 * exigir plano e o registro ainda não tiver um, pede a primeira ação (plano criado junto).
 */
export function TratamentoFormulario({
  acao,
  id,
  versao,
  tipo,
  faixa,
  config,
  temPlano,
  usuarios,
  inicial,
}: {
  acao: AcaoServidor;
  id: string;
  versao: number;
  tipo: "RISCO" | "OPORTUNIDADE";
  faixa: Avaliacao["faixa"];
  config: ConfigEscala;
  temPlano: boolean;
  usuarios: Opcao[];
  inicial: { tratamento: string; descricaoTratamento: string; probabilidadeResidual: string; impactoResidual: string };
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  const [v, setV] = useState(inicial);
  const { eixoP, eixoI } = eixosPI(config);
  const tratamentos = tipo === "RISCO" ? (["ACEITAR", "MITIGAR", "TRANSFERIR", "EVITAR"] as const) : (["ACEITAR", "EXPLORAR"] as const);
  let residual: Avaliacao | null = null;
  if (v.probabilidadeResidual && v.impactoResidual) {
    try {
      residual = avaliar(config, Number(v.probabilidadeResidual), Number(v.impactoResidual));
    } catch {
      residual = null;
    }
  }
  const precisaPlano = !temPlano && exigePlano(v.tratamento as never, faixa);
  return (
    <form action={executar} className={styles.formulario}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="versao" value={versao} />
      <label className={styles.campo}>
        <span className={styles.rotulo}>Tratamento *</span>
        <select name="tratamento" required value={v.tratamento} onChange={(e) => setV({ ...v, tratamento: e.target.value })} className={styles.entrada}>
          <option value="" disabled>Selecione…</option>
          {tratamentos.map((t) => <option key={t} value={t}>{ROTULO_TRATAMENTO[t]}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Como será tratado</span>
        <input name="descricaoTratamento" value={v.descricaoTratamento} onChange={(e) => setV({ ...v, descricaoTratamento: e.target.value })} className={styles.entrada} />
      </label>
      <div className={styles.avaliacao}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>{eixoP.rotulo} residual</span>
          <select name="probabilidadeResidual" value={v.probabilidadeResidual} onChange={(e) => setV({ ...v, probabilidadeResidual: e.target.value })} className={styles.entrada}>
            <option value="">—</option>
            {eixoP.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
          </select>
        </label>
        <span className={styles.vezes} aria-hidden="true">×</span>
        <label className={styles.campo}>
          <span className={styles.rotulo}>{eixoI.rotulo} residual</span>
          <select name="impactoResidual" value={v.impactoResidual} onChange={(e) => setV({ ...v, impactoResidual: e.target.value })} className={styles.entrada}>
            <option value="">—</option>
            {eixoI.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
          </select>
        </label>
        <div className={styles.resultado} aria-live="polite">
          <span className={styles.rotulo}>Nível residual</span>
          {residual ? <BadgeFaixa faixa={residual.faixa} score={residual.score} /> : <span className={styles.rotulo}>—</span>}
        </div>
      </div>
      {precisaPlano && <PrimeiraAcao usuarios={usuarios} />}
      <div className={styles.rodape}>
        <Botao type="submit" disabled={pendente}>{pendente ? "Aguarde..." : "Salvar tratamento"}</Botao>
      </div>
      <div className={styles.campoLargo}>
        <RetornoAcao res={res} />
      </div>
    </form>
  );
}

/** Primeira ação do plano (o quê / quem / quando) — quando o tratamento exige plano de ação. */
export function PrimeiraAcao({ usuarios }: { usuarios: Opcao[] }) {
  return (
    <div className={styles.primeiraAcao}>
      <p className={styles.alertaPlano}>Mitigar/Evitar com nível Alto ou Crítico exige plano de ação — informe a primeira ação (o plano é criado e vinculado).</p>
      <label className={styles.campoLargo}>
        <span className={styles.rotulo}>O quê *</span>
        <input name="acaoOQue" required minLength={2} className={styles.entrada} />
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Quem *</span>
        <select name="acaoQuemId" required defaultValue="" className={styles.entrada}>
          <option value="" disabled>Selecione…</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <label className={styles.campo}>
        <span className={styles.rotulo}>Quando *</span>
        <input name="acaoQuando" type="date" required className={styles.entrada} />
      </label>
    </div>
  );
}
