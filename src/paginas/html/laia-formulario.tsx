"use client";

import { useActionState, useState } from "react";
import type { ConfigEscala } from "@/lib/escala/tipos";
import { eixoLaia, EIXOS_LAIA, pontuarLaia, ROTULO_INCIDENCIA, ROTULO_SITUACAO, ROTULO_TEMPORALIDADE, type PontuacaoLaia } from "@/lib/laia/regras";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/laia-formulario.module.css";

export interface ValoresLaia {
  id?: string;
  versao?: number;
  obraId: string;
  processoId: string;
  atividade: string;
  aspecto: string;
  impacto: string;
  situacao: "NORMAL" | "ANORMAL" | "EMERGENCIA";
  temporalidade: "PASSADA" | "ATUAL" | "FUTURA";
  incidencia: "DIRETA" | "INDIRETA";
  severidade: number;
  frequencia: number;
  abrangencia: number;
  requisitoLegal: boolean;
  partesInteressadas: boolean;
  controles: string;
  responsavelId: string;
  modoReavaliacao: "ITEM" | "GERAL";
  periodicidadeMeses: number;
}

type Opcao = { id: string; nome: string };

/**
 * Formulário da linha LAIA com pontuação e significância ao vivo (escala ASPECTO_IMPACTO da obra
 * escolhida). Eixos ausentes na escala da empresa não aparecem (valor 1 enviado, fora do score).
 */
export function LaiaFormulario({
  acao,
  modo,
  inicial,
  escalas,
  obras,
  processos,
  usuarios,
  aprovacao,
  botao,
}: {
  acao: AcaoServidor;
  modo: "incluir" | "alterar";
  inicial: ValoresLaia;
  escalas: Record<string, ConfigEscala>;
  obras: Opcao[];
  processos: (Opcao & { codigo: string })[];
  usuarios: Opcao[];
  aprovacao: { aprovadores: string[] } | null;
  botao: string;
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  const [v, setV] = useState(inicial);
  const set = <K extends keyof ValoresLaia>(k: K, valor: ValoresLaia[K]) => setV((x) => ({ ...x, [k]: valor }));
  const valor = (k: keyof ValoresLaia) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);
  const config = escalas[v.obraId] ?? escalas[""];
  let p: PontuacaoLaia | null = null;
  try {
    p = pontuarLaia(config, v);
  } catch {
    p = null;
  }
  const criterio = (chave: string) => config.criteriosExtras?.find((c) => c.chave === chave);

  return (
    <form action={executar} className={styles.formulario}>
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.versao !== undefined && <input type="hidden" name="versao" value={v.versao} />}

      {aprovacao && (
        <p className={styles.avisoAprovacao}>
          A empresa exige aprovação: ao salvar, {modo === "incluir" ? "a linha fica pendente" : "a alteração fica pendente"} até a assinatura de{" "}
          {aprovacao.aprovadores.join(", ") || "os aprovadores padrão"}.
        </p>
      )}

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Identificação</legend>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Unidade *</span>
          <select name="obraId" required value={v.obraId} onChange={valor("obraId")} className={styles.entrada}>
            <option value="">— escolha —</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Processo</span>
          <select name="processoId" value={v.processoId} onChange={valor("processoId")} className={styles.entrada}>
            <option value="">— sem processo —</option>
            {processos.map((x) => <option key={x.id} value={x.id}>{x.codigo} — {x.nome}</option>)}
          </select>
        </label>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Atividade *</span>
          <input name="atividade" required minLength={2} maxLength={2000} value={v.atividade} onChange={valor("atividade")} className={styles.entrada} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Aspecto ambiental *</span>
          <textarea name="aspecto" required minLength={2} rows={2} value={v.aspecto} onChange={valor("aspecto")} className={styles.entrada} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Impacto ambiental *</span>
          <textarea name="impacto" required minLength={2} rows={2} value={v.impacto} onChange={valor("impacto")} className={styles.entrada} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Situação</span>
          <select name="situacao" value={v.situacao} onChange={valor("situacao")} className={styles.entrada}>
            {(["NORMAL", "ANORMAL", "EMERGENCIA"] as const).map((c) => <option key={c} value={c}>{ROTULO_SITUACAO[c]}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Temporalidade</span>
          <select name="temporalidade" value={v.temporalidade} onChange={valor("temporalidade")} className={styles.entrada}>
            {(["PASSADA", "ATUAL", "FUTURA"] as const).map((c) => <option key={c} value={c}>{ROTULO_TEMPORALIDADE[c]}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Incidência</span>
          <select name="incidencia" value={v.incidencia} onChange={valor("incidencia")} className={styles.entrada}>
            {(["DIRETA", "INDIRETA"] as const).map((c) => <option key={c} value={c}>{ROTULO_INCIDENCIA[c]}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Avaliação de significância</legend>
        <div className={styles.avaliacao}>
          {EIXOS_LAIA.map((k) => {
            const e = eixoLaia(config, k);
            if (!e) return <input key={k} type="hidden" name={k} value={1} />;
            return (
              <label key={k} className={styles.campo}>
                <span className={styles.rotulo}>{e.rotulo} *</span>
                <select name={k} value={v[k]} onChange={(ev) => set(k, Number(ev.target.value))} className={styles.entrada}>
                  {e.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
                </select>
              </label>
            );
          })}
          <div className={styles.resultado} aria-live="polite">
            <span className={styles.rotulo}>Pontuação</span>
            {p ? (
              <>
                <BadgeFaixa faixa={p.faixa} score={p.score} />
                <span className={p.significativo ? styles.significativo : styles.naoSignificativo}>{p.significativo ? "Significativo" : "Não significativo"}</span>
              </>
            ) : (
              <span className={styles.aviso}>Fora da escala</span>
            )}
          </div>
        </div>
        <label className={styles.opcaoCheck}>
          <input type="checkbox" name="requisitoLegal" checked={v.requisitoLegal} onChange={(e) => set("requisitoLegal", e.target.checked)} />
          Requisito legal aplicável{criterio("requisitoLegal")?.elevaPara ? ` (eleva a no mínimo ${criterio("requisitoLegal")!.elevaPara === "CRITICO" ? "Crítico" : "Alto"})` : ""}
        </label>
        <label className={styles.opcaoCheck}>
          <input type="checkbox" name="partesInteressadas" checked={v.partesInteressadas} onChange={(e) => set("partesInteressadas", e.target.checked)} />
          Demanda de partes interessadas{criterio("partesInteressadas")?.elevaPara ? ` (eleva a no mínimo ${criterio("partesInteressadas")!.elevaPara === "CRITICO" ? "Crítico" : "Alto"})` : ""}
        </label>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Controle e gestão</legend>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Controles operacionais</span>
          <textarea name="controles" rows={2} value={v.controles} onChange={valor("controles")} className={styles.entrada} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Responsável</span>
          <select name="responsavelId" value={v.responsavelId} onChange={valor("responsavelId")} className={styles.entrada}>
            <option value="">— sem responsável —</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Reavaliação</span>
          <select name="modoReavaliacao" value={v.modoReavaliacao} onChange={valor("modoReavaliacao")} className={styles.entrada}>
            <option value="ITEM">Item a item</option>
            <option value="GERAL">Na revisão geral da unidade</option>
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Periodicidade (meses)</span>
          <input name="periodicidadeMeses" type="number" min={1} max={60} value={v.periodicidadeMeses} onChange={(e) => set("periodicidadeMeses", Number(e.target.value))} className={styles.entrada} />
        </label>
        {modo === "alterar" && (
          <label className={styles.campoLargo}>
            <span className={styles.rotulo}>Motivo da alteração</span>
            <input name="motivo" maxLength={1000} className={styles.entrada} />
          </label>
        )}
      </fieldset>

      <div className={styles.rodape}>
        <RetornoAcao res={res} />
        <Botao type="submit" disabled={pendente}>{pendente ? "Salvando…" : botao}</Botao>
      </div>
    </form>
  );
}
