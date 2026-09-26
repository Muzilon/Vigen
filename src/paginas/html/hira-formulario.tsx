"use client";

import { useActionState, useState } from "react";
import type { ConfigEscala } from "@/lib/escala/tipos";
import { avaliarPS, eixosPS, ROTULO_CONDICAO, ROTULO_HIERARQUIA, type AvaliacaoPS } from "@/lib/hira/regras";
import { BadgeFaixa } from "@/paginas/html/componentes/badge";
import { Botao } from "@/paginas/html/componentes/botao";
import { RetornoAcao, type AcaoServidor } from "@/paginas/html/componentes/form-acao";
import styles from "@/paginas/css/hira-formulario.module.css";

export interface ValoresHira {
  id?: string;
  versao?: number;
  obraId: string;
  setor: string;
  processoId: string;
  atividade: string;
  rotineira: boolean;
  perigo: string;
  risco: string;
  condicao: "NORMAL" | "ANORMAL" | "EMERGENCIA";
  controlesExistentes: string;
  hierarquiaControle: string;
  controlesPropostos: string;
  probabilidade: number;
  severidade: number;
  probabilidadeResidual: string;
  severidadeResidual: string;
  requisitoLegal: string;
  responsavelId: string;
  modoReavaliacao: "ITEM" | "GERAL";
  periodicidadeMeses: number;
}

type Opcao = { id: string; nome: string };

function tentar(config: ConfigEscala, p: number, s: number): AvaliacaoPS | null {
  try {
    return avaliarPS(config, p, s);
  } catch {
    return null;
  }
}

/**
 * Formulário da linha HIRA com cálculo ao vivo do nível inicial e residual (escala resolvida pela
 * obra escolhida: `escalas[obraId]` ou `escalas[""]`). `aprovacao` avisa que a gravação vira uma
 * solicitação de aprovação (config da empresa); em "alterar", pede o motivo.
 */
export function HiraFormulario({
  acao,
  modo,
  inicial,
  escalas,
  obras,
  processos,
  usuarios,
  setores,
  aprovacao,
  botao,
}: {
  acao: AcaoServidor;
  modo: "incluir" | "alterar";
  inicial: ValoresHira;
  escalas: Record<string, ConfigEscala>;
  obras: Opcao[];
  processos: (Opcao & { codigo: string })[];
  usuarios: Opcao[];
  setores: string[];
  aprovacao: { aprovadores: string[] } | null;
  botao: string;
}) {
  const [res, executar, pendente] = useActionState(acao, null);
  const [v, setV] = useState(inicial);
  const set = <K extends keyof ValoresHira>(k: K, valor: ValoresHira[K]) => setV((x) => ({ ...x, [k]: valor }));
  const config = escalas[v.obraId] ?? escalas[""];
  const { eixoP, eixoS } = eixosPS(config);
  const aval = tentar(config, v.probabilidade, v.severidade);
  const residual = v.probabilidadeResidual && v.severidadeResidual ? tentar(config, Number(v.probabilidadeResidual), Number(v.severidadeResidual)) : null;
  const valor = (k: keyof ValoresHira) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

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
          <span className={styles.rotulo}>Obra *</span>
          <select name="obraId" required value={v.obraId} onChange={valor("obraId")} className={styles.entrada}>
            <option value="">— escolha —</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Setor / frente *</span>
          <input name="setor" required minLength={2} maxLength={200} list="hira-setores" value={v.setor} onChange={valor("setor")} className={styles.entrada} />
          <datalist id="hira-setores">{setores.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Processo</span>
          <select name="processoId" value={v.processoId} onChange={valor("processoId")} className={styles.entrada}>
            <option value="">— sem processo —</option>
            {processos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
          </select>
        </label>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Atividade *</span>
          <input name="atividade" required minLength={2} maxLength={2000} value={v.atividade} onChange={valor("atividade")} className={styles.entrada} />
        </label>
        <fieldset className={styles.campo}>
          <legend className={styles.rotulo}>Rotina</legend>
          <div className={styles.segmentado}>
            {([["1", "Rotineira"], ["0", "Não rotineira"]] as const).map(([k, r]) => (
              <label key={k} className={(k === "1") === v.rotineira ? styles.opcaoMarcada : styles.opcao}>
                <input type="radio" name="rotineira" value={k} checked={(k === "1") === v.rotineira} onChange={() => set("rotineira", k === "1")} className={styles.radio} />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Condição</span>
          <select name="condicao" value={v.condicao} onChange={valor("condicao")} className={styles.entrada}>
            {(["NORMAL", "ANORMAL", "EMERGENCIA"] as const).map((c) => <option key={c} value={c}>{ROTULO_CONDICAO[c]}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Perigo (fonte) *</span>
          <textarea name="perigo" required minLength={2} rows={2} value={v.perigo} onChange={valor("perigo")} className={styles.entrada} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Risco / dano *</span>
          <textarea name="risco" required minLength={2} rows={2} value={v.risco} onChange={valor("risco")} className={styles.entrada} />
        </label>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Avaliação inicial</legend>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Controles existentes</span>
          <textarea name="controlesExistentes" rows={2} value={v.controlesExistentes} onChange={valor("controlesExistentes")} className={styles.entrada} />
        </label>
        <div className={styles.avaliacao}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoP.rotulo} *</span>
            <select name="probabilidade" value={v.probabilidade} onChange={(e) => set("probabilidade", Number(e.target.value))} className={styles.entrada}>
              {eixoP.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <span className={styles.vezes} aria-hidden="true">×</span>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoS.rotulo} *</span>
            <select name="severidade" value={v.severidade} onChange={(e) => set("severidade", Number(e.target.value))} className={styles.entrada}>
              {eixoS.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <div className={styles.resultado} aria-live="polite">
            <span className={styles.rotulo}>Nível inicial</span>
            {aval ? <BadgeFaixa faixa={aval.faixa} score={aval.score} /> : <span className={styles.aviso}>Fora da escala</span>}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Controles e risco residual</legend>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Hierarquia do controle proposto</span>
          <select name="hierarquiaControle" value={v.hierarquiaControle} onChange={valor("hierarquiaControle")} className={styles.entrada}>
            <option value="">—</option>
            {(Object.keys(ROTULO_HIERARQUIA) as (keyof typeof ROTULO_HIERARQUIA)[]).map((h) => <option key={h} value={h}>{ROTULO_HIERARQUIA[h]}</option>)}
          </select>
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Controles propostos</span>
          <textarea name="controlesPropostos" rows={2} value={v.controlesPropostos} onChange={valor("controlesPropostos")} className={styles.entrada} />
        </label>
        <div className={styles.avaliacao}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoP.rotulo} residual</span>
            <select name="probabilidadeResidual" value={v.probabilidadeResidual} onChange={valor("probabilidadeResidual")} className={styles.entrada}>
              <option value="">—</option>
              {eixoP.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <span className={styles.vezes} aria-hidden="true">×</span>
          <label className={styles.campo}>
            <span className={styles.rotulo}>{eixoS.rotulo} residual</span>
            <select name="severidadeResidual" value={v.severidadeResidual} onChange={valor("severidadeResidual")} className={styles.entrada}>
              <option value="">—</option>
              {eixoS.niveis.map((n) => <option key={n.valor} value={n.valor}>{n.valor} — {n.rotulo}</option>)}
            </select>
          </label>
          <div className={styles.resultado} aria-live="polite">
            <span className={styles.rotulo}>Nível residual</span>
            {residual ? <BadgeFaixa faixa={residual.faixa} score={residual.score} /> : <span className={styles.aviso}>Não avaliado</span>}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.bloco}>
        <legend className={styles.rotuloBloco}>Gestão</legend>
        <label className={styles.campoLargo}>
          <span className={styles.rotulo}>Requisito legal aplicável</span>
          <input name="requisitoLegal" maxLength={1000} placeholder="Ex.: NR-35 (trabalho em altura)" value={v.requisitoLegal} onChange={valor("requisitoLegal")} className={styles.entrada} />
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
            <option value="GERAL">Na revisão geral da obra</option>
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
